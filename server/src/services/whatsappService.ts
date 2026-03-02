import crypto from 'crypto';
import { pool } from '../db/index.js';
import { executeAgentTurn } from './orchestrationEngine.js';
import { logActivity } from './activityService.js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'squidjob-dev-encryption-key-32b!';
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function configureWhatsapp(tenantId: string, accountSid: string, authToken: string, whatsappNumber: string) {
  const encryptedToken = encrypt(authToken);
  const result = await pool.query(
    `INSERT INTO whatsapp_configs (tenant_id, account_sid, auth_token_encrypted, whatsapp_number, is_active)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (tenant_id) DO UPDATE SET
       account_sid = $2, auth_token_encrypted = $3, whatsapp_number = $4, is_active = true, updated_at = NOW()
     RETURNING id, account_sid, whatsapp_number, is_active, created_at`,
    [tenantId, accountSid, encryptedToken, whatsappNumber]
  );
  return result.rows[0];
}

export async function getWhatsappConfig(tenantId: string) {
  const result = await pool.query(
    `SELECT id, account_sid, whatsapp_number, is_active, created_at FROM whatsapp_configs WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows[0] || null;
}

export async function removeWhatsappConfig(tenantId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM whatsapp_configs WHERE tenant_id = $1 RETURNING id`,
    [tenantId]
  );
  return result.rows.length > 0;
}

async function getCredentials(tenantId: string): Promise<{ accountSid: string; authToken: string; whatsappNumber: string } | null> {
  const result = await pool.query(
    `SELECT account_sid, auth_token_encrypted, whatsapp_number FROM whatsapp_configs WHERE tenant_id = $1 AND is_active = true`,
    [tenantId]
  );
  if (!result.rows[0]) return null;
  return {
    accountSid: result.rows[0].account_sid,
    authToken: decrypt(result.rows[0].auth_token_encrypted),
    whatsappNumber: result.rows[0].whatsapp_number,
  };
}

async function getLeadAgent(tenantId: string): Promise<{ id: string } | null> {
  const result = await pool.query(
    `SELECT id FROM agents WHERE tenant_id = $1 AND level = 'lead' AND status = 'active' AND is_paused = false LIMIT 1`,
    [tenantId]
  );
  return result.rows[0] || null;
}

export async function sendWhatsappMessage(tenantId: string, to: string, body: string): Promise<boolean> {
  const creds = await getCredentials(tenantId);
  if (!creds) return false;

  const fromNumber = creds.whatsappNumber.startsWith('whatsapp:')
    ? creds.whatsappNumber
    : `whatsapp:${creds.whatsappNumber}`;
  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
  const params = new URLSearchParams({ From: fromNumber, To: toNumber, Body: body });
  const authHeader = 'Basic ' + Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    return false;
  }
}

export async function processIncomingWhatsapp(tenantId: string, from: string, body: string): Promise<void> {
  try {
    const leadAgent = await getLeadAgent(tenantId);
    if (!leadAgent) {
      await sendWhatsappMessage(tenantId, from, 'No active agents available. Please check your dashboard.');
      return;
    }

    const senderName = from.replace('whatsapp:', '');
    await logActivity(tenantId, senderName, 'whatsapp_message', 'user', from, { message_preview: body.slice(0, 200) });

    const result = await executeAgentTurn(
      tenantId,
      leadAgent.id,
      `[WhatsApp message from ${senderName}]: ${body}`,
      `whatsapp-${from}`
    );

    const response = result.response.slice(0, 1600);
    await sendWhatsappMessage(tenantId, from, response);
  } catch (error) {
    console.error(`WhatsApp processing error for tenant ${tenantId}:`, error);
    await sendWhatsappMessage(tenantId, from, 'Sorry, I encountered an error. Please try again.').catch(() => {});
  }
}

export async function getTenantByWhatsappNumber(whatsappNumber: string): Promise<string | null> {
  const normalized = whatsappNumber.replace('whatsapp:', '').replace('+', '');
  const result = await pool.query(
    `SELECT tenant_id FROM whatsapp_configs
     WHERE is_active = true AND (
       whatsapp_number = $1 OR
       whatsapp_number = $2 OR
       whatsapp_number = $3
     )`,
    [whatsappNumber, `+${normalized}`, normalized]
  );
  return result.rows[0]?.tenant_id || null;
}
