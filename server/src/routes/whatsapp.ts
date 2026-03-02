import { Router, Request, Response } from 'express';
import { requireMinRole } from '../middleware/rbac.js';
import {
  configureWhatsapp,
  getWhatsappConfig,
  removeWhatsappConfig,
  sendWhatsappMessage,
  processIncomingWhatsapp,
  getTenantByWhatsappNumber,
} from '../services/whatsappService.js';

const publicRouter = Router();
const router = Router();

publicRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    const to: string = req.body.To || '';
    const from: string = req.body.From || '';
    const body: string = req.body.Body || '';

    if (!from || !body) {
      res.set('Content-Type', 'text/xml');
      res.send('<Response></Response>');
      return;
    }

    const tenantId = await getTenantByWhatsappNumber(to);
    if (tenantId) {
      processIncomingWhatsapp(tenantId, from, body).catch((err) => {
        console.error('WhatsApp message processing error:', err);
      });
    } else {
      console.log(`No tenant found for WhatsApp number: ${to}`);
    }

    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  }
});

router.get('/config', async (req: Request, res: Response) => {
  try {
    const config = await getWhatsappConfig(req.user!.tenantId);
    res.json({ config });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get WhatsApp config' });
  }
});

router.post('/connect', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const { account_sid, auth_token, whatsapp_number } = req.body;
    if (!account_sid || !auth_token || !whatsapp_number) {
      res.status(400).json({ error: 'account_sid, auth_token, and whatsapp_number are required' });
      return;
    }
    const config = await configureWhatsapp(req.user!.tenantId, account_sid, auth_token, whatsapp_number);
    res.json({ config });
  } catch (error) {
    res.status(500).json({ error: 'Failed to configure WhatsApp' });
  }
});

router.delete('/disconnect', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    await removeWhatsappConfig(req.user!.tenantId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect WhatsApp' });
  }
});

router.post('/test', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body;
    if (!to) {
      res.status(400).json({ error: 'to is required' });
      return;
    }
    const success = await sendWhatsappMessage(req.user!.tenantId, to, message || '🦑 Test message from SquidJob!');
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send test message' });
  }
});

export { publicRouter as whatsappWebhookRouter };
export default router;
