import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const boardGroupId = req.query.board_group_id as string | undefined;
    let query = `SELECT bm.*, u.name as creator_name, u.email as creator_email
                 FROM board_memories bm
                 LEFT JOIN users u ON bm.created_by = u.id
                 WHERE bm.tenant_id = $1`;
    const params: any[] = [tenantId];
    if (boardGroupId) {
      query += ` AND bm.board_group_id = $2`;
      params.push(boardGroupId);
    }
    query += ` ORDER BY bm.created_at DESC`;
    const result = await pool.query(query, params);
    res.json({ memories: result.rows });
  } catch (error) {
    console.error('List board memories error:', error);
    res.status(500).json({ error: 'Failed to list board memories' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { board_group_id, title, content, memory_type } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: 'Title and content are required' });
      return;
    }
    const validTypes = ['note', 'decision', 'context', 'reference'];
    const type = validTypes.includes(memory_type) ? memory_type : 'note';
    const result = await pool.query(
      `INSERT INTO board_memories (tenant_id, board_group_id, title, content, memory_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenantId, board_group_id || null, title, content, type, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create board memory error:', error);
    res.status(500).json({ error: 'Failed to create board memory' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { title, content, memory_type } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (title !== undefined) { updates.push(`title = $${idx++}`); params.push(title); }
    if (content !== undefined) { updates.push(`content = $${idx++}`); params.push(content); }
    if (memory_type !== undefined) { updates.push(`memory_type = $${idx++}`); params.push(memory_type); }
    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    updates.push(`updated_at = NOW()`);
    params.push(req.params.id, tenantId);
    const result = await pool.query(
      `UPDATE board_memories SET ${updates.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      params
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Memory not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update board memory error:', error);
    res.status(500).json({ error: 'Failed to update board memory' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const result = await pool.query(
      'DELETE FROM board_memories WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [req.params.id, tenantId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Memory not found' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete board memory error:', error);
    res.status(500).json({ error: 'Failed to delete board memory' });
  }
});

export default router;
