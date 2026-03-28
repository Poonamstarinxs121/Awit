'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wifi, WifiOff, Server, FolderOpen, ExternalLink,
  ChevronDown, ChevronUp, Activity, CheckCircle, XCircle, Clock,
  Download, RotateCcw, RefreshCw, AlertTriangle, ArrowUpCircle, Terminal,
} from 'lucide-react';
import HelpBanner from '@/components/HelpBanner';

interface HubStatus {
  configured: boolean;
  hubUrl: string | null;
  nodeId: string | null;
  nodeName: string | null;
  openclawDir: string | null;
  lastHeartbeat: string | null;
  lastTelemetry: string | null;
}

type UpdateState =
  | 'idle' | 'checking' | 'backing_up' | 'pausing_services' | 'downloading'
  | 'installing' | 'resuming_services' | 'complete' | 'failed'
  | 'rollback_in_progress' | 'rolled_back';

interface UpdateStatus {
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-primary)',
      }}>
        {title}
      </div>
      <div style={{ padding: '16px 20px' }}>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, muted }: { label: string; value: string; mono?: boolean; muted?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{
        fontSize: 12,
        fontWeight: 500,
        color: muted ? 'var(--text-muted)' : 'var(--text-primary)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        maxWidth: '60%',
        textAlign: 'right',
        wordBreak: 'break-all',
      }}>
        {value}
      </span>
    </div>
  );
}

