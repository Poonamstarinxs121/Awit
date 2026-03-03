import { Router, Request, Response } from 'express';
import { requireMinRole } from '../middleware/rbac.js';
import {
  createApproval,
  getApprovals,
  getPendingCount,
  reviewApproval,
} from '../services/approvalsService.js';

const router = Router();

router.get('/count', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const pending = await getPendingCount(req.user!.tenantId);
    res.json({ pending });
  } catch (error) {
    console.error('Approvals count error:', error);
    res.status(500).json({ error: 'Failed to get approval count' });
  }
});

router.get('/', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const approvals = await getApprovals(req.user!.tenantId, status as string | undefined);
    res.json({ approvals });
  } catch (error) {
    console.error('List approvals error:', error);
    res.status(500).json({ error: 'Failed to list approvals' });
  }
});

router.post('/', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const { title, description, action_type, payload, requested_by_agent_id } = req.body;
    if (!title || !action_type) {
      return res.status(400).json({ error: 'title and action_type are required' });
    }
    const approval = await createApproval(req.user!.tenantId, {
      title,
      description,
      action_type,
      payload,
      requested_by_agent_id,
    });
    res.status(201).json({ approval });
  } catch (error) {
    console.error('Create approval error:', error);
    res.status(500).json({ error: 'Failed to create approval' });
  }
});

router.patch('/:id', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const { decision } = req.body;
    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be approved or rejected' });
    }
    const approval = await reviewApproval(
      req.user!.tenantId,
      req.params.id,
      req.user!.id,
      decision
    );
    if (!approval) {
      return res.status(404).json({ error: 'Approval not found or already reviewed' });
    }
    res.json({ approval });
  } catch (error) {
    console.error('Review approval error:', error);
    res.status(500).json({ error: 'Failed to review approval' });
  }
});

export default router;
