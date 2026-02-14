import { emitDatabaseEvent } from './realtimeService.js';

export async function emitTaskEvent(tenantId: string, action: string, task: unknown) {
  await emitDatabaseEvent(tenantId, 'tasks', { action, task });
}

export async function emitActivityEvent(tenantId: string, activity: unknown) {
  await emitDatabaseEvent(tenantId, 'activity', { activity });
}

export async function emitAgentEvent(tenantId: string, action: string, agent: unknown) {
  await emitDatabaseEvent(tenantId, 'agents', { action, agent });
}

export async function emitNotificationEvent(tenantId: string, notification: unknown) {
  await emitDatabaseEvent(tenantId, 'notifications', { notification });
}
