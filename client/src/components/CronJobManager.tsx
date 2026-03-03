import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Play, Trash2, Plus, Edit, Power, PowerOff, AlertCircle, Loader2 } from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { Spinner } from './ui/Spinner';
import type { CronJob } from '../types';

interface CronJobManagerProps {
  agentId: string;
}

interface CronJobForm {
  name: string;
  schedule: string;
  schedule_type: 'cron' | 'interval' | 'at';
  execution_mode: 'main_session' | 'isolated';
  command: string;
  model_override: string;
}

const emptyForm: CronJobForm = {
  name: '',
  schedule: '',
  schedule_type: 'cron',
  execution_mode: 'main_session',
  command: '',
  model_override: '',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CronJobManager({ agentId }: CronJobManagerProps) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [form, setForm] = useState<CronJobForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  const { data: allJobs, isLoading } = useQuery({
    queryKey: ['cron-jobs'],
    queryFn: () => apiGet<CronJob[]>('/v1/cron-jobs'),
  });

  const jobs = (allJobs || []).filter((j) => j.agent_id === agentId);

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost('/v1/cron-jobs', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron-jobs'] });
      closeModal();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch(`/v1/cron-jobs/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron-jobs'] });
      closeModal();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/v1/cron-jobs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cron-jobs'] }),
    onError: (err: Error) => setError(err.message),
  });

  const triggerMutation = useMutation({
    mutationFn: (id: string) => {
      setTriggeringId(id);
      return apiPost(`/v1/cron-jobs/${id}/trigger`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron-jobs'] });
      setTriggeringId(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setTriggeringId(null);
    },
  });

  const toggleActive = (job: CronJob) => {
    updateMutation.mutate({ id: job.id, body: { is_active: !job.is_active } });
  };

  const openCreate = () => {
    setEditingJob(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (job: CronJob) => {
    setEditingJob(job);
    setForm({
      name: job.name,
      schedule: job.schedule,
      schedule_type: job.schedule_type,
      execution_mode: job.execution_mode,
      command: job.command,
      model_override: job.model_override || '',
    });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingJob(null);
    setForm(emptyForm);
    setError(null);
  };

  const handleSubmit = () => {
    if (!form.name || !form.schedule || !form.command) {
      setError('Name, schedule, and command are required');
      return;
    }

    const body: Record<string, unknown> = {
      name: form.name,
      schedule: form.schedule,
      schedule_type: form.schedule_type,
      execution_mode: form.execution_mode,
      command: form.command,
      model_override: form.model_override || null,
    };

    if (editingJob) {
      updateMutation.mutate({ id: editingJob.id, body });
    } else {
      body.agent_id = agentId;
      createMutation.mutate(body);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={20} className="text-teal-400" />
          <h3 className="text-lg font-semibold text-text-primary">Scheduled Jobs</h3>
          <span className="text-sm text-text-muted">({jobs.length})</span>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} className="mr-1.5" />
          New Job
        </Button>
      </div>

      {error && !modalOpen && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          <AlertCircle size={14} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">✕</button>
        </div>
      )}

      {jobs.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <Clock size={40} className="mb-3 text-text-muted" />
            <p className="text-sm">No cron jobs configured for this agent</p>
            <p className="text-xs text-text-muted mt-1">Create a scheduled job to automate agent tasks</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-text-primary font-medium truncate">{job.name}</h4>
                    <Badge variant={job.is_active ? 'active' : 'default'}>
                      {job.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <span className="text-xs text-text-muted bg-[var(--surface-elevated)] px-2 py-0.5 rounded">
                      {job.schedule_type}
                    </span>
                    <span className="text-xs text-text-muted bg-[var(--surface-elevated)] px-2 py-0.5 rounded">
                      {job.execution_mode === 'main_session' ? 'Main Session' : 'Isolated'}
                    </span>
                  </div>

                  <p className="text-sm text-text-secondary font-mono mb-2">{job.schedule}</p>

                  <p className="text-xs text-text-muted truncate mb-2" title={job.command}>
                    {job.command}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span>Last run: {formatDate(job.last_run_at)}</span>
                    <span>Next run: {formatDate(job.next_run_at)}</span>
                    {job.retry_count > 0 && (
                      <span className="text-amber-400">Retries: {job.retry_count}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => triggerMutation.mutate(job.id)}
                    disabled={triggeringId === job.id}
                    className="p-2 text-text-secondary hover:text-teal-400 hover:bg-[var(--surface-elevated)] rounded-lg transition-colors disabled:opacity-50"
                    title="Run Now"
                  >
                    {triggeringId === job.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                  </button>
                  <button
                    onClick={() => toggleActive(job)}
                    className={`p-2 rounded-lg transition-colors ${
                      job.is_active
                        ? 'text-teal-400 hover:text-amber-400 hover:bg-[var(--surface-elevated)]'
                        : 'text-text-muted hover:text-teal-400 hover:bg-[var(--surface-elevated)]'
                    }`}
                    title={job.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {job.is_active ? <Power size={16} /> : <PowerOff size={16} />}
                  </button>
                  <button
                    onClick={() => openEdit(job)}
                    className="p-2 text-text-secondary hover:text-blue-400 hover:bg-[var(--surface-elevated)] rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this cron job?')) {
                        deleteMutation.mutate(job.id);
                      }
                    }}
                    className="p-2 text-text-secondary hover:text-red-400 hover:bg-[var(--surface-elevated)] rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingJob ? 'Edit Cron Job' : 'Create Cron Job'}
      >
        <div className="space-y-4">
          {error && modalOpen && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Daily report generation"
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Schedule Type</label>
            <select
              value={form.schedule_type}
              onChange={(e) => setForm({ ...form, schedule_type: e.target.value as CronJobForm['schedule_type'] })}
              className="w-full px-4 py-2.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
            >
              <option value="cron">Cron Expression</option>
              <option value="interval">Interval</option>
              <option value="at">At (specific time)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Input
              label="Schedule Expression"
              value={form.schedule}
              onChange={(e) => setForm({ ...form, schedule: e.target.value })}
              placeholder={
                form.schedule_type === 'cron'
                  ? '*/5 * * * *'
                  : form.schedule_type === 'interval'
                  ? '30m'
                  : '2025-12-31T09:00:00Z'
              }
            />
            <p className="text-xs text-text-muted">
              {form.schedule_type === 'cron' && 'Examples: "*/5 * * * *" (every 5 min), "0 9 * * *" (daily at 9am), "0 0 * * 1" (weekly Monday)'}
              {form.schedule_type === 'interval' && 'Examples: "30m" (every 30 minutes), "2h" (every 2 hours), "1d" (every day)'}
              {form.schedule_type === 'at' && 'ISO 8601 datetime for a one-time execution'}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Execution Mode</label>
            <select
              value={form.execution_mode}
              onChange={(e) => setForm({ ...form, execution_mode: e.target.value as CronJobForm['execution_mode'] })}
              className="w-full px-4 py-2.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
            >
              <option value="main_session">Main Session</option>
              <option value="isolated">Isolated</option>
            </select>
            <p className="text-xs text-text-muted">
              Main Session shares conversation context. Isolated runs in a fresh session.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Command</label>
            <textarea
              value={form.command}
              onChange={(e) => setForm({ ...form, command: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-text-primary font-mono text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-y"
              placeholder="Generate the daily standup report and post it to the team channel"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Model Override (optional)</label>
            <select
              value={form.model_override}
              onChange={(e) => setForm({ ...form, model_override: e.target.value })}
              className="w-full px-4 py-2.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
            >
              <option value="">Use agent default</option>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4-turbo">gpt-4-turbo</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? <Spinner size="sm" className="mr-2" /> : null}
              {editingJob ? 'Save Changes' : 'Create Job'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
