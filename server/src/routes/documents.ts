import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { requireMinRole } from '../middleware/rbac.js';

const router = Router();

router.get('/', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { search, type } = req.query;
    const conditions = ['d.tenant_id = $1'];
    const values: unknown[] = [tenantId];
    let paramIndex = 2;

    if (type) {
      conditions.push(`d.type = $${paramIndex}`);
      values.push(type);
      paramIndex++;
    }

    if (search) {
      conditions.push(`to_tsvector('english', d.title || ' ' || d.content) @@ plainto_tsquery('english', $${paramIndex})`);
      values.push(search);
      paramIndex++;
    }

    const result = await pool.query(
      `SELECT d.*,
              a.name as agent_name
       FROM documents d
       LEFT JOIN agents a ON d.agent_id = a.id AND a.tenant_id = d.tenant_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY d.updated_at DESC`,
      values
    );

    res.json({ documents: result.rows });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

router.post('/', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { title, content, type, task_id, agent_id } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Missing required field: title' });
      return;
    }

    const validTypes = ['deliverable', 'brief', 'research', 'protocol', 'checklist', 'note'];
    if (!type || !validTypes.includes(type)) {
      res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      return;
    }

    const result = await pool.query(
      `INSERT INTO documents (tenant_id, title, content, type, task_id, agent_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, title, content || '', type, task_id || null, agent_id || null, req.user!.userId]
    );

    res.status(201).json({ document: result.rows[0] });
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

router.get('/:id', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const docId = req.params.id;

    const result = await pool.query(
      `SELECT d.*,
              a.name as agent_name
       FROM documents d
       LEFT JOIN agents a ON d.agent_id = a.id AND a.tenant_id = d.tenant_id
       WHERE d.id = $1 AND d.tenant_id = $2`,
      [docId, tenantId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json({ document: result.rows[0] });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

router.patch('/:id', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const docId = req.params.id;

    const existingResult = await pool.query(
      `SELECT id FROM documents WHERE id = $1 AND tenant_id = $2`,
      [docId, tenantId]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const allowedFields = ['title', 'content', 'type', 'task_id', 'agent_id'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    updates.push(`updated_at = now()`);
    values.push(docId, tenantId);

    const result = await pool.query(
      `UPDATE documents SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      values
    );

    res.json({ document: result.rows[0] });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

router.delete('/:id', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const docId = req.params.id;

    const result = await pool.query(
      `DELETE FROM documents WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [docId, tenantId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
