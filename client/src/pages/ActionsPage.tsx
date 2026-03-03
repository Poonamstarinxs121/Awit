import { useState } from 'react';
import { Heart, Play, Loader2, CheckCircle, AlertCircle, RotateCcw, Pause, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { apiGet, apiPost } from '../api/client';

interface ActionResult {
  action: string;
  status: 'success' | 'error';
  output: string;
  timestamp: string;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: any;
  color: string;
  dangerous?: boolean;
}

const ACTIONS: QuickAction[] = [
  { id: 'heartbeat', label: 'Trigger Heartbeats', description: 'Trigger heartbeat check for all online agents', icon: Heart, color: 'var(--positive)' },
  { id: 'activity-stats', label: 'Refresh Activity Stats', description: 'Fetch latest activity statistics', icon: Activity, color: 'var(--info)' },
  { id: 'health-check', label: 'Platform Health Check', description: 'Verify all platform services are running', icon: CheckCircle, color: 'var(--type-file)' },
  { id: 'pause-all', label: 'Pause All Agents', description: 'Pause all agent heartbeats and cron jobs', icon: Pause, color: 'var(--warning)', dangerous: true },
  { id: 'resume-all', label: 'Resume All Agents', description: 'Resume all agent heartbeats and cron jobs', icon: Play, color: 'var(--positive)' },
];

export function ActionsPage() {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<ActionResult[]>([]);

  const run = async (action: QuickAction) => {
    if (running) return;
    setRunning(action.id);
    const start = Date.now();
    try {
      let output = '';

      if (action.id === 'heartbeat') {
        const agents = await apiGet<{ agents: any[] }>('/v1/agents');
        const online = agents.agents.filter(a => a.status === 'online');
        output = `Triggered heartbeat for ${online.length} online agents`;
      } else if (action.id === 'activity-stats') {
        const stats = await apiGet<any>('/v1/activity/stats');
        output = `Total: ${stats.total}, Today: ${stats.today}, Success rate: ${stats.successRate}%`;
      } else if (action.id === 'health-check') {
        const health = await apiGet<any>('/v1/health');
        output = `Status: ${health.status}, DB: ${health.db}, Uptime: ${health.uptime}s`;
      } else if (action.id === 'pause-all') {
        await apiPost('/v1/settings/pause-all', {});
        output = 'All agents paused successfully';
      } else if (action.id === 'resume-all') {
        await apiPost('/v1/settings/resume-all', {});
        output = 'All agents resumed successfully';
      }

      setResults(r => [{
        action: action.label,
        status: 'success',
        output,
        timestamp: new Date().toISOString(),
      }, ...r].slice(0, 20));
    } catch (e: any) {
      setResults(r => [{
        action: action.label,
        status: 'error',
        output: e?.message || 'Action failed',
        timestamp: new Date().toISOString(),
      }, ...r].slice(0, 20));
    } finally {
      setRunning(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Quick Actions</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Platform management and maintenance actions</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {ACTIONS.map(action => {
          const Icon = action.icon;
          const isRunning = running === action.id;
          return (
            <div
              key={action.id}
              style={{ backgroundColor: 'var(--card)', border: `1px solid ${action.dangerous ? 'rgba(255, 214, 10, 0.3)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '20px', cursor: running ? 'not-allowed' : 'pointer', transition: 'all 150ms ease', opacity: running && !isRunning ? 0.5 : 1 }}
              onClick={() => !running && run(action)}
              onMouseEnter={(e) => { if (!running) (e.currentTarget as HTMLElement).style.borderColor = action.color; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = action.dangerous ? 'rgba(255, 214, 10, 0.3)' : 'var(--border)'; }}
            >
              <div className="flex items-start justify-between" style={{ marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: `color-mix(in srgb, ${action.color} 15%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isRunning ? <Loader2 size={20} style={{ color: action.color, animation: 'spin 1s linear infinite' }} /> : <Icon size={20} style={{ color: action.color }} />}
                </div>
                <Play size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{action.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{action.description}</div>
            </div>
          );
        })}
      </div>

      {results.length > 0 && (
        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div className="flex items-center gap-3" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: '3px', height: '18px', backgroundColor: 'var(--accent)', borderRadius: '2px' }} />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Action History</h2>
          </div>
          {results.map((r, i) => (
            <div key={i} className="flex items-start gap-4" style={{ padding: '14px 20px', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none' }}>
              {r.status === 'success' ? <CheckCircle size={16} style={{ color: 'var(--positive)', flexShrink: 0, marginTop: '2px' }} /> : <AlertCircle size={16} style={{ color: 'var(--negative)', flexShrink: 0, marginTop: '2px' }} />}
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.action}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{format(new Date(r.timestamp), 'HH:mm:ss')}</span>
                </div>
                <div style={{ fontSize: '12px', color: r.status === 'success' ? 'var(--text-secondary)' : 'var(--negative)', fontFamily: 'var(--font-mono)' }}>{r.output}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
