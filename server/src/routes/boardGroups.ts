import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { requireMinRole } from '../middleware/rbac.js';

const router = Router();

router.get('/', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT bg.*,
              COUNT(t.id)::int as task_count
       FROM board_groups bg
       LEFT JOIN tasks t ON t.board_group_id = bg.id AND t.tenant_id = bg.tenant_id
       WHERE bg.tenant_id = $1
       GROUP BY bg.id
       ORDER BY bg.created_at ASC`,
      [req.user!.tenantId]
    );
    res.json({ board_groups: result.rows });
  } catch (error) {
    console.error('List board groups error:', error);
    res.status(500).json({ error: 'Failed to list board groups' });
  }
});

router.post('/', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await pool.query(
      `INSERT INTO board_groups (tenant_id, name, description, color)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user!.tenantId, name, description ?? null, color ?? '#2563eb']
    );
    res.status(201).json({ board_group: result.rows[0] });
  } catch (error) {
    console.error('Create board group error:', error);
    res.status(500).json({ error: 'Failed to create board group' });
  }
});

router.patch('/:id', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const { name, description, color } = req.body;
    const result = await pool.query(
      `UPDATE board_groups
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           color = COALESCE($3, color)
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [name ?? null, description ?? null, color ?? null, req.params.id, req.user!.tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Board group not found' });
    res.json({ board_group: result.rows[0] });
  } catch (error) {
    console.error('Update board group error:', error);
    res.status(500).json({ error: 'Failed to update board group' });
  }
});

router.delete('/:id', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `DELETE FROM board_groups WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.user!.tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Board group not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete board group error:', error);
    res.status(500).json({ error: 'Failed to delete board group' });
  }
});

router.get('/:id/tasks', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT t.*, ARRAY_AGG(DISTINCT jsonb_build_object('id', a.id, 'name', a.name)) FILTER (WHERE a.id IS NOT NULL) as assignee_agents
       FROM tasks t
       LEFT JOIN agents a ON a.id = ANY(t.assignees::uuid[]) AND a.tenant_id = t.tenant_id
       WHERE t.board_group_id = $1 AND t.tenant_id = $2
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      [req.params.id, req.user!.tenantId]
    );
    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get board group tasks error:', error);
    res.status(500).json({ error: 'Failed to get board group tasks' });
  }
});

export default router;
