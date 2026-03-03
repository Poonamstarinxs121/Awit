import { useState, useEffect, useRef } from 'react';
import { ScrollText, Download, Circle, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiGet } from '../api/client';

interface LogEntry {
  id: number | string;
  action?: string;
  agent_id?: string;
  details?: any;
  created_at: string;
}

const LOG_TYPES = ['all', 'message', 'command', 'cron', 'ssh', 'heartbeat', 'error'];

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const typeParam = filter === 'all' ? '' : `&type=${filter}`;
    apiGet<{ activities: LogEntry[] }>(`/v1/activity?limit=100${typeParam}`)
      .then(d => setLogs(d.activities || []))
      .catch(console.error);
  }, [filter]);

  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const downloadLogs = () => {
    const text = logs.map(l => `[${l.created_at}] ${l.action || 'event'} ${typeof l.details === 'string' ? l.details : JSON.stringify(l.details || {})}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'squidjob-logs.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLineColor = (action?: string) => {
    if (!action) return 'var(--text-muted)';
    const a = action.toLowerCase();
    if (a.includes('error') || a.includes('fail')) return 'var(--negative)';
    if (a.includes('cron')) return 'var(--type-cron)';
    if (a.includes('ssh') || a.includes('command')) return 'var(--type-command)';
    if (a.includes('heartbeat')) return 'var(--type-heartbeat)';
    if (a.includes('message')) return 'var(--type-message)';
    return 'var(--text-secondary)';
  };

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Logs</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Live activity log stream</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Circle size={8} style={{ color: 'var(--positive)', fill: 'var(--positive)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{logs.length} entries</span>
          </div>
          <button onClick={() => setAutoScroll(a => !a)} style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: autoScroll ? 'var(--accent-soft)' : 'var(--surface-elevated)', border: '1px solid var(--border)', color: autoScroll ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </button>
          <button onClick={downloadLogs} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      <div className="flex gap-2" style={{ marginBottom: '16px' }}>
        {LOG_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize', border: '1px solid', backgroundColor: filter === t ? 'var(--accent-soft)' : 'var(--surface-elevated)', borderColor: filter === t ? 'var(--accent)' : 'var(--border)', color: filter === t ? 'var(--accent)' : 'var(--text-secondary)' }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', fontFamily: 'var(--font-mono)', fontSize: '12px', height: 'calc(100vh - 260px)', overflowY: 'auto', padding: '12px' }}>
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>No logs found</div>
        ) : (
          logs.map((log) => {
            const desc = typeof log.details === 'string' ? log.details : (log.details?.description || log.details?.message || log.action || 'event');
            const time = (() => { try { return new Date(log.created_at).toISOString().replace('T', ' ').slice(0, 19); } catch { return ''; } })();
            return (
              <div key={log.id} style={{ display: 'flex', gap: '12px', padding: '3px 0', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: '170px' }}>{time}</span>
                <span style={{ color: getLineColor(log.action), flexShrink: 0, minWidth: '100px', fontWeight: 600 }}>[{log.action || 'event'}]</span>
                <span style={{ color: 'var(--text-secondary)', flex: 1, wordBreak: 'break-all' }}>{desc}</span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
