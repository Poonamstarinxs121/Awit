import os from 'os';
import fs from 'fs';

export interface SystemStats {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  uptime_seconds: number;
  hostname: string;
  platform: string;
  arch: string;
  total_memory_gb: number;
  free_memory_gb: number;
}

let lastCpuInfo: { idle: number; total: number } | null = null;

function getCpuUsage(): number {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }

  if (!lastCpuInfo) {
    lastCpuInfo = { idle, total };
    return 0;
  }

  const idleDiff = idle - lastCpuInfo.idle;
  const totalDiff = total - lastCpuInfo.total;
  lastCpuInfo = { idle, total };

  if (totalDiff === 0) return 0;
  return Math.round((1 - idleDiff / totalDiff) * 100);
}

function getDiskUsage(): number {
  try {
    const stats = fs.statfsSync('/');
    const total = stats.blocks * stats.bsize;
    const free = stats.bfree * stats.bsize;
    const used = total - free;
    return Math.round((used / total) * 100);
  } catch {
    return 0;
  }
}

export function getSystemStats(): SystemStats {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    cpu_percent: getCpuUsage(),
    memory_percent: Math.round((usedMem / totalMem) * 100),
    disk_percent: getDiskUsage(),
    uptime_seconds: Math.floor(os.uptime()),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    total_memory_gb: Math.round((totalMem / (1024 * 1024 * 1024)) * 10) / 10,
    free_memory_gb: Math.round((freeMem / (1024 * 1024 * 1024)) * 10) / 10,
  };
}
