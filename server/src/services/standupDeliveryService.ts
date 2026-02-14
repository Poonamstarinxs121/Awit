import { pool } from '../db/index.js';
import { broadcastToTenant } from './telegramService.js';

interface DeliveryConfig {
  email_enabled: boolean;
  email_recipients: string[];
  slack_webhook_url: string | null;
  slack_enabled: boolean;
  telegram_enabled: boolean;
}

export async function getDeliveryConfig(tenantId: string): Promise<DeliveryConfig> {
  const result = await pool.query(
    `SELECT key, value FROM tenant_settings WHERE tenant_id = $1 AND key LIKE 'standup_delivery_%'`,
    [tenantId]
  );

  const settings: Record<string, string> = {};
  result.rows.forEach((r: any) => { settings[r.key] = r.value; });

  return {
    email_enabled: settings['standup_delivery_email_enabled'] === 'true',
    email_recipients: settings['standup_delivery_email_recipients'] ? JSON.parse(settings['standup_delivery_email_recipients']) : [],
    slack_webhook_url: settings['standup_delivery_slack_webhook'] || null,
    slack_enabled: settings['standup_delivery_slack_enabled'] === 'true',
    telegram_enabled: settings['standup_delivery_telegram_enabled'] === 'true',
  };
}

export async function saveDeliveryConfig(tenantId: string, config: Partial<DeliveryConfig>): Promise<void> {
  const mappings: Record<string, string> = {};
  if (config.email_enabled !== undefined) mappings['standup_delivery_email_enabled'] = String(config.email_enabled);
  if (config.email_recipients !== undefined) mappings['standup_delivery_email_recipients'] = JSON.stringify(config.email_recipients);
  if (config.slack_webhook_url !== undefined) mappings['standup_delivery_slack_webhook'] = config.slack_webhook_url || '';
  if (config.slack_enabled !== undefined) mappings['standup_delivery_slack_enabled'] = String(config.slack_enabled);
  if (config.telegram_enabled !== undefined) mappings['standup_delivery_telegram_enabled'] = String(config.telegram_enabled);

  for (const [key, value] of Object.entries(mappings)) {
    await pool.query(
      `INSERT INTO tenant_settings (tenant_id, key, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = $3, updated_at = NOW()`,
      [tenantId, key, value]
    );
  }
}

async function sendSlackStandup(webhookUrl: string, standupText: string, date: string): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🦑 *SquidJob Daily Standup - ${date}*\n\n${standupText}`,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Slack standup delivery failed:', error);
    return false;
  }
}

async function sendEmailStandup(tenantId: string, recipients: string[], standupText: string, date: string): Promise<boolean> {
  const keyResult = await pool.query(
    `SELECT value FROM tenant_settings WHERE tenant_id = $1 AND key = 'resend_api_key'`,
    [tenantId]
  );

  if (keyResult.rows.length === 0 || !keyResult.rows[0].value) {
    console.log(`No Resend API key configured for tenant ${tenantId}, skipping email delivery`);
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyResult.rows[0].value}`,
      },
      body: JSON.stringify({
        from: 'SquidJob <standups@squidjob.com>',
        to: recipients,
        subject: `SquidJob Daily Standup - ${date}`,
        text: standupText,
        html: `<h2>🦑 SquidJob Daily Standup - ${date}</h2><pre>${standupText}</pre>`,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Email standup delivery failed:', error);
    return false;
  }
}

async function sendTelegramStandup(tenantId: string, standupText: string, date: string): Promise<boolean> {
  try {
    await broadcastToTenant(tenantId, `🦑 *SquidJob Daily Standup - ${date}*\n\n${standupText}`);
    return true;
  } catch (error) {
    console.error('Telegram standup delivery failed:', error);
    return false;
  }
}

export async function deliverStandup(tenantId: string, standupText: string, date: string): Promise<{ email: boolean; slack: boolean; telegram: boolean }> {
  const config = await getDeliveryConfig(tenantId);
  const results = { email: false, slack: false, telegram: false };

  const promises: Promise<void>[] = [];

  if (config.email_enabled && config.email_recipients.length > 0) {
    promises.push(
      sendEmailStandup(tenantId, config.email_recipients, standupText, date)
        .then(ok => { results.email = ok; })
    );
  }

  if (config.slack_enabled && config.slack_webhook_url) {
    promises.push(
      sendSlackStandup(config.slack_webhook_url, standupText, date)
        .then(ok => { results.slack = ok; })
    );
  }

  if (config.telegram_enabled) {
    promises.push(
      sendTelegramStandup(tenantId, standupText, date)
        .then(ok => { results.telegram = ok; })
    );
  }

  await Promise.allSettled(promises);
  return results;
}
