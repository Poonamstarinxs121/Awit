import { pool } from '../db/index.js';
import crypto from 'crypto';

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
