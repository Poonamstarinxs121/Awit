'use client';

import { useEffect, useState } from 'react';
import { Clock, Play, Plus, Edit2, X, ChevronDown } from 'lucide-react';

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

interface Agent {
  id: string;
  name: string;
}

const PRESETS: { label: string; value: string }[] = [
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Daily (midnight)', value: '0 0 * * *' },
  { label: 'Weekly (Sunday)', value: '0 0 * * 0' },
];

function cronToHuman(expr: string): string {
  if (!expr) return '';
  const parts = expr.split(' ');
  if (parts.length !== 5) return expr;
  const [min, hour, dom, mon, dow] = parts;
  if (expr === '*/5 * * * *') return 'Every 5 minutes';
  if (expr === '*/10 * * * *') return 'Every 10 minutes';
  if (expr === '*/15 * * * *') return 'Every 15 minutes';
  if (expr === '*/30 * * * *') return 'Every 30 minutes';
  if (min === '0' && hour === '*' && dom === '*' && mon === '*' && dow === '*') return 'Every hour';
  if (min === '0' && hour === '0' && dom === '*' && mon === '*' && dow === '*') return 'Daily at midnight';
  if (min === '0' && hour === '0' && dom === '*' && mon === '*' && dow === '0') return 'Weekly on Sunday';
  if (min === '0' && hour === '0' && dom === '*' && mon === '*' && dow === '1') return 'Weekly on Monday';
  if (hour !== '*' && dom === '*' && mon === '*' && dow === '*') return `Daily at ${hour}:${min.padStart(2, '0')}`;
  return expr;
}

const emptyForm = { name: '', schedule: '', agent: '', command: '' };

export default function CronPage() {
  const [tasks, setTasks] = useState<CronTask[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CronTask | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchTasks = () => {
    fetch('/api/cron')
      .then(r => r.json())
      .then(d => setTasks(d.tasks || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTasks();
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => setAgents(d.agents || []))
      .catch(() => {});
  }, []);

  const openAdd = () => {
    setEditingTask(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (task: CronTask) => {
    setEditingTask(task);
    setForm({
      name: task.name,
      schedule: task.schedule,
      agent: task.agent || '',
      command: task.command || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTask(null);
    setForm(emptyForm);
  };

  const handleRunNow = async (task: CronTask) => {
    if (!task.command) return;
    try {
      await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: task.command }),
      });
      fetchTasks();
    } catch {}
  };

  const activeTasks = tasks.filter(t => t.status === 'active').length;
  const pausedTasks = tasks.filter(t => t.status === 'paused').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600 }}>
          Cron Manager
        </h1>
        <button
          onClick={openAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} />
          Add Cron Job
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Jobs', value: tasks.length, color: '#3B82F6' },
          { label: 'Active', value: activeTasks, color: '#22C55E' },
          { label: 'Paused', value: pausedTasks, color: '#F59E0B' },
        ].map(card => (
          <div key={card.label} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `${card.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Clock size={20} style={{ color: card.color }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
          Loading cron jobs...
        </div>
      ) : tasks.length === 0 ? (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 40,
          textAlign: 'center',
        }}>
          <Clock size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 4 }}>
            No scheduled tasks found
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Add cron jobs to your OpenClaw config or create one above.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {tasks.map(task => (
            <div key={task.id} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: task.status === 'active' ? 'var(--positive)' : 'var(--warning)',
                    flexShrink: 0,
                  }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{task.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--accent)',
                        background: 'var(--accent-soft)',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}>
                        {task.schedule}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {cronToHuman(task.schedule)}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 6,
                    background: task.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                    color: task.status === 'active' ? 'var(--positive)' : 'var(--warning)',
                    fontWeight: 500,
                  }}>
                    {task.status}
                  </span>
                  <button
                    onClick={() => handleRunNow(task)}
                    title="Run Now"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--positive)',
                      cursor: 'pointer',
                    }}
                  >
                    <Play size={14} />
                  </button>
                  <button
                    onClick={() => openEdit(task)}
                    title="Edit"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                marginTop: 14,
                paddingTop: 14,
                borderTop: '1px solid var(--border)',
              }}>
                {task.agent && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Agent</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{task.agent}</div>
                  </div>
                )}
                {task.command && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Command</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.command}</div>
                  </div>
                )}
                {task.last_run && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Last Run</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(task.last_run).toLocaleString()}</div>
                  </div>
                )}
                {task.next_run && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Next Run</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(task.next_run).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={closeModal}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 28,
              width: 480,
              maxWidth: '90vw',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600 }}>
                {editingTask ? 'Edit Cron Job' : 'Add Cron Job'}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Daily report"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontFamily: 'var(--font-body)',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Cron Expression</label>
                <input
                  value={form.schedule}
                  onChange={e => setForm({ ...form, schedule: e.target.value })}
                  placeholder="0 * * * *"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    marginBottom: 8,
                  }}
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => setForm({ ...form, schedule: preset.value })}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: form.schedule === preset.value ? 'var(--accent-soft)' : 'transparent',
                        color: form.schedule === preset.value ? 'var(--accent)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Agent</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={form.agent}
                    onChange={e => setForm({ ...form, agent: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      fontFamily: 'var(--font-body)',
                      outline: 'none',
                      appearance: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">No agent</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Command / Action</label>
                <input
                  value={form.command}
                  onChange={e => setForm({ ...form, command: e.target.value })}
                  placeholder="openclaw run report"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button
                onClick={closeModal}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={closeModal}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {editingTask ? 'Save Changes' : 'Create Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
