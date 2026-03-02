import { pool } from '../db/index.js';
import { pingMachine, getMachines, updateMachineStatus, type MachineRow } from './sshService.js';

const MONITOR_INTERVAL_MS = 60 * 1000;
let monitorTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

async function checkAllMachines(): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT DISTINCT tenant_id FROM machines`
    );
    const tenantIds: string[] = result.rows.map((r: { tenant_id: string }) => r.tenant_id);

    for (const tenantId of tenantIds) {
      const machines = await getMachines(tenantId);
      await Promise.allSettled(
        machines.map(async (machine: MachineRow) => {
          try {
            const pingResult = await pingMachine(machine);
            await updateMachineStatus(machine.id, pingResult.online ? 'online' : 'offline');
          } catch {
            await updateMachineStatus(machine.id, 'offline');
          }
        })
      );
    }
  } catch (error) {
    console.error('[MachineMonitor] Error checking machines:', error instanceof Error ? error.message : error);
  }
}

function scheduleNext(): void {
  if (!isRunning) return;
  monitorTimer = setTimeout(async () => {
    await checkAllMachines();
    scheduleNext();
  }, MONITOR_INTERVAL_MS);
}

export function startMachineMonitor(): void {
  if (isRunning) return;
  isRunning = true;
  console.log('[MachineMonitor] Starting machine health monitor (60s interval)');
  checkAllMachines().then(scheduleNext).catch(() => scheduleNext());
}

export function stopMachineMonitor(): void {
  isRunning = false;
  if (monitorTimer) {
    clearTimeout(monitorTimer);
    monitorTimer = null;
  }
}
