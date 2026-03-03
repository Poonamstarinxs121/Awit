import { NODE_CONFIG, isHubConfigured } from '../config/node';
import { insertActivity } from './local-db';

interface DispatchRecord {
  id: string;
  task_id: string;
  node_id: string;
  status: string;
  task_title?: string;
  task_description?: string;
  task_priority?: string;
  dispatched_at?: string;
  created_at?: string;
}

interface LocalDispatchRecord {
  dispatch_id: string;
  task_id: string;
  task_title: string;
  task_description: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  result: string | null;
  error: string | null;
}

const localDispatchHistory: LocalDispatchRecord[] = [];
const MAX_HISTORY = 200;

export function getLocalDispatchHistory(): LocalDispatchRecord[] {
  return [...localDispatchHistory].reverse();
}

async function patchDispatchStatus(
  dispatchId: string,
  status: string,
  extras?: { result?: any; error?: string }
): Promise<boolean> {
  try {
    const res = await fetch(
      `${NODE_CONFIG.hubUrl}/v1/task-dispatches/${dispatchId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${NODE_CONFIG.hubApiKey}`,
        },
        body: JSON.stringify({ status, ...extras }),
      }
    );
    return res.ok;
  } catch (err) {
    console.error('[DispatchWorker] Failed to patch dispatch status:', err);
    return false;
  }
}

async function executeTask(dispatch: DispatchRecord): Promise<{ result: any; error?: string }> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const description = dispatch.task_description || '';
  const isCommand = description.startsWith('$') || description.startsWith('!');

  if (isCommand) {
    const command = description.replace(/^[!$]\s*/, '');
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: NODE_CONFIG.openclawDir,
        timeout: 30000,
      });
      return { result: { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 } };
    } catch (err: any) {
      return {
        result: { stdout: err.stdout?.trim() || '', stderr: err.stderr?.trim() || '', exitCode: err.code || 1 },
        error: err.message,
      };
    }
  }

  try {
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:3100';
    const res = await fetch(`${gatewayUrl}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: dispatch.task_id,
        title: dispatch.task_title,
        description: dispatch.task_description,
        priority: dispatch.task_priority,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (res.ok) {
      const data = await res.json();
      return { result: data };
    }

    return {
      result: { message: 'Task acknowledged', task_id: dispatch.task_id },
    };
  } catch {
    return {
      result: { message: 'Task acknowledged (gateway unavailable)', task_id: dispatch.task_id },
    };
  }
}

async function processDispatch(dispatch: DispatchRecord): Promise<void> {
  const record: LocalDispatchRecord = {
    dispatch_id: dispatch.id,
    task_id: dispatch.task_id,
    task_title: dispatch.task_title || 'Unknown',
    task_description: dispatch.task_description || '',
    status: 'accepted',
    started_at: new Date().toISOString(),
    completed_at: null,
    result: null,
    error: null,
  };

  localDispatchHistory.push(record);
  if (localDispatchHistory.length > MAX_HISTORY) {
    localDispatchHistory.shift();
  }

  await patchDispatchStatus(dispatch.id, 'accepted');

  insertActivity({
    agent_id: 'system',
    event_type: 'dispatch_accepted',
    description: `Accepted dispatch: ${dispatch.task_title || dispatch.task_id}`,
    metadata: JSON.stringify({ dispatch_id: dispatch.id, task_id: dispatch.task_id }),
  });

  await patchDispatchStatus(dispatch.id, 'running');
  record.status = 'running';

  try {
    const { result, error } = await executeTask(dispatch);

    if (error) {
      record.status = 'failed';
      record.error = error;
      record.result = JSON.stringify(result);
      record.completed_at = new Date().toISOString();

      await patchDispatchStatus(dispatch.id, 'failed', { result, error });

      insertActivity({
        agent_id: 'system',
        event_type: 'dispatch_failed',
        description: `Dispatch failed: ${dispatch.task_title || dispatch.task_id}`,
        metadata: JSON.stringify({ dispatch_id: dispatch.id, error }),
      });
    } else {
      record.status = 'completed';
      record.result = JSON.stringify(result);
      record.completed_at = new Date().toISOString();

      await patchDispatchStatus(dispatch.id, 'completed', { result });

      insertActivity({
        agent_id: 'system',
        event_type: 'dispatch_completed',
        description: `Dispatch completed: ${dispatch.task_title || dispatch.task_id}`,
        metadata: JSON.stringify({ dispatch_id: dispatch.id, task_id: dispatch.task_id }),
      });
    }
  } catch (err: any) {
    record.status = 'failed';
    record.error = err.message;
    record.completed_at = new Date().toISOString();

    await patchDispatchStatus(dispatch.id, 'failed', { error: err.message });

    insertActivity({
      agent_id: 'system',
      event_type: 'dispatch_failed',
      description: `Dispatch error: ${err.message}`,
      metadata: JSON.stringify({ dispatch_id: dispatch.id, task_id: dispatch.task_id }),
    });
  }
}

async function pollDispatches(): Promise<void> {
  if (!isHubConfigured()) return;

  try {
    const res = await fetch(
      `${NODE_CONFIG.hubUrl}/v1/nodes/${NODE_CONFIG.nodeId}/dispatches?status=dispatched`,
      {
        headers: {
          Authorization: `Bearer ${NODE_CONFIG.hubApiKey}`,
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      console.error('[DispatchWorker] Poll failed:', res.status, res.statusText);
      return;
    }

    const data = await res.json();
    const dispatches: DispatchRecord[] = data.dispatches || [];

    for (const dispatch of dispatches) {
      await processDispatch(dispatch);
    }
  } catch (err) {
    console.error('[DispatchWorker] Poll error:', err);
  }
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startDispatchWorker(): void {
  if (!isHubConfigured()) {
    console.log('[DispatchWorker] Hub not configured — dispatch polling disabled');
    return;
  }

  console.log('[DispatchWorker] Starting dispatch polling (30s interval)');

  pollDispatches();

  pollInterval = setInterval(pollDispatches, 30000);
}

export function stopDispatchWorker(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[DispatchWorker] Stopped');
  }
}
