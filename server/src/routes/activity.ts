import { Router, Request, Response } from 'express';
import { listActivities } from '../services/activityService.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit, offset, agent_id, action } = req.query;

    const activities = await listActivities(req.user!.tenantId, {
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
      agent_id: agent_id as string | undefined,
      action: action as string | undefined,
    });

    res.json({ activities });
  } catch (error) {
    console.error('List activities error:', error);
    res.status(500).json({ error: 'Failed to list activities' });
  }
});

export default router;
