import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, Clock, Webhook, Play, Plus, Trash2 } from 'lucide-react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatsCard } from '../components/ui/StatsCard';
import { apiGet, apiPost, apiDelete } from '../api/client';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  schedule_type: string;
  execution_mode: string;
  command: string;
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  agent_id?: string;
}

interface Agent {
  id: string;
  name: string;
}

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  last_delivery?: string;
}

export function WorkflowsPage() {
  const [tab, setTab] = useState<'cron' | 'webhooks'>('cron');
  const [triggering, setTriggering] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    schedule: '0 9 * * *',
    schedule_type: 'cron',
    execution_mode: 'message',
    command: '',
    agent_id: '',
  });

  const qc = useQueryClient();

  const { data: cronData } = useQuery({
    queryKey: ['cron-workflows'],
    queryFn: () => apiGet<{ jobs: CronJob[] }>('/v1/cron-jobs'),
    retry: false,
  });

  const { data: webhookData } = useQuery({
    queryKey: ['webhooks-workflows'],
    queryFn: () => apiGet<{ webhooks: WebhookItem[] }>('/v1/webhooks'),
    retry: false,
  });

  const { data: agentsData } = useQuery({
    queryKey: ['agents-automation'],
    queryFn: () => apiGet<{ agents: Agent[] }>('/v1/agents'),
    retry: false,
  });

  const jobs = cronData?.jobs || [];
  const webhooks = webhookData?.webhooks || [];
  const agents = agentsData?.agents || [];

  const createMutation = useMutation({
    mutationFn: (data: any) => apiPost('/v1/cron-jobs', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cron-workflows'] });
      setShowCreate(false);
      setForm({ name: '', schedule: '0 9 * * *', schedule_type: 'cron', execution_mode: 'message', command: '', agent_id: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/v1/cron-jobs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cron-workflows'] }),
  });

  const triggerJob = async (id: string) => {
    setTriggering(id);
    try {
      await apiPost(`/v1/cron-jobs/${id}/trigger`, {});
      qc.invalidateQueries({ queryKey: ['cron-workflows'] });
    } catch (e) {
      console.error(e);
    } finally {
      setTriggering(null);
    }
  };

  const formatDate = (s?: string) => {
    if (!s) return 'Never';
    try { return new Date(s).toLocaleString(); } catch { return s; }
  };

  const inputStyle = { width: '100%', padding: '8px 12px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font-body)' };

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Automation</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Cron jobs and webhook integrations</p>
        </div>
        {tab === 'cron' && (
          <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            <Plus size={16} />
            New Job
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatsCard title="Cron Jobs" value={jobs.length} icon={<Clock size={18} />} iconColor="var(--type-cron)" />
        <StatsCard title="Active Crons" value={jobs.filter(j => j.is_active).length} icon={<Zap size={18} />} iconColor="var(--positive)" />
        <StatsCard title="Webhooks" value={webhooks.length} icon={<Webhook size={18} />} iconColor="var(--info)" />
      </div>

      {showCreate && tab === 'cron' && (
        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '16px' }}>
          <SectionHeader title="Create Cron Job" rightAction={<button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>×</button>} />
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Job Name</label>
              <input style={inputStyle} placeholder="Daily standup..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cron Schedule</label>
              <input style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="0 9 * * *" value={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent</label>
              <select style={inputStyle} value={form.agent_id} onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))}>
                <option value="">Select agent...</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Command / Message</label>
              <input style={inputStyle} placeholder="Generate daily report..." value={form.command} onChange={e => setForm(f => ({ ...f, command: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              <button onClick={() => createMutation.mutate(form)} disabled={!form.name || !form.schedule || !form.agent_id || createMutation.isPending} style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--accent)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: !form.name || !form.agent_id ? 0.5 : 1 }}>
                {createMutation.isPending ? 'Creating...' : 'Create Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="flex" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', gap: '4px' }}>
          {(['cron', 'webhooks'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer', border: 'none', backgroundColor: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? 'white' : 'var(--text-muted)' }}>
              {t === 'cron' ? 'Cron Jobs' : 'Webhooks'}
            </button>
          ))}
        </div>

        {tab === 'cron' && (
          <div>
            {jobs.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Clock size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p>No cron jobs yet. Create one to automate your agents.</p>
              </div>
            ) : jobs.map((job, i) => (
              <div key={job.id} className="flex items-center gap-4" style={{ padding: '14px 20px', borderBottom: i < jobs.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background-color 150ms' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: job.is_active ? 'var(--positive)' : 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{job.name}</div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '2px' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--type-cron)', backgroundColor: 'var(--type-cron-bg)', padding: '2px 7px', borderRadius: '4px' }}>{job.schedule}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mode: {job.execution_mode}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last: {formatDate(job.last_run_at)}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Next: {formatDate(job.next_run_at)}</span>
                  </div>
                  {job.command && (
                    <div className="line-clamp-1" style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>{job.command}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => triggerJob(job.id)} disabled={triggering === job.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                    <Play size={12} />
                    {triggering === job.id ? 'Running...' : 'Run'}
                  </button>
                  <button onClick={() => deleteMutation.mutate(job.id)} style={{ padding: '5px', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'webhooks' && (
          <div>
            {webhooks.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}><Webhook size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} /><p>No webhooks configured</p></div>
            ) : webhooks.map((wh, i) => (
              <div key={wh.id} className="flex items-center gap-4" style={{ padding: '14px 20px', borderBottom: i < webhooks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: wh.enabled ? 'var(--positive)' : 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{wh.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    {wh.url} · Events: {wh.events?.join(', ') || 'all'}
                  </div>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, backgroundColor: wh.enabled ? 'var(--positive-soft)' : 'var(--surface-elevated)', color: wh.enabled ? 'var(--positive)' : 'var(--text-muted)' }}>
                  {wh.enabled ? 'active' : 'inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
