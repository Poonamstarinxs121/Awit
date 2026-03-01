import { pool } from '../db/index.js';
import crypto from 'crypto';
import { executeAgentTurn } from './orchestrationEngine.js';
import { logActivity } from './activityService.js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'squidjob-dev-encryption-key-32b!';

function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptToken(encryptedToken: string): string {
  const [ivHex, encrypted] = encryptedToken.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function configureTelegramBot(tenantId: string, botToken: string): Promise<{ bot_username: string }> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
  const data = await response.json() as any;
  if (!data.ok) throw new Error('Invalid bot token');

  const botUsername = data.result.username;
  const encrypted = encryptToken(botToken);

  await pool.query(
    `INSERT INTO telegram_configs (tenant_id, bot_token_encrypted, bot_username)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id) DO UPDATE SET
       bot_token_encrypted = $2, bot_username = $3, is_active = true, updated_at = NOW()`,
    [tenantId, encrypted, botUsername]
  );

  return { bot_username: botUsername };
}

export async function getTelegramConfig(tenantId: string): Promise<any | null> {
  const result = await pool.query(
    `SELECT id, bot_username, is_active, created_at FROM telegram_configs WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows[0] || null;
}

export async function removeTelegramConfig(tenantId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM telegram_configs WHERE tenant_id = $1 RETURNING id`,
    [tenantId]
  );
  return result.rows.length > 0;
}

async function getBotToken(tenantId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT bot_token_encrypted FROM telegram_configs WHERE tenant_id = $1 AND is_active = true`,
    [tenantId]
  );
  if (result.rows.length === 0) return null;
  return decryptToken(result.rows[0].bot_token_encrypted);
}

export async function linkChat(tenantId: string, chatId: string, chatType: string, linkedBy?: string): Promise<void> {
  await pool.query(
    `INSERT INTO telegram_chat_links (tenant_id, chat_id, chat_type, linked_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, chat_id) DO NOTHING`,
    [tenantId, chatId, chatType, linkedBy || null]
  );
}

export async function getLinkedChats(tenantId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, chat_id, chat_type, notifications_enabled, created_at FROM telegram_chat_links WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows;
}

export async function sendTelegramMessage(tenantId: string, chatId: string, message: string): Promise<boolean> {
  const token = await getBotToken(tenantId);
  if (!token) return false;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
    const data = await response.json() as any;

    await pool.query(
      `INSERT INTO telegram_notification_queue (tenant_id, chat_id, message, sent, sent_at, error)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, chatId, message, data.ok, data.ok ? new Date() : null, data.ok ? null : JSON.stringify(data)]
    );

    return data.ok;
  } catch (error) {
    await pool.query(
      `INSERT INTO telegram_notification_queue (tenant_id, chat_id, message, sent, error)
       VALUES ($1, $2, $3, false, $4)`,
      [tenantId, chatId, message, error instanceof Error ? error.message : 'Unknown error']
    );
    return false;
  }
}

export async function broadcastToTenant(tenantId: string, message: string): Promise<void> {
  const chats = await getLinkedChats(tenantId);
  for (const chat of chats) {
    if (chat.notifications_enabled) {
      sendTelegramMessage(tenantId, chat.chat_id, message).catch(() => {});
    }
  }
}

