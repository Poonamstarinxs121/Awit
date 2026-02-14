import { pool } from '../db/index.js';
import { executeAgentTurn } from './orchestrationEngine.js';
import { logActivity } from './activityService.js';

const SCHEDULER_INTERVAL_MS = 30 * 1000;
const RETRY_BACKOFFS_MS = [30_000, 60_000, 300_000, 900_000, 3_600_000];
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

interface CronJob {
  id: string;
  tenant_id: string;
  agent_id: string;
  name: string;
  schedule: string;
  schedule_type: string;
  execution_mode: string;
  command: string;
  model_override: string | null;
  is_active: boolean;
  last_run_at: Date | null;
  next_run_at: Date | null;
  retry_count: number;
  created_at: Date;
}

function expandCronField(field: string, min: number, max: number): number[] {
  const results = new Set<number>();

  for (const part of field.split(',')) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    let range: string;
    let step = 1;

    if (stepMatch) {
      range = stepMatch[1];
      step = parseInt(stepMatch[2], 10);
    } else {
      range = part;
    }

    let start: number;
    let end: number;

    if (range === '*') {
      start = min;
      end = max;
    } else if (range.includes('-')) {
      const [a, b] = range.split('-').map(Number);
      start = a;
      end = b;
    } else {
      start = parseInt(range, 10);
      end = start;
    }

    for (let i = start; i <= end; i += step) {
      results.add(i);
    }
  }

  return Array.from(results).sort((a, b) => a - b);
}

export function parseNextRun(schedule: string, scheduleType: string, now?: Date): Date {
  const current = now ? new Date(now.getTime()) : new Date();

  if (scheduleType === 'interval') {
    const match = schedule.match(/^(\d+)([smh])$/);
    if (!match) throw new Error(`Invalid interval format: ${schedule}`);
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const ms = unit === 's' ? value * 1000 : unit === 'm' ? value * 60_000 : value * 3_600_000;
    return new Date(current.getTime() + ms);
  }

  if (scheduleType === 'at') {
    const date = new Date(schedule);
    if (isNaN(date.getTime())) throw new Error(`Invalid ISO timestamp: ${schedule}`);
    return date;
  }

  if (scheduleType === 'cron') {
    const parts = schedule.trim().split(/\s+/);
    if (parts.length !== 5) throw new Error(`Invalid cron expression: ${schedule}`);

    const minutes = expandCronField(parts[0], 0, 59);
    const hours = expandCronField(parts[1], 0, 23);
    const daysOfMonth = expandCronField(parts[2], 1, 31);
    const months = expandCronField(parts[3], 1, 12);
    const daysOfWeek = expandCronField(parts[4], 0, 6);

    const candidate = new Date(current.getTime());
    candidate.setSeconds(0, 0);
    candidate.setMinutes(candidate.getMinutes() + 1);

    const maxIterations = 366 * 24 * 60;
    for (let i = 0; i < maxIterations; i++) {
      const month = candidate.getMonth() + 1;
      const dom = candidate.getDate();
      const dow = candidate.getDay();
      const hour = candidate.getHours();
      const minute = candidate.getMinutes();

      if (
        months.includes(month) &&
        daysOfMonth.includes(dom) &&
        daysOfWeek.includes(dow) &&
        hours.includes(hour) &&
        minutes.includes(minute)
      ) {
        return candidate;
      }

      candidate.setMinutes(candidate.getMinutes() + 1);
    }

    throw new Error(`Could not find next run time for cron expression: ${schedule}`);
  }

  throw new Error(`Unknown schedule type: ${scheduleType}`);
}

async function executeJob(job: CronJob): Promise<void> {
  try {
    const sessionKey = job.execution_mode === 'isolated'
      ? `cron-${job.id}-${Date.now()}`
      : undefined;

    const result = await executeAgentTurn(
      job.tenant_id,
      job.agent_id,
      job.command,
      sessionKey
    );

    await logActivity(
      job.tenant_id,
      job.agent_id,
      'cron_execution',
      'cron_job',
      job.id,
      {
        name: job.name,
        mode: job.execution_mode,
        status: 'success',
        response_preview: result.response.slice(0, 200),
        tokens_used: result.tokensIn + result.tokensOut,
      }
    );

    const nextRun = parseNextRun(job.schedule, job.schedule_type);
    await pool.query(
      `UPDATE cron_jobs SET last_run_at = NOW(), next_run_at = $1, retry_count = 0 WHERE id = $2`,
      [nextRun.toISOString(), job.id]
    );

    console.log(`Cron job "${job.name}" executed successfully`);
  } catch (error) {
    const newRetryCount = job.retry_count + 1;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`Cron job "${job.name}" failed (retry ${newRetryCount}):`, errorMessage);

    if (newRetryCount >= 5) {
      await pool.query(
        `UPDATE cron_jobs SET retry_count = $1, is_active = false WHERE id = $2`,
        [newRetryCount, job.id]
      );

      await logActivity(
        job.tenant_id,
        job.agent_id,
        'cron_execution',
        'cron_job',
        job.id,
        {
          name: job.name,
          mode: job.execution_mode,
          status: 'disabled_after_failures',
          error: errorMessage,
          retry_count: newRetryCount,
        }
      );
    } else {
      const backoffMs = RETRY_BACKOFFS_MS[newRetryCount - 1];
      const nextRetry = new Date(Date.now() + backoffMs);

      await pool.query(
        `UPDATE cron_jobs SET retry_count = $1, next_run_at = $2 WHERE id = $3`,
        [newRetryCount, nextRetry.toISOString(), job.id]
      );

      await logActivity(
        job.tenant_id,
        job.agent_id,
        'cron_execution',
        'cron_job',
        job.id,
        {
          name: job.name,
          mode: job.execution_mode,
          status: 'failed',
          error: errorMessage,
          retry_count: newRetryCount,
          next_retry_at: nextRetry.toISOString(),
        }
      );
    }
  }
}

async function runSchedulerTick(): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT * FROM cron_jobs WHERE is_active = true AND next_run_at <= NOW()`
    );

    if (result.rows.length === 0) return;

    console.log(`Cron scheduler: ${result.rows.length} job(s) due`);

    for (const job of result.rows) {
      await executeJob(job as CronJob);
    }
  } catch (error) {
    console.error('Cron scheduler tick error:', error);
  }
}

export function startCronScheduler(): void {
  if (schedulerTimer) {
    console.log('Cron scheduler already running');
    return;
  }

  console.log(`Cron scheduler started (interval: ${SCHEDULER_INTERVAL_MS / 1000}s)`);
  schedulerTimer = setInterval(runSchedulerTick, SCHEDULER_INTERVAL_MS);
}

export function stopCronScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('Cron scheduler stopped');
  }
}
