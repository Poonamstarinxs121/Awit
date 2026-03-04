import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { tenantId } = req as any;
    const { start, end } = req.query;

    let query = `
      SELECT id, tenant_id, title, description, event_type, start_at, end_at, all_day, color,
             related_task_id, related_agent_id, created_at
      FROM calendar_events
      WHERE tenant_id = $1
    `;
    const params: unknown[] = [tenantId];

    if (start) {
      params.push(start);
      query += ` AND start_at >= $${params.length}`;
    }
    if (end) {
      params.push(end);
      query += ` AND start_at <= $${params.length}`;
    }

    query += ` ORDER BY start_at ASC`;

    const result = await pool.query(query, params);
    res.json({ events: result.rows });
  } catch (err) {
    console.error('GET /calendar-events error:', err);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { tenantId } = req as any;
    const { title, description, event_type, start_at, end_at, all_day, color, related_task_id, related_agent_id } = req.body;

    if (!title || !start_at) {
      return res.status(400).json({ error: 'title and start_at are required' });
    }

    const result = await pool.query(
      `INSERT INTO calendar_events
        (tenant_id, title, description, event_type, start_at, end_at, all_day, color, related_task_id, related_agent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        tenantId,
        title,
        description || '',
        event_type || 'event',
        start_at,
        end_at || null,
        all_day || false,
        color || null,
        related_task_id || null,
        related_agent_id || null,
      ]
    );

    res.status(201).json({ event: result.rows[0] });
  } catch (err) {
    console.error('POST /calendar-events error:', err);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { tenantId } = req as any;
    const { id } = req.params;
    const { title, description, event_type, start_at, end_at, all_day, color, related_task_id, related_agent_id } = req.body;

    const existing = await pool.query(
      `SELECT id FROM calendar_events WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (event_type !== undefined) { fields.push(`event_type = $${idx++}`); values.push(event_type); }
    if (start_at !== undefined) { fields.push(`start_at = $${idx++}`); values.push(start_at); }
    if (end_at !== undefined) { fields.push(`end_at = $${idx++}`); values.push(end_at); }
    if (all_day !== undefined) { fields.push(`all_day = $${idx++}`); values.push(all_day); }
    if (color !== undefined) { fields.push(`color = $${idx++}`); values.push(color); }
    if (related_task_id !== undefined) { fields.push(`related_task_id = $${idx++}`); values.push(related_task_id || null); }
    if (related_agent_id !== undefined) { fields.push(`related_agent_id = $${idx++}`); values.push(related_agent_id || null); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id, tenantId);
    const result = await pool.query(
      `UPDATE calendar_events SET ${fields.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      values
    );

    res.json({ event: result.rows[0] });
  } catch (err) {
    console.error('PATCH /calendar-events/:id error:', err);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { tenantId } = req as any;
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM calendar_events WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /calendar-events/:id error:', err);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

export default router;
