import { Router, Request, Response } from 'express';
import { listAgents, createAgent, getAgent, updateAgent, getAgentStats } from '../services/agentService.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const agents = await listAgents(req.user!.tenantId);
    res.json({ agents });
  } catch (error) {
    console.error('List agents error:', error);
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, role, soul_md, agents_md, tools_md, heartbeat_md, model_config, level } = req.body;

    if (!name || !role) {
      res.status(400).json({ error: 'Missing required fields: name, role' });
      return;
    }

    const agent = await createAgent(req.user!.tenantId, {
      name, role, soul_md, agents_md, tools_md, heartbeat_md, model_config, level,
    });
    res.status(201).json({ agent });
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getAgentStats(req.user!.tenantId, req.params.id);
    res.json({ stats });
  } catch (error) {
    console.error('Get agent stats error:', error);
    res.status(500).json({ error: 'Failed to get agent stats' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const agent = await getAgent(req.user!.tenantId, req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json({ agent });
  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const agent = await updateAgent(req.user!.tenantId, req.params.id, req.body);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found or no changes provided' });
      return;
    }
    res.json({ agent });
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

export default router;
