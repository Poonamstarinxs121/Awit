import Stripe from 'stripe';
import { pool } from '../db/index.js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

export const PLANS = {
  starter: {
    name: 'Starter',
    price: '$49/month',
    priceId: process.env.STRIPE_PRICE_STARTER || '',
    agents: 10,
    tasks: 500,
    features: ['10 AI agents', '500 tasks/month', 'BYOK API keys', 'Webhooks', 'Telegram integration'],
  },
  professional: {
    name: 'Professional',
    price: '$149/month',
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL || '',
    agents: 50,
    tasks: 5000,
    features: ['50 AI agents', '5,000 tasks/month', 'Everything in Starter', 'SSH machine registry', 'WhatsApp integration', 'Priority support'],
  },
  enterprise: {
    name: 'Enterprise',
    price: 'Custom',
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || '',
    agents: -1,
    tasks: -1,
    features: ['Unlimited agents', 'Unlimited tasks', 'Everything in Professional', 'SLA guarantee', 'Dedicated support'],
  },
};

function getStripe(): Stripe | null {
  if (!STRIPE_SECRET_KEY) return null;
  return new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.acacia' as any });
}

export async function getOrCreateCustomer(tenantId: string, email: string, name: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

  const subResult = await pool.query(
    `SELECT stripe_customer_id FROM subscriptions WHERE tenant_id = $1`,
    [tenantId]
  );

  if (subResult.rows.length > 0 && subResult.rows[0].stripe_customer_id) {
    return subResult.rows[0].stripe_customer_id;
  }

  const customer = await stripe.customers.create({ email, name, metadata: { tenant_id: tenantId } });
  return customer.id;
}

export async function createCheckoutSession(
  tenantId: string,
  plan: 'starter' | 'professional' | 'enterprise',
  userEmail: string,
  userName: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

  const planConfig = PLANS[plan];
  if (!planConfig.priceId) throw new Error(`Price ID for plan "${plan}" not configured`);

  const customerId = await getOrCreateCustomer(tenantId, userEmail, userName);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tenant_id: tenantId, plan },
  });

  return session.url!;
}

export async function createBillingPortalSession(tenantId: string, returnUrl: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

  const subResult = await pool.query(
    `SELECT stripe_customer_id FROM subscriptions WHERE tenant_id = $1`,
    [tenantId]
  );

  if (subResult.rows.length === 0 || !subResult.rows[0].stripe_customer_id) {
    throw new Error('No billing account found for this tenant');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subResult.rows[0].stripe_customer_id,
    return_url: returnUrl,
  });

  return session.url;
}

export async function handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');
  if (!STRIPE_WEBHOOK_SECRET) throw new Error('Stripe webhook secret not configured');

  const event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const tenantId = session.metadata?.tenant_id;
    const plan = session.metadata?.plan ?? 'starter';
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!tenantId) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const subAny = subscription as any;
    const periodEnd = new Date((subAny.current_period_end as number) * 1000);

    await pool.query(
      `INSERT INTO subscriptions (tenant_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
       VALUES ($1, $2, $3, $4, 'active', $5)
       ON CONFLICT (tenant_id) DO UPDATE SET
         stripe_customer_id = EXCLUDED.stripe_customer_id,
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         plan = EXCLUDED.plan,
         status = 'active',
         current_period_end = EXCLUDED.current_period_end,
         updated_at = NOW()`,
      [tenantId, customerId, subscriptionId, plan, periodEnd]
    );

    await pool.query(`UPDATE tenants SET plan = $1 WHERE id = $2`, [plan, tenantId]);
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;

    const subResult = await pool.query(
      `SELECT tenant_id FROM subscriptions WHERE stripe_customer_id = $1`,
      [customerId]
    );
    if (subResult.rows.length === 0) return;

    const tenantId = subResult.rows[0].tenant_id;
    const subAny2 = sub as any;
    const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status;
    const periodEnd = subAny2.current_period_end ? new Date(subAny2.current_period_end * 1000) : null;

    await pool.query(
      `UPDATE subscriptions SET status = $1, current_period_end = $2, updated_at = NOW()
       WHERE tenant_id = $3`,
      [status, periodEnd, tenantId]
    );
  }
}

export async function getSubscription(tenantId: string) {
  const result = await pool.query(
    `SELECT * FROM subscriptions WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows[0] ?? null;
}

export async function getCustomerInvoices(customerId: string) {
  const stripe = getStripe();
  if (!stripe) return [];
  try {
    const invoices = await stripe.invoices.list({ customer: customerId, limit: 24 });
    return invoices.data.map((inv: any) => ({
      id: inv.id,
      number: inv.number,
      amount_paid: inv.amount_paid,
      amount_due: inv.amount_due,
      currency: inv.currency,
      status: inv.status,
      created: inv.created,
      period_start: inv.period_start,
      period_end: inv.period_end,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
    }));
  } catch {
    return [];
  }
}

export { STRIPE_WEBHOOK_SECRET };
