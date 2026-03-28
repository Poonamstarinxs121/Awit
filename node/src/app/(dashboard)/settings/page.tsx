'use client';

import { useEffect, useState } from 'react';
import {
  Wifi, WifiOff, Server, FolderOpen, ExternalLink,
  ChevronDown, ChevronUp, Activity, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import HelpBanner from '@/components/HelpBanner';

interface HubStatus {
  configured: boolean;
  hubUrl: string | null;
  nodeId: string | null;
  lastHeartbeat: string | null;
  lastTelemetry: string | null;
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

export default function SettingsPage() {
  const [hubStatus, setHubStatus] = useState<HubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [envExpanded, setEnvExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/hub/status')
      .then(r => r.json())
      .then(d => { setHubStatus(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
        </div>
      </Section>
    </div>
  );
}
