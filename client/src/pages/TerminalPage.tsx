import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Send, Trash2, Copy, ChevronRight, Server } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '../api/client';

interface HistoryEntry {
  command: string;
  output: string;
  error?: boolean;
  ts: Date;
}

interface Machine {
  id: string;
  name: string;
  host: string;
  status: string;
}

const QUICK_COMMANDS = ['uptime', 'free -h', 'df -h /', 'ps aux --sort=-%cpu | head -10', 'ls -la', 'pwd', 'env | grep -i api | head -5', 'date'];

export function TerminalPage() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<string>('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: machinesData } = useQuery({
    queryKey: ['machines-terminal'],
    queryFn: () => apiGet<{ machines: Machine[] }>('/v1/machines'),
    retry: false,
  });

  const machines = machinesData?.machines || [];

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const execute = useCallback(async (cmd: string) => {
    if (!cmd.trim() || loading) return;
    if (!selectedMachine) {
      setHistory(h => [...h, { command: cmd, output: 'Error: No machine selected. Please select a machine from the dropdown.', error: true, ts: new Date() }]);
      return;
    }
    setLoading(true);
    const entry: HistoryEntry = { command: cmd, output: '', ts: new Date() };
    try {
      const result = await apiPost<{ output: string; exitCode?: number }>(`/v1/machines/${selectedMachine}/exec`, { command: cmd });
      entry.output = result.output || '(no output)';
      entry.error = result.exitCode !== undefined && result.exitCode !== 0;
    } catch (e: any) {
      entry.output = e?.message || 'Command failed';
      entry.error = true;
    }
    setHistory(h => [...h, entry]);
    setLoading(false);
    inputRef.current?.focus();
  }, [loading, selectedMachine]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    execute(input.trim());
    setInput('');
  };

  const copyOutput = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px - 32px - 48px)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Terminal</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Execute commands on registered machines</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Server size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              value={selectedMachine}
              onChange={e => setSelectedMachine(e.target.value)}
              style={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: selectedMachine ? 'var(--text-primary)' : 'var(--text-muted)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', outline: 'none' }}
            >
              <option value="">Select machine...</option>
              {machines.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.host})</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setHistory([])}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}
          >
            <Trash2 size={14} />
            Clear
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap" style={{ marginBottom: '12px' }}>
        {QUICK_COMMANDS.map(cmd => (
          <button
            key={cmd}
            onClick={() => { setInput(cmd); inputRef.current?.focus(); }}
            style={{ padding: '4px 10px', borderRadius: '4px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-mono)' }}
          >
            {cmd}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, backgroundColor: '#0a0a0a', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
          {history.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--positive)' }}>squidjob</span>
              <span style={{ color: 'var(--text-secondary)' }}> $ </span>
              {selectedMachine ? 'Ready. Type a command.' : 'Select a machine to start.'}
            </div>
          ) : (
            history.map((entry, i) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--positive)' }}>squidjob</span>
                  <span style={{ color: 'var(--text-muted)' }}>$ </span>
                  <span style={{ color: 'var(--text-primary)' }}>{entry.command}</span>
                </div>
                {entry.output && (
                  <div style={{ position: 'relative', marginTop: '4px' }}>
                    <pre style={{ color: entry.error ? 'var(--negative)' : 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, lineHeight: 1.5, padding: '8px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px', borderLeft: `2px solid ${entry.error ? 'var(--negative)' : 'var(--border)'}` }}>
                      {entry.output}
                    </pre>
                    <button
                      onClick={() => copyOutput(entry.output)}
                      style={{ position: 'absolute', top: '6px', right: '6px', padding: '3px 6px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px' }}
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Executing</span>
              <span style={{ animation: 'pulse 1s infinite' }}>...</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#0a0a0a' }}
        >
          <span style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={selectedMachine ? 'Enter command...' : 'Select a machine first...'}
            disabled={!selectedMachine || loading}
            style={{ flex: 1, backgroundColor: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || !selectedMachine || loading}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, opacity: !input.trim() || !selectedMachine ? 0.5 : 1 }}
          >
            <Send size={14} />
            Run
          </button>
        </form>
      </div>
    </div>
  );
}
