import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { emitDatabaseEvent } from '../services/realtimeService.js';
import { executeAgentTurn, resolveAgentMention } from '../services/orchestrationEngine.js';

const router = Router();

const MENTION_PATTERN = /@([A-Za-z0-9_][A-Za-z0-9_ -]*)/g;

function parseMentions(content: string): string[] {
  const matches = [...content.matchAll(MENTION_PATTERN)];
  return matches.map(m => m[1].trim());
}

async function getRecentChatContext(tenantId: string, limit: number = 10): Promise<string> {
  const result = await pool.query(
    `SELECT sm.content, sm.sender_type,
      CASE 
        WHEN sm.sender_type = 'agent' THEN (SELECT name FROM agents WHERE id = sm.sender_id::uuid AND tenant_id = $1)
        WHEN sm.sender_type = 'user' THEN (SELECT name FROM users WHERE id = sm.sender_id::uuid AND tenant_id = $1)
        ELSE 'Unknown'
      END AS sender_name
    FROM squad_messages sm
    WHERE sm.tenant_id = $1
    ORDER BY sm.created_at DESC
    LIMIT $2`,
    [tenantId, limit]
  );
  if (result.rows.length === 0) return '';
  const lines = result.rows.reverse().map((r: { sender_name: string; sender_type: string; content: string }) =>
    `[${r.sender_name || r.sender_type}]: ${r.content}`
  );
  return `Recent board chat:\n${lines.join('\n')}`;
}

async function postAgentResponse(tenantId: string, agentId: string, content: string): Promise<void> {
  const result = await pool.query(
    `INSERT INTO squad_messages (tenant_id, sender_type, sender_id, content)
     VALUES ($1, 'agent', $2, $3)
     RETURNING *`,
    [tenantId, agentId, content]
  );
  const message = result.rows[0];
  const nameResult = await pool.query(
    `SELECT name FROM agents WHERE id = $1::uuid AND tenant_id = $2`,
    [agentId, tenantId]
  );
  message.sender_name = nameResult.rows[0]?.name || null;
  await emitDatabaseEvent(tenantId, 'squad_chat', {
    type: 'new_message',
    message,
  });
}

async function findLeadAgent(tenantId: string): Promise<{ id: string; name: string } | null> {
  const result = await pool.query(
    `SELECT id, name FROM agents WHERE tenant_id = $1 AND status = 'active' AND level = 'lead' ORDER BY created_at ASC LIMIT 1`,
    [tenantId]
  );
  if (result.rows.length > 0) return result.rows[0];
  const fallback = await pool.query(
    `SELECT id, name FROM agents WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at ASC LIMIT 1`,
    [tenantId]
  );
  return fallback.rows[0] || null;
}

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

    if (actualSenderType === 'user') {
      const trimmedContent = content.trim();
      const mentionNames = parseMentions(trimmedContent);

      const chatContext = await getRecentChatContext(tenantId);

      let targetAgents: Array<{ id: string; name: string }> = [];

      if (mentionNames.length > 0) {
        for (const mentionName of mentionNames) {
          const mentionResult = await resolveAgentMention(tenantId, mentionName, trimmedContent);
          if (mentionResult.remote && mentionResult.dispatched) {
            await postAgentResponse(tenantId, userId, mentionResult.dispatchMessage || `Task dispatched for @${mentionName}`);
            continue;
          }
          if (mentionResult.agentId) {
            const agentResult = await pool.query(
              `SELECT id, name FROM agents WHERE id = $1 AND tenant_id = $2`,
              [mentionResult.agentId, tenantId]
            );
            if (agentResult.rows.length > 0) {
              targetAgents.push(agentResult.rows[0]);
            }
          } else {
            const agentResult = await pool.query(
              `SELECT id, name FROM agents WHERE tenant_id = $1 AND status = 'active' AND (
                LOWER(REPLACE(name, ' ', '')) = LOWER(REPLACE($2, ' ', ''))
                OR LOWER(name) = LOWER($2)
              ) LIMIT 1`,
              [tenantId, mentionName]
            );
            if (agentResult.rows.length > 0) {
              targetAgents.push(agentResult.rows[0]);
            }
          }
        }
      }

      if (targetAgents.length === 0) {
        const lead = await findLeadAgent(tenantId);
        if (lead) {
          targetAgents = [lead];
        }
      }

      for (const agent of targetAgents) {
        try {
          const prompt = chatContext
            ? `${chatContext}\n\n[User message in board chat]: ${trimmedContent}`
            : `[User message in board chat]: ${trimmedContent}`;

          const turnResult = await executeAgentTurn(
            tenantId,
            agent.id,
            prompt,
            `board-chat-${tenantId}`
          );

          await postAgentResponse(tenantId, agent.id, turnResult.response);
        } catch (agentError) {
          console.error(`[BoardChat] Agent ${agent.name} (${agent.id}) failed to respond:`, agentError instanceof Error ? agentError.message : agentError);
          await postAgentResponse(tenantId, agent.id, `Sorry, I encountered an error processing your request. Please try again.`);
        }
      }
    }
  } catch (error) {
    console.error('Create squad message error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create squad message' });
    }
  }
});

export default router;
