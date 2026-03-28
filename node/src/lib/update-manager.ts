// update-manager.ts v1.0.0
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { NODE_CONFIG } from '../config/node';
import { getSyncState, setSyncState } from './local-db';

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'backing_up'
  | 'pausing_services'
  | 'downloading'
  | 'installing'
  | 'resuming_services'
  | 'complete'
  | 'failed'
  | 'rollback_in_progress'
  | 'rolled_back';

export interface UpdateStatus {
  state: UpdateState;
  currentVersion: string;
  latestVersion: string | null;
  logs: string[];
  backupPath: string | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  requiresRestart: boolean;
  updateAvailable: boolean;
}

const STATE_FILE_KEY = 'update_status_file';

function getStateFilePath(): string {
  return path.join(NODE_CONFIG.openclawDir, 'update-state.json');
}

function getBackupDir(): string {
  return path.join(NODE_CONFIG.openclawDir, 'backups');
}

function getDbPath(): string {
  return path.join(NODE_CONFIG.openclawDir, 'squidjob-node.db');
}

function getAppDir(): string {
  return path.resolve(process.cwd());
}

export function getCurrentVersion(): string {
  try {
    const pkgPath = path.join(getAppDir(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '0.1.0';
  } catch {
    return '0.1.0';
  }
}

function readStateFile(): Partial<UpdateStatus> {
  try {
    const p = getStateFilePath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch { /* ignore */ }
  return {};
}

function writeStateFile(data: Partial<UpdateStatus>): void {
  try {
    const dir = NODE_CONFIG.openclawDir;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const existing = readStateFile();
    const merged = { ...existing, ...data };
    fs.writeFileSync(getStateFilePath(), JSON.stringify(merged, null, 2), 'utf8');
  } catch (e) {
    console.error('[UpdateManager] Failed to write state file:', e);
  }
}

function appendLog(message: string): void {
  const ts = new Date().toISOString().split('T')[1].substring(0, 8);
  const line = `[${ts}] ${message}`;
  console.log('[UpdateManager]', message);
  const existing = readStateFile();
  const logs = Array.isArray(existing.logs) ? existing.logs : [];
  logs.push(line);
  writeStateFile({ logs: logs.slice(-100) });
}

export function getUpdateStatus(): UpdateStatus {
  const saved = readStateFile();
  const servicesPaused = getSyncState('services_paused') === 'true';

  return {
    state: (saved.state as UpdateState) || 'idle',
    currentVersion: getCurrentVersion(),
    latestVersion: saved.latestVersion || null,
    logs: Array.isArray(saved.logs) ? saved.logs : [],
    backupPath: saved.backupPath || null,
    startedAt: saved.startedAt || null,
    completedAt: saved.completedAt || null,
    error: saved.error || null,
    requiresRestart: saved.requiresRestart || false,
    updateAvailable: !!(saved.latestVersion && saved.latestVersion !== getCurrentVersion()),
  };
}

export function pauseServices(): void {
  try {
    setSyncState('services_paused', 'true');
  } catch (e) {
    console.error('[UpdateManager] Failed to pause services:', e);
  }
}

export function resumeServices(): void {
  try {
    setSyncState('services_paused', 'false');
  } catch (e) {
    console.error('[UpdateManager] Failed to resume services:', e);
  }
}

export function areServicesPaused(): boolean {
  try {
    return getSyncState('services_paused') === 'true';
  } catch {
    return false;
  }
}

export function createBackup(): string {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found at: ${dbPath}`);
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(backupDir, `squidjob-node.db.${ts}.bak`);
  fs.copyFileSync(dbPath, backupPath);

  cleanOldBackups(backupDir);
  return backupPath;
}

function cleanOldBackups(backupDir: string): void {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.bak'))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    const toDelete = files.slice(5);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(backupDir, f.name));
    }
  } catch { /* ignore */ }
}

export function rollback(): { ok: boolean; error?: string } {
  const status = getUpdateStatus();
  if (!status.backupPath || !fs.existsSync(status.backupPath)) {
    return { ok: false, error: 'No backup found to rollback to' };
  }

  try {
    writeStateFile({ state: 'rollback_in_progress', error: null });
    appendLog('Starting rollback...');

    const dbPath = getDbPath();
    fs.copyFileSync(status.backupPath, dbPath);
    appendLog(`Database restored from: ${status.backupPath}`);

    resumeServices();
    appendLog('Services resumed.');

    writeStateFile({
      state: 'rolled_back',
      completedAt: new Date().toISOString(),
      requiresRestart: true,
      error: null,
    });

    appendLog('Rollback complete. Please restart the node app.');
    return { ok: true };
  } catch (e) {
    const err = String(e);
    appendLog(`Rollback failed: ${err}`);
    writeStateFile({ state: 'failed', error: err });
    return { ok: false, error: err };
  }
}

export async function checkLatestVersion(): Promise<string | null> {
  if (!NODE_CONFIG.hubUrl) return null;
  try {
    writeStateFile({ state: 'checking' });
    const resp = await fetch(`${NODE_CONFIG.hubUrl}/v1/version`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { nodeVersion?: string };
    const latest = data.nodeVersion || null;
    writeStateFile({ state: 'idle', latestVersion: latest });
    return latest;
  } catch {
    writeStateFile({ state: 'idle' });
    return null;
  }
}

export async function startUpdate(downloadUrl?: string): Promise<{ ok: boolean; error?: string }> {
  const status = getUpdateStatus();
  const inProgress: UpdateState[] = ['backing_up', 'pausing_services', 'downloading', 'installing', 'resuming_services'];
  if (inProgress.includes(status.state)) {
    return { ok: false, error: 'Update already in progress' };
  }

  const resolvedUrl = downloadUrl || (NODE_CONFIG.hubUrl ? `${NODE_CONFIG.hubUrl}/v1/downloads/node` : null);
  if (!resolvedUrl) {
    return { ok: false, error: 'No download URL configured. Connect to a Hub or provide a direct download URL.' };
  }

  writeStateFile({
    state: 'backing_up',
    logs: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    requiresRestart: false,
  });

  runUpdateInBackground(resolvedUrl).catch(() => {});
  return { ok: true };
}

async function runUpdateInBackground(downloadUrl: string): Promise<void> {
  const appDir = getAppDir();
  const tmpDir = path.join(NODE_CONFIG.openclawDir, 'update-tmp');

  try {
    appendLog('Starting update process...');

    appendLog('Step 1/5: Backing up database...');
    writeStateFile({ state: 'backing_up' });
    const backupPath = createBackup();
    writeStateFile({ backupPath });
    appendLog(`Database backed up to: ${path.basename(backupPath)}`);

    appendLog('Step 2/5: Pausing background services...');
    writeStateFile({ state: 'pausing_services' });
    pauseServices();
    appendLog('Hub sync and dispatch worker paused.');
    await sleep(500);

    appendLog('Step 3/5: Downloading new version...');
    writeStateFile({ state: 'downloading' });
    appendLog(`Downloading from: ${downloadUrl}`);

    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });

    const zipPath = path.join(tmpDir, 'squidjob-node.zip');
    await downloadFile(downloadUrl, zipPath);
    appendLog('Download complete.');

    appendLog('Step 4/5: Installing update...');
    writeStateFile({ state: 'installing' });

    const extractDir = path.join(tmpDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });

    appendLog('Extracting files...');
    execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });

    const srcDir = findNodeAppRoot(extractDir);
    appendLog(`Copying files from extracted package...`);
    copyUpdateFiles(srcDir, appDir);

    appendLog('Running npm install...');
    execSync('npm install --prefer-offline 2>&1', {
      cwd: appDir,
      stdio: 'pipe',
      timeout: 120000,
    });
    appendLog('Dependencies installed.');

    fs.rmSync(tmpDir, { recursive: true, force: true });

    appendLog('Step 5/5: Resuming services...');
    writeStateFile({ state: 'resuming_services' });
    resumeServices();
    appendLog('Services resumed.');

    writeStateFile({
      state: 'complete',
      completedAt: new Date().toISOString(),
      requiresRestart: true,
      error: null,
    });
    appendLog('Update complete! Please restart the node app to apply changes.');

  } catch (e) {
    const err = String(e);
    appendLog(`Update failed: ${err}`);
    appendLog('Attempting to restore services...');
    resumeServices();
    writeStateFile({
      state: 'failed',
      error: err,
      completedAt: new Date().toISOString(),
    });
    appendLog('Services restored. Use Rollback to restore the previous database if needed.');

    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch { /* ignore */ }
  }
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!resp.ok) throw new Error(`Download failed: HTTP ${resp.status} from ${url}`);

  const buffer = await resp.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buffer));
}

function findNodeAppRoot(extractDir: string): string {
  const items = fs.readdirSync(extractDir);
  for (const item of items) {
    const p = path.join(extractDir, item);
    if (fs.statSync(p).isDirectory()) {
      if (fs.existsSync(path.join(p, 'package.json'))) {
        const pkg = JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf8'));
        if (pkg.name === 'squidjob-node') return p;
      }
    }
  }
  if (fs.existsSync(path.join(extractDir, 'package.json'))) {
    return extractDir;
  }
  throw new Error('Could not find squidjob-node app root in extracted zip');
}

const SKIP_PATTERNS = ['.env', '.env.local', 'node_modules', '.next', 'squidjob-node.db'];

function copyUpdateFiles(src: string, dest: string): void {
  const entries = fs.readdirSync(src);
  for (const entry of entries) {
    if (SKIP_PATTERNS.includes(entry)) continue;
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
      copyUpdateFiles(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export function resetUpdateState(): void {
  writeStateFile({
    state: 'idle',
    logs: [],
    error: null,
    startedAt: null,
    completedAt: null,
    requiresRestart: false,
  });
  resumeServices();
}
