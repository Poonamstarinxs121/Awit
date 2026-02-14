import { pool } from '../db/index.js';
import { executeAgentTurn } from './orchestrationEngine.js';
import { logActivity } from './activityService.js';
import { subscribeToThread } from './threadService.js';

export async function createNotification(
  tenantId: string,
  recipientId: string,
  recipientType: 'agent' | 'user',
  type: 'mention' | 'assignment' | 'review_request' | 'status_change' | 'standup',
  message: string,
  sourceTaskId?: string,
  sourceCommentId?: string
): Promise<{ id: string }> {
  const result = await pool.query(
    `INSERT INTO notifications (tenant_id, recipient_id, recipient_type, type, message, source_task_id, source_comment_id, is_read)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false)
     RETURNING id`,
    [tenantId, recipientId, recipientType, type, message, sourceTaskId || null, sourceCommentId || null]
  );
  return result.rows[0];
}

export async function parseMentionsAndNotify(
  tenantId: string,
  commentContent: string,
  taskId: string,
  commentId: string,
  authorId: string
): Promise<string[]> {
  const mentionPattern = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionPattern.exec(commentContent)) !== null) {
    mentions.push(match[1]);
  }
  
  if (mentions.length === 0) return [];

  const agents = await pool.query(
    `SELECT id, name FROM agents WHERE tenant_id = $1 AND status = 'active' AND LOWER(name) = ANY($2)`,
    [tenantId, mentions.map(m => m.toLowerCase())]
  );

  const taskResult = await pool.query(
    `SELECT title, description FROM tasks WHERE id = $1 AND tenant_id = $2`,
    [taskId, tenantId]
  );
  const task = taskResult.rows[0];

  const authorResult = await pool.query(
    `SELECT name FROM users WHERE id = $1 AND tenant_id = $2
     UNION ALL
     SELECT name FROM agents WHERE id = $1 AND tenant_id = $2
     LIMIT 1`,
    [authorId, tenantId]
  );
  const authorName = authorResult.rows[0]?.name || 'Someone';

  const mentionedAgentIds: string[] = [];

  for (const agent of agents.rows) {
    await createNotification(
      tenantId,
      agent.id,
      'agent',
      'mention',
      `${authorName} mentioned you in a comment on "${task?.title || 'a task'}"`,
      taskId,
      commentId
    );

    triggerAgentMentionResponse(tenantId, agent.id, agent.name, commentContent, taskId, task, authorName)
      .catch(err => console.error(`Failed to trigger mention response for ${agent.name}:`, err));

    mentionedAgentIds.push(agent.id);
  }

  return mentionedAgentIds;
}

async function triggerAgentMentionResponse(
  tenantId: string,
  agentId: string,
  agentName: string,
  commentContent: string,
  taskId: string,
  task: { title: string; description: string } | undefined,
  authorName: string
): Promise<void> {
  const prompt = `You were @mentioned in a task comment.

Task: ${task?.title || 'Unknown'}
${task?.description ? `Description: ${task.description}` : ''}

${authorName} said: "${commentContent}"

Please respond helpfully to this mention. If they asked a question, answer it. If they requested action, explain what you'd do.`;

  try {
    const result = await executeAgentTurn(tenantId, agentId, prompt, `mention-${taskId}`);
    
    await pool.query(
      `INSERT INTO comments (tenant_id, task_id, author_id, content, mentions)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, taskId, agentId, result.response, []]
    );

    await subscribeToThread(tenantId, taskId, agentId, 'agent');

    await logActivity(tenantId, agentId, 'mention_response', 'task', taskId, {
      response_preview: result.response.slice(0, 200),
      mentioned_by: authorName,
    });
  } catch (error) {
    console.error(`Agent ${agentName} mention response failed:`, error instanceof Error ? error.message : error);
  }
}

export async function getNotifications(tenantId: string, recipientId: string, options: { unreadOnly?: boolean; limit?: number } = {}) {
  const conditions = ['tenant_id = $1', 'recipient_id = $2'];
  const values: unknown[] = [tenantId, recipientId];
  
  if (options.unreadOnly) {
    conditions.push('is_read = false');
  }
  
  const limit = options.limit || 50;
  values.push(limit);

  const result = await pool.query(
    `SELECT * FROM notifications WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${values.length}`,
    values
  );
  return result.rows;
}

export async function markNotificationsRead(tenantId: string, recipientId: string, notificationIds?: string[]) {
  if (notificationIds && notificationIds.length > 0) {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE tenant_id = $1 AND recipient_id = $2 AND id = ANY($3)`,
      [tenantId, recipientId, notificationIds]
    );
  } else {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE tenant_id = $1 AND recipient_id = $2`,
      [tenantId, recipientId]
    );
  }
}

export async function getUnreadCount(tenantId: string, recipientId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int as count FROM notifications WHERE tenant_id = $1 AND recipient_id = $2 AND is_read = false`,
    [tenantId, recipientId]
  );
  return result.rows[0].count;
}
