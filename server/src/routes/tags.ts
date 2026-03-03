import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { requireMinRole } from '../middleware/rbac.js';

const router = Router();

router.get('/', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT t.*, COUNT(tt.task_id)::int as usage_count
       FROM tags t
       LEFT JOIN task_tags tt ON tt.tag_id = t.id
       WHERE t.tenant_id = $1
       GROUP BY t.id
       ORDER BY t.name ASC`,
      [req.user!.tenantId]
    );
    res.json({ tags: result.rows });
  } catch (error) {
    console.error('List tags error:', error);
    res.status(500).json({ error: 'Failed to list tags' });
  }
});

router.post('/', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await pool.query(
      `INSERT INTO tags (tenant_id, name, color) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, name) DO UPDATE SET color = EXCLUDED.color
       RETURNING *`,
      [req.user!.tenantId, name.trim(), color ?? '#2563eb']
    );
    res.status(201).json({ tag: result.rows[0] });
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

router.patch('/:id', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;
    const result = await pool.query(
      `UPDATE tags SET
         name = COALESCE($1, name),
         color = COALESCE($2, color)
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [name ?? null, color ?? null, req.params.id, req.user!.tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tag not found' });
    res.json({ tag: result.rows[0] });
  } catch (error) {
    console.error('Update tag error:', error);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

router.delete('/:id', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `DELETE FROM tags WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.user!.tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tag not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete tag error:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

export default router;
