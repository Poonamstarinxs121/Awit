import { Router, Request, Response } from 'express';
import { listProviders, connectProvider, disconnectProvider, getUsageStats, getUsageByAgent } from '../services/configService.js';
import { requireMinRole } from '../middleware/rbac.js';

const router = Router();

router.get('/providers', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const providers = await listProviders(req.user!.tenantId);
    res.json({ providers });
  } catch (error) {
    console.error('List providers error:', error);
    res.status(500).json({ error: 'Failed to list providers' });
  }
});

router.post('/providers', requireMinRole('owner'), async (req: Request, res: Response) => {
  try {
    const { provider, api_key } = req.body;

    if (!provider || !api_key) {
      res.status(400).json({ error: 'Missing required fields: provider, api_key' });
      return;
    }

    const result = await connectProvider(req.user!.tenantId, provider, api_key);
    res.status(201).json({ provider: result });
  } catch (error) {
    console.error('Connect provider error:', error);
    res.status(500).json({ error: 'Failed to connect provider' });
  }
});

router.delete('/providers/:id', requireMinRole('owner'), async (req: Request, res: Response) => {
  try {
    const result = await disconnectProvider(req.user!.tenantId, req.params.id);
    if (!result) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }
    res.json({ provider: result });
  } catch (error) {
    console.error('Disconnect provider error:', error);
    res.status(500).json({ error: 'Failed to disconnect provider' });
  }
});

router.get('/usage', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const usage = await getUsageStats(req.user!.tenantId);
    res.json({ usage });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ error: 'Failed to get usage stats' });
  }
});

router.get('/usage/by-agent', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const data = await getUsageByAgent(req.user!.tenantId);
    res.json({ usage: data });
  } catch (error) {
    console.error('Get usage by agent error:', error);
    res.status(500).json({ error: 'Failed to get usage by agent' });
  }
});

export default router;
