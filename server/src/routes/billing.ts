import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
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
