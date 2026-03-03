import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { pool } from '../db/index.js';
import {
  createCheckoutSession,
  createBillingPortalSession,
  handleWebhookEvent,
  getSubscription,
  PLANS,
  STRIPE_WEBHOOK_SECRET,
} from '../services/stripeService.js';

const router = Router();

router.get('/plans', (_req: Request, res: Response) => {
  res.json({ plans: PLANS });
});

router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sub = await getSubscription(tenantId);
    const events: any[] = [];

    if (sub) {
      const planConfig = PLANS[sub.plan as keyof typeof PLANS];
      const price = planConfig?.price ?? 'Custom';

      if (sub.status === 'active' && sub.current_period_end) {
        events.push({
          id: 'next-renewal',
          type: 'upcoming',
          description: `${planConfig?.name ?? sub.plan} plan renewal`,
          amount: price,
          date: sub.current_period_end,
          status: 'scheduled',
        });
      }

      events.push({
        id: 'sub-created',
        type: 'subscription',
        description: `Subscribed to ${planConfig?.name ?? sub.plan} plan`,
        amount: price,
        date: sub.created_at,
        status: sub.status === 'active' ? 'paid' : sub.status,
      });

      if (sub.updated_at && sub.updated_at !== sub.created_at) {
        events.push({
          id: 'sub-updated',
          type: 'update',
          description: `Subscription ${sub.status === 'canceled' ? 'canceled' : 'updated'}`,
          amount: price,
          date: sub.updated_at,
          status: sub.status,
        });
      }
    }

    const usageResult = await pool.query(
      `SELECT SUM(estimated_cost::numeric) as total_cost, COUNT(*) as days
       FROM usage_records WHERE tenant_id = $1`,
      [tenantId]
    );
    const totalUsageCost = Number(usageResult.rows[0]?.total_cost ?? 0);

    res.json({
      events,
      summary: {
        current_plan: sub?.plan ?? 'starter',
        status: sub?.status ?? 'active',
        next_billing_date: sub?.current_period_end ?? null,
        total_usage_cost: totalUsageCost,
        stripe_connected: !!sub?.stripe_customer_id,
      },
    });
  } catch (error) {
    console.error('Billing history error:', error);
    res.status(500).json({ error: 'Failed to get billing history' });
  }
});

router.get('/subscription', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sub = await getSubscription(req.user!.tenantId);
    res.json({ subscription: sub });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

router.post('/checkout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { plan, success_url, cancel_url } = req.body;
    if (!plan || !PLANS[plan as keyof typeof PLANS]) {
      res.status(400).json({ error: 'Invalid plan' });
      return;
    }

    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const url = await createCheckoutSession(
      req.user!.tenantId,
      plan as 'starter' | 'professional' | 'enterprise',
      req.user!.email,
      req.user!.name,
      success_url || `${baseUrl}/subscription?success=1`,
      cancel_url || `${baseUrl}/subscription?canceled=1`
    );

    res.json({ url });
  } catch (error) {
    console.error('Checkout error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to create checkout session';
    res.status(500).json({ error: msg });
  }
});

router.post('/portal', authMiddleware, async (req: Request, res: Response) => {
  try {
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const { return_url } = req.body;
    const url = await createBillingPortalSession(
      req.user!.tenantId,
      return_url || `${baseUrl}/subscription`
    );
    res.json({ url });
  } catch (error) {
    console.error('Portal error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to create billing portal session';
    res.status(500).json({ error: msg });
  }
});

router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  if (!STRIPE_WEBHOOK_SECRET) {
    res.status(400).json({ error: 'Stripe webhook secret not configured' });
    return;
  }

  try {
    await handleWebhookEvent(req.body as Buffer, sig);
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    const msg = error instanceof Error ? error.message : 'Webhook processing failed';
    res.status(400).json({ error: msg });
  }
});

export default router;