function timeSince(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const IN_PROGRESS_STATES: UpdateState[] = [
  'backing_up', 'pausing_services', 'downloading', 'installing',
  'resuming_services', 'rollback_in_progress', 'checking',
];

function stateLabel(state: UpdateState): string {
  const labels: Record<UpdateState, string> = {
    idle: 'Up to date',
    checking: 'Checking for updates…',
    backing_up: 'Backing up database…',
    pausing_services: 'Pausing services…',
    downloading: 'Downloading update…',
    installing: 'Installing…',
    resuming_services: 'Resuming services…',
    complete: 'Update complete',
    failed: 'Update failed',
    rollback_in_progress: 'Rolling back…',
    rolled_back: 'Rolled back',
  };
  return labels[state] || state;
}

function stateColor(state: UpdateState): string {
  if (state === 'complete' || state === 'rolled_back') return 'var(--positive)';
  if (state === 'failed') return 'var(--negative)';
  if (IN_PROGRESS_STATES.includes(state)) return '#F59E0B';
  return 'var(--text-muted)';
}

export default function SettingsPage() {
  const router = useRouter();
  const [hubStatus, setHubStatus] = useState<HubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [envExpanded, setEnvExpanded] = useState(false);
  const [resettingSetup, setResettingSetup] = useState(false);

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [customDownloadUrl, setCustomDownloadUrl] = useState('');
  const logsRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/api/hub/status')
      .then(r => r.json())
      .then(d => { setHubStatus(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const fetchUpdateStatus = async () => {
    try {
      const r = await fetch('/api/update');
      const d = await r.json();
      setUpdateStatus(d);
      return d as UpdateStatus;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    fetchUpdateStatus();
  }, []);

  useEffect(() => {
    if (updateStatus && IN_PROGRESS_STATES.includes(updateStatus.state)) {
      if (!pollRef.current) {
        pollRef.current = setInterval(async () => {
          const d = await fetchUpdateStatus();
          if (d && !IN_PROGRESS_STATES.includes(d.state)) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          }
        }, 2000);
      }
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [updateStatus?.state]);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [updateStatus?.logs?.length]);

  const handleCheckForUpdates = async () => {
    setUpdateLoading(true);
    try {
      const r = await fetch('/api/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check' }) });
      const d = await r.json();
      setUpdateStatus(d);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleStartUpdate = async () => {
    if (!confirm('Start the update process? Services will be paused briefly and you will need to restart the node app when complete.')) return;
    setUpdateLoading(true);
    try {
      const body: Record<string, string> = { action: 'start' };
      if (customDownloadUrl) body.downloadUrl = customDownloadUrl;
      const r = await fetch('/api/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.error) { alert(`Failed to start update: ${d.error}`); }
      else { await fetchUpdateStatus(); }
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!confirm('Roll back to the previous database backup? App files will not change.')) return;
    setUpdateLoading(true);
    try {
      const r = await fetch('/api/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rollback' }) });
      const d = await r.json();
      if (d.error) { alert(`Rollback failed: ${d.error}`); }
      else { await fetchUpdateStatus(); }
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleReset = async () => {
    setUpdateLoading(true);
    try {
      await fetch('/api/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset' }) });
      await fetchUpdateStatus();
    } finally {
      setUpdateLoading(false);
    }
  };

  const isUpdateInProgress = updateStatus ? IN_PROGRESS_STATES.includes(updateStatus.state) : false;
  const hubUrl = hubStatus?.hubUrl;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>
          Settings
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
          Node configuration and hub connection
        </p>
      </div>

      <HelpBanner
        pageKey="settings"
        title="Node Settings"
        description="This page shows your node's current configuration. All settings are managed via environment variables in your .env file inside the squidjob-node directory."
        tips={[
          'Restart the node app after changing .env values for them to take effect',
          'Get your NODE_ID and NODE_HUB_API_KEY from Hub → Fleet → Register Node',
          'NODE_HUB_URL should be your full Hub URL (e.g. https://your-hub.onrender.com)',
        ]}
      />

      {/* Hub Connection Status */}
      <Section title="Hub Connection">
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
        ) : (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 0 14px',
              marginBottom: 8,
            }}>
              {hubStatus?.configured ? (
                <>
                  <CheckCircle size={18} style={{ color: 'var(--positive)', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--positive)' }}>Connected to Hub</span>
                </>
              ) : (
                <>
                  <XCircle size={18} style={{ color: 'var(--negative)', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--negative)' }}>Not Connected</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>(standalone mode)</span>
                </>
              )}
            </div>

            <InfoRow label="Hub URL" value={hubStatus?.hubUrl || 'Not set'} mono muted={!hubStatus?.hubUrl} />
            <InfoRow
              label="Node ID"
              value={hubStatus?.nodeId ? `${hubStatus.nodeId.substring(0, 8)}…` : 'Not set'}
              mono
              muted={!hubStatus?.nodeId}
            />
            <InfoRow
              label="Last Heartbeat"
              value={timeSince(hubStatus?.lastHeartbeat || null)}
              muted={!hubStatus?.lastHeartbeat}
            />
            <InfoRow
              label="Last Telemetry Sync"
              value={timeSince(hubStatus?.lastTelemetry || null)}
              muted={!hubStatus?.lastTelemetry}
            />

            {hubStatus?.configured && hubStatus.hubUrl && (
              <div style={{ marginTop: 14 }}>
                <a
                  href={`${hubStatus.hubUrl}/fleet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  <ExternalLink size={12} />
                  Open Hub Fleet page
                </a>
              </div>
            )}
          </>
        )}
      </Section>

      {/* Node Identity */}
      <Section title="Node Identity">
        <InfoRow
          label="Node Name"
          value={hubStatus?.nodeName || 'Not set (using hostname)'}
          muted={!hubStatus?.nodeName}
        />
        <InfoRow
          label="OpenClaw Directory"
          value={hubStatus?.openclawDir || '~/.openclaw (default)'}
          mono
          muted={!hubStatus?.openclawDir}
        />
        <InfoRow
          label="Node ID"
          value={hubStatus?.nodeId || 'Not set'}
          mono
          muted={!hubStatus?.nodeId}
        />
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            Set <code style={{ fontFamily: 'var(--font-mono)' }}>NODE_NAME</code> in your .env to give this node a friendly name.
            Set <code style={{ fontFamily: 'var(--font-mono)' }}>OPENCLAW_DIR</code> to point to a custom OpenClaw workspace location.
          </p>
        </div>
      </Section>

      {/* ── Software Update ───────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowUpCircle size={15} style={{ color: updateStatus?.updateAvailable ? '#F59E0B' : 'var(--text-muted)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Software Update</span>
          </div>
          {updateStatus && (
            <span style={{
              fontSize: 11,
              fontWeight: 500,
              color: stateColor(updateStatus.state),
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}>
              {isUpdateInProgress && (
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', animation: 'pulse 1.5s infinite' }} />
              )}
              {stateLabel(updateStatus.state)}
            </span>
          )}
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* Version info row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Current Version</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                v{updateStatus?.currentVersion || '0.1.0'}
              </div>
            </div>
            {updateStatus?.latestVersion && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Latest Version</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
                  color: updateStatus.updateAvailable ? '#F59E0B' : 'var(--positive)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  v{updateStatus.latestVersion}
                  {updateStatus.updateAvailable && <AlertTriangle size={12} />}
                </div>
              </div>
            )}
            {updateStatus?.backupPath && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Backup Available</div>
                <div style={{ fontSize: 12, color: 'var(--positive)', fontWeight: 500 }}>
                  <CheckCircle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  DB backed up
                </div>
              </div>
            )}
          </div>

          {/* Update complete / restart required */}
          {(updateStatus?.state === 'complete' || updateStatus?.state === 'rolled_back') && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(34,197,94,0.07)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 8,
              marginBottom: 14,
              fontSize: 13,
              color: 'var(--positive)',
            }}>
              <strong>{updateStatus.state === 'complete' ? '✓ Update installed' : '✓ Rolled back'}</strong> — restart the app to apply changes:
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 12, margin: '6px 0 0', color: 'var(--text-secondary)' }}>
                npm run dev{'\n'}# or: pm2 restart squidjob-node
              </pre>
            </div>
          )}

          {/* Failed state */}
          {updateStatus?.state === 'failed' && updateStatus.error && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8,
              marginBottom: 14,
              fontSize: 12,
              color: 'var(--negative)',
            }}>
              <strong>Error:</strong> {updateStatus.error}
            </div>
          )}

          {/* Progress log */}
          {updateStatus && updateStatus.logs && updateStatus.logs.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Terminal size={11} />
                Progress Log
              </div>
              <div
                ref={logsRef}
                style={{
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                  maxHeight: 160,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {updateStatus.logs.join('\n')}
              </div>
            </div>
          )}

          {/* Custom download URL (shown when not connected to Hub) */}
          {!hubUrl && !isUpdateInProgress && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Custom Download URL</div>
              <input
                type="text"
                value={customDownloadUrl}
                onChange={e => setCustomDownloadUrl(e.target.value)}
                placeholder="https://your-hub.onrender.com/v1/downloads/node"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Check for updates */}
            {!isUpdateInProgress && (
              <button
                onClick={handleCheckForUpdates}
                disabled={updateLoading || !hubUrl}
                title={!hubUrl ? 'Connect to Hub to check for updates' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', background: 'var(--background)',
                  border: '1px solid var(--border)', borderRadius: 7,
                  color: hubUrl ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 500, cursor: hubUrl ? 'pointer' : 'not-allowed',
                }}
              >
                <RefreshCw size={13} style={{ opacity: updateLoading ? 0.5 : 1 }} />
                Check for Updates
              </button>
            )}

            {/* Start update */}
            {!isUpdateInProgress && (updateStatus?.updateAvailable || customDownloadUrl || updateStatus?.state === 'failed') && (
              <button
                onClick={handleStartUpdate}
                disabled={updateLoading || isUpdateInProgress}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px',
                  background: updateStatus?.updateAvailable ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.1)',
                  border: `1px solid ${updateStatus?.updateAvailable ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)'}`,
                  borderRadius: 7,
                  color: updateStatus?.updateAvailable ? '#F59E0B' : '#3B82F6',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Download size={13} />
                {updateStatus?.state === 'failed' ? 'Retry Update' : 'Install Update'}
              </button>
            )}

            {/* Rollback */}
            {!isUpdateInProgress && updateStatus?.backupPath && ['complete', 'failed', 'rolled_back'].includes(updateStatus.state) && (
              <button
                onClick={handleRollback}
                disabled={updateLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 7, color: 'var(--negative)',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}
              >
                <RotateCcw size={13} />
                Rollback Database
              </button>
            )}

            {/* Reset state (if stuck in failed) */}
            {!isUpdateInProgress && updateStatus?.state === 'failed' && (
              <button
                onClick={handleReset}
                disabled={updateLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 7, color: 'var(--text-muted)',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                <XCircle size={13} />
                Clear Error
              </button>
            )}

            {/* In progress spinner */}
            {isUpdateInProgress && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 14px',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 7, color: '#F59E0B', fontSize: 12, fontWeight: 500,
              }}>
                <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                {stateLabel(updateStatus!.state)}
              </div>
            )}
          </div>

          {/* Manual script hint */}
          <div style={{ marginTop: 14, padding: '8px 12px', background: 'rgba(59,130,246,0.04)', border: '1px solid var(--border)', borderRadius: 7 }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.7 }}>
              You can also update manually by running{' '}
              <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>
                bash scripts/squidjob-update.sh
              </code>{' '}
              from the node app directory. The script backs up the database, preserves your .env, and requires a restart when done.
            </p>
          </div>
        </div>
      </div>

      {/* Environment Setup */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setEnvExpanded(v => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: envExpanded ? '1px solid var(--border)' : 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          <span>Environment Variable Reference</span>
          {envExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {envExpanded && (
          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
              Add these to your <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>.env</code> file in the <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>squidjob-node</code> directory, then restart the app.
            </p>
            <pre style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '14px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 2,
              margin: '0 0 12px',
              overflowX: 'auto',
            }}>
{`# Hub connection (from Hub → Fleet → Register Node)
NODE_HUB_URL=https://your-hub.onrender.com
NODE_HUB_API_KEY=sqn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NODE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Node identity
NODE_NAME=My Mac Studio

# OpenClaw location (default: ~/.openclaw)
OPENCLAW_DIR=/Users/username/.openclaw

# Node app auth
ADMIN_PASSWORD=changeme`}
            </pre>
            <div style={{
              padding: '10px 14px',
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}>
              Get your <strong>NODE_HUB_API_KEY</strong> and <strong>NODE_ID</strong> by registering this node in Hub → Fleet → "Register Node" button.
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <Section title="Quick Actions">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href="/api/health"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              textDecoration: 'none',
              fontSize: 13,
            }}
          >
            <Activity size={16} style={{ color: 'var(--positive)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>Health Check</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>View raw health status JSON</div>
            </div>
            <ExternalLink size={13} style={{ color: 'var(--text-muted)' }} />
          </a>

          {hubStatus?.configured && hubStatus.hubUrl && (
            <a
              href={`${hubStatus.hubUrl}/fleet`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                textDecoration: 'none',
                fontSize: 13,
              }}
            >
              <Server size={16} style={{ color: '#3B82F6', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>Hub Fleet Page</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>View this node on your Hub</div>
              </div>
              <ExternalLink size={13} style={{ color: 'var(--text-muted)' }} />
            </a>
          )}
          <button
            onClick={async () => {
              setResettingSetup(true);
              try {
                const res = await fetch('/api/setup/reset', { method: 'POST' });
                const result = await res.json();
                if (result.success) {
                  router.push('/setup');
                }
              } catch {
              } finally {
                setResettingSetup(false);
              }
            }}
            disabled={resettingSetup}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              textDecoration: 'none',
              fontSize: 13,
              cursor: resettingSetup ? 'wait' : 'pointer',
              width: '100%',
              fontFamily: 'var(--font-body)',
            }}
          >
            <RotateCcw size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>{resettingSetup ? 'Resetting...' : 'Re-run Setup Wizard'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Change Hub connection, password, or integrations</div>
            </div>
          </button>
        </div>
      </Section>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
}
