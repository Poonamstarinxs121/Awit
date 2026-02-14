import { pool } from '../db/index.js';
import crypto from 'crypto';

type WebhookEvent = 'task.created' | 'task.completed' | 'task.updated' | 'standup.generated' | 'agent.error' | 'agent.heartbeat';

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  tenant_id: string;
  data: Record<string, any>;
}

export async function registerWebhook(tenantId: string, url: string, events: WebhookEvent[], secret?: string): Promise<any> {
  const result = await pool.query(
    `INSERT INTO webhooks (tenant_id, url, events, secret)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [tenantId, url, events, secret || null]
  );
  return result.rows[0];
}

export async function listWebhooks(tenantId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, url, events, is_active, created_at, updated_at FROM webhooks WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return result.rows;
}

export async function updateWebhook(tenantId: string, webhookId: string, updates: { url?: string; events?: string[]; is_active?: boolean; secret?: string }): Promise<any> {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 3;

  if (updates.url !== undefined) { fields.push(`url = $${idx}`); values.push(updates.url); idx++; }
  if (updates.events !== undefined) { fields.push(`events = $${idx}`); values.push(updates.events); idx++; }
  if (updates.is_active !== undefined) { fields.push(`is_active = $${idx}`); values.push(updates.is_active); idx++; }
  if (updates.secret !== undefined) { fields.push(`secret = $${idx}`); values.push(updates.secret); idx++; }
  fields.push('updated_at = NOW()');

  if (fields.length === 1) return null;

  const result = await pool.query(
    `UPDATE webhooks SET ${fields.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [webhookId, tenantId, ...values]
  );
  return result.rows[0];
}

export async function deleteWebhook(tenantId: string, webhookId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM webhooks WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [webhookId, tenantId]
  );
  return result.rows.length > 0;
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function fireWebhookEvent(tenantId: string, event: WebhookEvent, data: Record<string, any>): Promise<void> {
  const result = await pool.query(
    `SELECT id, url, secret, events FROM webhooks WHERE tenant_id = $1 AND is_active = true AND $2 = ANY(events)`,
    [tenantId, event]
  );

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    tenant_id: tenantId,
    data,
  };
  const payloadStr = JSON.stringify(payload);

  for (const webhook of result.rows) {
    deliverWebhook(tenantId, webhook.id, webhook.url, webhook.secret, event, payloadStr).catch(err =>
      console.error(`Webhook delivery failed for ${webhook.id}:`, err)
    );
  }
}

async function deliverWebhook(tenantId: string, webhookId: string, url: string, secret: string | null, event: string, payloadStr: string, attempt: number = 1): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-SquidJob-Event': event,
    'X-SquidJob-Delivery': crypto.randomUUID(),
  };

  if (secret) {
    headers['X-SquidJob-Signature'] = `sha256=${signPayload(payloadStr, secret)}`;
  }

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseStatus = response.status;
    responseBody = await response.text().catch(() => '');
    success = response.ok;
  } catch (error) {
    responseBody = error instanceof Error ? error.message : 'Unknown error';
  }

  await pool.query(
    `INSERT INTO webhook_deliveries (tenant_id, webhook_id, event, payload, response_status, response_body, success, attempts)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)`,
    [tenantId, webhookId, event, payloadStr, responseStatus, responseBody?.slice(0, 1000), success, attempt]
  );

  if (!success && attempt < 3) {
    setTimeout(() => {
      deliverWebhook(tenantId, webhookId, url, secret, event, payloadStr, attempt + 1).catch(() => {});
    }, 5000 * attempt);
  }
}

export async function getWebhookDeliveries(tenantId: string, webhookId: string, limit: number = 20): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, event, response_status, success, attempts, created_at
     FROM webhook_deliveries WHERE tenant_id = $1 AND webhook_id = $2
     ORDER BY created_at DESC LIMIT $3`,
    [tenantId, webhookId, limit]
  );
  return result.rows;
}
