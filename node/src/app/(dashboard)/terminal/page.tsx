'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import HelpBanner from '@/components/HelpBanner';

interface CommandBlock {
  id: number;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration_ms: number;
  cwd: string;
  timestamp: Date;
}

const HISTORY_KEY = 'squidjob-terminal-history';
const QUICK_COMMANDS = ['ls', 'df -h', 'free -m', 'ps aux', 'openclaw status'];

function loadHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-200)));
  } catch {}
}

export default function TerminalPage() {
  const [input, setInput] = useState('');
  const [blocks, setBlocks] = useState<CommandBlock[]>([]);
  const [running, setRunning] = useState(false);
  const [cwd, setCwd] = useState('~/.openclaw');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [savedInput, setSavedInput] = useState('');

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [blocks]);

  const execCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim() || running) return;

    const newHistory = [...history.filter(h => h !== cmd), cmd];
    setHistory(newHistory);
    saveHistory(newHistory);
    setHistoryIdx(-1);
    setSavedInput('');
    setInput('');
    setRunning(true);

    const blockId = ++idCounter.current;

    try {
      const res = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, cwd }),
      });

      const data = await res.json();

      if (res.ok) {
        setBlocks(prev => [...prev, {
          id: blockId,
          command: cmd,
          stdout: data.stdout || '',
          stderr: data.stderr || '',
          exitCode: data.exitCode ?? 1,
          duration_ms: data.duration_ms ?? 0,
          cwd,
          timestamp: new Date(),
        }]);

        if (cmd.trim().startsWith('cd ')) {
          const target = cmd.trim().slice(3).trim();
          if (target) {
            try {
              const pwdRes = await fetch('/api/terminal/exec', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'pwd', cwd }),
              });
              const pwdData = await pwdRes.json();
              if (pwdRes.ok && pwdData.stdout) {
                setCwd(pwdData.stdout.trim());
              }
            } catch {}
          }
        }
      } else {
        setBlocks(prev => [...prev, {
          id: blockId,
          command: cmd,
          stdout: '',
          stderr: data.error || 'Request failed',
          exitCode: 1,
          duration_ms: 0,
          cwd,
          timestamp: new Date(),
        }]);
      }
    } catch (err: any) {
      setBlocks(prev => [...prev, {
        id: blockId,
        command: cmd,
        stdout: '',
        stderr: err.message || 'Network error',
        exitCode: 1,
        duration_ms: 0,
        cwd,
        timestamp: new Date(),
      }]);
    } finally {
      setRunning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [running, cwd, history]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      execCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIdx === -1) {
        setSavedInput(input);
        const idx = history.length - 1;
        setHistoryIdx(idx);
        setInput(history[idx]);
      } else if (historyIdx > 0) {
        const idx = historyIdx - 1;
        setHistoryIdx(idx);
        setInput(history[idx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      if (historyIdx < history.length - 1) {
        const idx = historyIdx + 1;
        setHistoryIdx(idx);
        setInput(history[idx]);
      } else {
        setHistoryIdx(-1);
        setInput(savedInput);
      }
    }
  };

  const copyOutput = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const cwdParts = cwd.split('/').filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            Terminal
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            {cwdParts.map((part, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{ cursor: 'pointer', color: i === cwdParts.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  onClick={() => {
                    const newCwd = '/' + cwdParts.slice(0, i + 1).join('/');
                    setCwd(newCwd);
                  }}
                >
                  {part}
                </span>
                {i < cwdParts.length - 1 && <span style={{ color: 'var(--text-muted)' }}>/</span>}
              </span>
            ))}
          </div>
        </div>

        <HelpBanner
          pageKey="terminal"
          title="Command Terminal"
          description="Execute shell commands directly on this machine. Commands run as the node app's process user and output is displayed below."
          tips={[
            'Use the quick command buttons above to run common diagnostics instantly',
            'Click breadcrumbs to navigate to a parent directory',
            'Command history is stored in memory — refresh clears the log',
          ]}
        />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {QUICK_COMMANDS.map(cmd => (
            <button
              key={cmd}
              onClick={() => execCommand(cmd)}
              disabled={running}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '4px 10px',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                cursor: running ? 'not-allowed' : 'pointer',
                opacity: running ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (!running) {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={outputRef}
        onClick={() => inputRef.current?.focus()}
        style={{
          flex: 1,
          background: '#0C0C0C',
          borderRadius: 12,
          border: '1px solid var(--border)',
          padding: 16,
          overflowY: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {blocks.length === 0 && !running && (
          <div style={{ color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⌘</div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>SquidJob Terminal</div>
            <div style={{ fontSize: 12 }}>Type a command below or use the quick buttons above</div>
          </div>
        )}

        {blocks.map(block => {
          const output = (block.stdout + block.stderr).trim();
          return (
            <div key={block.id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: 'var(--accent)' }}>$</span>
                <span style={{ color: '#22C55E' }}>{block.command}</span>
                <span style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                }}>
                  <span>{block.duration_ms}ms</span>
                  <span style={{ color: block.exitCode === 0 ? '#22C55E' : '#EF4444' }}>
                    {block.exitCode === 0 ? '✓' : `✗ ${block.exitCode}`}
                  </span>
                  {output && (
                    <button
                      onClick={(e) => { e.stopPropagation(); copyOutput(output); }}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        padding: '1px 6px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                      copy
                    </button>
                  )}
                </span>
              </div>
              {block.stdout && (
                <pre style={{
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  margin: 0,
                  paddingLeft: 20,
                }}>
                  {block.stdout}
                </pre>
              )}
              {block.stderr && (
                <pre style={{
                  color: '#EF4444',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  margin: 0,
                  paddingLeft: 20,
                }}>
                  {block.stderr}
                </pre>
              )}
            </div>
          );
        })}

        {running && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
            <span>Running...</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ color: 'var(--accent)' }}>$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => {
              setInput(e.target.value);
              setHistoryIdx(-1);
            }}
            onKeyDown={handleKeyDown}
            disabled={running}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              caretColor: '#22C55E',
            }}
            placeholder={running ? '' : 'Enter command...'}
          />
        </div>
      </div>
    </div>
  );
}
