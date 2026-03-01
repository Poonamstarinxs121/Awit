import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { emitDatabaseEvent } from '../services/realtimeService.js';

const router = Router();

router.get('/messages', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const result = await pool.query(
      `SELECT sm.*,
        CASE 
          WHEN sm.sender_type = 'agent' THEN (SELECT name FROM agents WHERE id = sm.sender_id::uuid AND tenant_id = $1)
          WHEN sm.sender_type = 'user' THEN (SELECT name FROM users WHERE id = sm.sender_id::uuid AND tenant_id = $1)
          ELSE NULL
        END AS sender_name
      FROM squad_messages sm
      WHERE sm.tenant_id = $1
      ORDER BY sm.created_at DESC
      LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM squad_messages WHERE tenant_id = $1`,
      [tenantId]
    );

    res.json({
      messages: result.rows.reverse(),
      total: countResult.rows[0].total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('List squad messages error:', error);
    res.status(500).json({ error: 'Failed to list squad messages' });
  }
});

router.post('/messages', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { content, sender_type, sender_id } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const actualSenderType = sender_type || 'user';
    const actualSenderId = sender_id || userId;

    if (!['user', 'agent'].includes(actualSenderType)) {
      res.status(400).json({ error: 'sender_type must be "user" or "agent"' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO squad_messages (tenant_id, sender_type, sender_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenantId, actualSenderType, actualSenderId, content.trim()]
    );

    const message = result.rows[0];

    const nameResult = await pool.query(
      actualSenderType === 'agent'
        ? `SELECT name FROM agents WHERE id = $1::uuid AND tenant_id = $2`
        : `SELECT name FROM users WHERE id = $1::uuid AND tenant_id = $2`,
      [actualSenderId, tenantId]
    );
    message.sender_name = nameResult.rows[0]?.name || null;

    await emitDatabaseEvent(tenantId, 'squad_chat', {
      type: 'new_message',
      message,
    });

    res.status(201).json({ message });
  } catch (error) {
    console.error('Create squad message error:', error);
    res.status(500).json({ error: 'Failed to create squad message' });
  }
});

export default router;
