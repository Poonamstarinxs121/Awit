import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Zap, Clock, Webhook, Play, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatsCard } from '../components/ui/StatsCard';
import { apiGet, apiPost } from '../api/client';

interface CronJob {
  id: string;
  name: string;
  cron_expression: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  agent_id?: string;
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

  const { data: cronData, refetch: refetchCron } = useQuery({
    queryKey: ['cron-workflows'],
    queryFn: () => apiGet<{ jobs: CronJob[] }>('/v1/cron-jobs'),
    retry: false,
  });

  const { data: webhookData } = useQuery({
    queryKey: ['webhooks-workflows'],
    queryFn: () => apiGet<{ webhooks: WebhookItem[] }>('/v1/webhooks'),
    retry: false,
  });

  const jobs = cronData?.jobs || [];
  const webhooks = webhookData?.webhooks || [];

  const triggerJob = async (id: string) => {
    setTriggering(id);
    try {
      await apiPost(`/v1/cron-jobs/${id}/trigger`, {});
      await refetchCron();
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

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Workflows</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Cron jobs and webhook integrations</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatsCard title="Cron Jobs" value={jobs.length} icon={<Clock size={18} />} iconColor="var(--type-cron)" />
        <StatsCard title="Active Crons" value={jobs.filter(j => j.enabled).length} icon={<Zap size={18} />} iconColor="var(--positive)" />
        <StatsCard title="Webhooks" value={webhooks.length} icon={<Webhook size={18} />} iconColor="var(--info)" />
      </div>

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
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}><Clock size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} /><p>No cron jobs yet</p></div>
            ) : jobs.map((job, i) => (
              <div key={job.id} className="flex items-center gap-4" style={{ padding: '14px 20px', borderBottom: i < jobs.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background-color 150ms' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: job.enabled ? 'var(--positive)' : 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{job.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    {job.cron_expression} · Last: {formatDate(job.last_run)} · Next: {formatDate(job.next_run)}
                  </div>
                </div>
                <button onClick={() => triggerJob(job.id)} disabled={triggering === job.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                  <Play size={12} />
                  {triggering === job.id ? 'Running...' : 'Run'}
                </button>
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
