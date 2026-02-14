import { Router, Request, Response } from 'express';
import { requireMinRole } from '../middleware/rbac.js';
import { registerWebhook, listWebhooks, updateWebhook, deleteWebhook, getWebhookDeliveries } from '../services/webhookService.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const webhooks = await listWebhooks(req.user!.tenantId);
    res.json(webhooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

router.post('/', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const { url, events, secret } = req.body;
    if (!url || !events || events.length === 0) {
      res.status(400).json({ error: 'URL and events are required' });
      return;
    }
    const webhook = await registerWebhook(req.user!.tenantId, url, events, secret);
    res.status(201).json(webhook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to register webhook' });
  }
});

router.patch('/:id', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const webhook = await updateWebhook(req.user!.tenantId, req.params.id, req.body);
    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }
    res.json(webhook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

router.delete('/:id', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const deleted = await deleteWebhook(req.user!.tenantId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

router.get('/:id/deliveries', async (req: Request, res: Response) => {
  try {
    const deliveries = await getWebhookDeliveries(req.user!.tenantId, req.params.id);
    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load deliveries' });
  }
});

export default router;