interface TelegramPollerState {
  tenantId: string;
  botToken: string;
  offset: number;
  running: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

const activePollers = new Map<string, TelegramPollerState>();
const POLL_INTERVAL_MS = 3000;

async function getLeadAgent(tenantId: string): Promise<{ id: string; name: string } | null> {
  const result = await pool.query(
    `SELECT id, name FROM agents WHERE tenant_id = $1 AND level = 'lead' AND status = 'active' ORDER BY created_at ASC LIMIT 1`,
    [tenantId]
  );
  if (result.rows.length === 0) {
    const fallback = await pool.query(
      `SELECT id, name FROM agents WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at ASC LIMIT 1`,
      [tenantId]
    );
    return fallback.rows[0] || null;
  }
  return result.rows[0];
}

async function handlePauseCommand(tenantId: string, text: string): Promise<string | null> {
  const lower = text.toLowerCase().trim();

  if (lower === 'pause all agents' || lower === 'pause all') {
    await pool.query(
      `INSERT INTO tenant_settings (tenant_id, key, value, updated_at) VALUES ($1, 'global_paused', 'true', NOW()) ON CONFLICT (tenant_id, key) DO UPDATE SET value = 'true', updated_at = NOW()`,
      [tenantId]
    );
    return 'All agents have been paused. Use "Resume all agents" to resume.';
  }

  if (lower === 'resume all agents' || lower === 'resume all') {
    await pool.query(
      `INSERT INTO tenant_settings (tenant_id, key, value, updated_at) VALUES ($1, 'global_paused', 'false', NOW()) ON CONFLICT (tenant_id, key) DO UPDATE SET value = 'false', updated_at = NOW()`,
      [tenantId]
    );
    return 'All agents have been resumed.';
  }

  const pauseMatch = lower.match(/^pause\s+(.+)$/);
  if (pauseMatch) {
    const agentName = pauseMatch[1];
    const result = await pool.query(
      `UPDATE agents SET is_paused = true WHERE tenant_id = $1 AND LOWER(name) = $2 RETURNING name`,
      [tenantId, agentName]
    );
    if (result.rows.length > 0) return `${result.rows[0].name} has been paused.`;
    return `No agent found with name "${agentName}".`;
  }

  const resumeMatch = lower.match(/^resume\s+(.+)$/);
  if (resumeMatch) {
    const agentName = resumeMatch[1];
    const result = await pool.query(
      `UPDATE agents SET is_paused = false WHERE tenant_id = $1 AND LOWER(name) = $2 RETURNING name`,
      [tenantId, agentName]
    );
    if (result.rows.length > 0) return `${result.rows[0].name} has been resumed.`;
    return `No agent found with name "${agentName}".`;
  }

  return null;
}

async function processIncomingMessage(tenantId: string, chatId: string, text: string, senderName: string): Promise<void> {
  try {
    const commandResponse = await handlePauseCommand(tenantId, text);
    if (commandResponse) {
      await sendTelegramMessage(tenantId, chatId, commandResponse);
      return;
    }

    const leadAgent = await getLeadAgent(tenantId);
    if (!leadAgent) {
      await sendTelegramMessage(tenantId, chatId, 'No active agents available. Please check your dashboard.');
      return;
    }

    await logActivity(tenantId, senderName, 'telegram_message', 'user', chatId, { message_preview: text.slice(0, 200) });

    const result = await executeAgentTurn(
      tenantId,
      leadAgent.id,
      `[Telegram message from ${senderName}]: ${text}`,
      `telegram-${chatId}`
    );

    const response = result.response.slice(0, 4000);
    await sendTelegramMessage(tenantId, chatId, response);
  } catch (error) {
    console.error(`Error processing Telegram message for tenant ${tenantId}:`, error);
    await sendTelegramMessage(tenantId, chatId, 'Sorry, I encountered an error processing your message. Please try again.').catch(() => {});
  }
}

async function pollUpdates(state: TelegramPollerState): Promise<void> {
  if (!state.running) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${state.botToken}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offset: state.offset,
        timeout: 1,
        allowed_updates: ['message'],
      }),
    });

    const data = await response.json() as any;
    if (!data.ok || !data.result || data.result.length === 0) {
      schedulePoll(state);
      return;
    }

    for (const update of data.result) {
      state.offset = update.update_id + 1;

      if (update.message?.text) {
        const chatId = String(update.message.chat.id);
        const text = update.message.text;
        const senderName = update.message.from?.first_name || 'User';

        const isLinked = await pool.query(
          `SELECT 1 FROM telegram_chat_links WHERE tenant_id = $1 AND chat_id = $2`,
          [state.tenantId, chatId]
        );

        if (isLinked.rows.length === 0) {
          await pool.query(
            `INSERT INTO telegram_chat_links (tenant_id, chat_id, chat_type, notifications_enabled)
             VALUES ($1, $2, 'private', true)
             ON CONFLICT (tenant_id, chat_id) DO NOTHING`,
            [state.tenantId, chatId]
          );
        }

        processIncomingMessage(state.tenantId, chatId, text, senderName).catch(err => {
          console.error('Error handling telegram message:', err);
        });
      }
    }
  } catch (error) {
    console.error(`Telegram polling error for tenant ${state.tenantId}:`, error instanceof Error ? error.message : error);
  }

  schedulePoll(state);
}

function schedulePoll(state: TelegramPollerState): void {
  if (!state.running) return;
  state.timer = setTimeout(() => pollUpdates(state), POLL_INTERVAL_MS);
}

export async function startPolling(tenantId: string): Promise<void> {
  if (activePollers.has(tenantId)) {
    console.log(`Telegram polling already active for tenant ${tenantId}`);
    return;
  }

  const token = await getBotToken(tenantId);
  if (!token) {
    console.log(`No bot token found for tenant ${tenantId}, skipping polling`);
    return;
  }

  const state: TelegramPollerState = {
    tenantId,
    botToken: token,
    offset: 0,
    running: true,
    timer: null,
  };

  activePollers.set(tenantId, state);
  console.log(`Telegram polling started for tenant ${tenantId}`);
  pollUpdates(state);
}

export function stopPolling(tenantId: string): void {
  const state = activePollers.get(tenantId);
  if (state) {
    state.running = false;
    if (state.timer) clearTimeout(state.timer);
    activePollers.delete(tenantId);
    console.log(`Telegram polling stopped for tenant ${tenantId}`);
  }
}

export async function startAllPollers(): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT tenant_id FROM telegram_configs WHERE is_active = true`
    );

    for (const row of result.rows) {
      startPolling(row.tenant_id).catch(err => {
        console.error(`Failed to start polling for tenant ${row.tenant_id}:`, err);
      });
    }

    if (result.rows.length > 0) {
      console.log(`Started Telegram polling for ${result.rows.length} tenant(s)`);
    }
  } catch (error) {
    console.error('Failed to start Telegram pollers:', error);
  }
}

export function stopAllPollers(): void {
  for (const tenantId of activePollers.keys()) {
    stopPolling(tenantId);
  }
}
