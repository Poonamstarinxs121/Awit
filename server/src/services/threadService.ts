import { pool } from '../db/index.js';
import { createNotification } from './notificationService.js';

export async function subscribeToThread(tenantId: string, taskId: string, subscriberId: string, subscriberType: 'agent' | 'user'): Promise<void> {
  await pool.query(
    `INSERT INTO thread_subscriptions (tenant_id, task_id, subscriber_id, subscriber_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, task_id, subscriber_id) DO NOTHING`,
    [tenantId, taskId, subscriberId, subscriberType]
  );
}

export async function unsubscribeFromThread(tenantId: string, taskId: string, subscriberId: string): Promise<void> {
  await pool.query(
    `DELETE FROM thread_subscriptions WHERE tenant_id = $1 AND task_id = $2 AND subscriber_id = $3`,
    [tenantId, taskId, subscriberId]
  );
}

export async function getThreadSubscribers(tenantId: string, taskId: string): Promise<Array<{ subscriber_id: string; subscriber_type: string }>> {
  const result = await pool.query(
    `SELECT subscriber_id, subscriber_type FROM thread_subscriptions WHERE tenant_id = $1 AND task_id = $2`,
    [tenantId, taskId]
  );
  return result.rows;
}

export async function notifyThreadSubscribers(
  tenantId: string,
  taskId: string,
  commentAuthorId: string,
  commentContent: string,
  commentId: string
): Promise<void> {
  const taskResult = await pool.query(
    `SELECT title FROM tasks WHERE id = $1 AND tenant_id = $2`,
    [taskId, tenantId]
  );
  const taskTitle = taskResult.rows[0]?.title || 'a task';

  const authorResult = await pool.query(
    `SELECT name FROM users WHERE id = $1 AND tenant_id = $2
     UNION ALL
     SELECT name FROM agents WHERE id = $1 AND tenant_id = $2
     LIMIT 1`,
    [commentAuthorId, tenantId]
  );
  const authorName = authorResult.rows[0]?.name || 'Someone';

  const subscribers = await getThreadSubscribers(tenantId, taskId);
  
  for (const sub of subscribers) {
    if (sub.subscriber_id === commentAuthorId) continue;
    
    await createNotification(
      tenantId,
      sub.subscriber_id,
      sub.subscriber_type as 'agent' | 'user',
      'status_change',
      `${authorName} commented on "${taskTitle}": ${commentContent.slice(0, 100)}${commentContent.length > 100 ? '...' : ''}`,
      taskId,
      commentId
    );
  }
}
