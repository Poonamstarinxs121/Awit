import { NextResponse } from 'next/server';
import { readOpenClawConfig } from '@/lib/openclaw-reader';

interface CronTask {
  id: string;
  name: string;
  schedule: string;
  agent?: string;
  command?: string;
  status: 'active' | 'paused';
  last_run?: string;
  next_run?: string;
}

export async function GET() {
  const config = readOpenClawConfig();
  const tasks: CronTask[] = [];

  if (!config) {
    return NextResponse.json({ tasks });
  }

  const cronConfig = config.cron || config.schedules || config.scheduled_tasks;

  if (Array.isArray(cronConfig)) {
    cronConfig.forEach((item: any, index: number) => {
      tasks.push({
        id: item.id || `cron-${index}`,
        name: item.name || item.task || `Task ${index + 1}`,
        schedule: item.schedule || item.cron || '',
        agent: item.agent || item.agent_id,
        command: item.command || item.action,
        status: item.enabled === false ? 'paused' : 'active',
        last_run: item.last_run,
        next_run: item.next_run,
      });
    });
  } else if (cronConfig && typeof cronConfig === 'object') {
    Object.entries(cronConfig).forEach(([key, value]: [string, any]) => {
      if (typeof value === 'object') {
        tasks.push({
          id: value.id || key,
          name: value.name || key,
          schedule: value.schedule || value.cron || '',
          agent: value.agent || value.agent_id,
          command: value.command || value.action,
          status: value.enabled === false ? 'paused' : 'active',
          last_run: value.last_run,
          next_run: value.next_run,
        });
      } else if (typeof value === 'string') {
        tasks.push({
          id: key,
          name: key,
          schedule: value,
          status: 'active',
        });
      }
    });
  }

  return NextResponse.json({ tasks });
}
