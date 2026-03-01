import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, CheckCircle, AlertCircle, MessageSquare, Clock, BarChart3 } from 'lucide-react';
import { apiGet, apiPatch } from '../api/client';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { AgentChat } from '../components/AgentChat';
import { AgentAnalytics } from '../components/AgentAnalytics';
import { CronJobManager } from '../components/CronJobManager';
import type { Agent, AgentLevel, AgentStatus } from '../types';

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-teal-500', 'bg-purple-500', 'bg-amber-500',
  'bg-rose-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-orange-500',
];

const statusConfig: Record<string, { variant: 'active' | 'idle' | 'error' | 'default'; label: string }> = {
  active: { variant: 'active', label: 'Active' },
  idle: { variant: 'idle', label: 'Idle' },
  error: { variant: 'error', label: 'Error' },
  disabled: { variant: 'default', label: 'Disabled' },
};

const TABS = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'identity', label: 'Identity' },
  { id: 'soul', label: 'SOUL' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'heartbeat', label: 'Heartbeat' },
  { id: 'cron', label: 'Cron Jobs', icon: Clock },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'model', label: 'Model Config' },
  { id: 'stats', label: 'Stats' },
] as const;

type TabId = typeof TABS[number]['id'];

interface AgentStats {
  tasks_by_status: Record<string, number>;
  total_completed: number;
}

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    role: '',
    level: 'intern' as AgentLevel,
    status: 'idle' as AgentStatus,
    soul_md: '',
    agents_md: '',
    tools_md: '',
    heartbeat_md: '',
    provider: '',
    model: '',
    temperature: 0.7,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => apiGet<{ agent: Agent }>(`/v1/agents/${id}`),
    enabled: !!id,
  });

  const { data: statsData } = useQuery({
    queryKey: ['agent-stats', id],
    queryFn: () => apiGet<{ stats: AgentStats }>(`/v1/agents/${id}/stats`),
    enabled: !!id && activeTab === 'stats',
  });

  const agent = data?.agent;
  const stats = statsData?.stats;

  useEffect(() => {
    if (agent) {
      const mc = (agent.model_config || {}) as Record<string, unknown>;
      setForm({
        name: agent.name,
        role: agent.role,
        level: agent.level,
        status: agent.status,
        soul_md: agent.soul_md || '',
        agents_md: agent.agents_md || '',
        tools_md: agent.tools_md || '',
        heartbeat_md: agent.heartbeat_md || '',
        provider: (mc.provider as string) || '',
        model: (mc.model as string) || '',
        temperature: (mc.temperature as number) ?? 0.7,
      });
    }
  }, [agent]);

  const mutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) => apiPatch<{ agent: Agent }>(`/v1/agents/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setSaveMessage({ type: 'success', text: 'Changes saved successfully' });
      setTimeout(() => setSaveMessage(null), 3000);
    },
    onError: (err: Error) => {
      setSaveMessage({ type: 'error', text: err.message || 'Failed to save changes' });
      setTimeout(() => setSaveMessage(null), 5000);
    },
  });

  const handleSave = () => {
    mutation.mutate({
      name: form.name,
      role: form.role,
      level: form.level,
      status: form.status,
      soul_md: form.soul_md,
      agents_md: form.agents_md,
      tools_md: form.tools_md,
      heartbeat_md: form.heartbeat_md,
      model_config: {
        provider: form.provider,
        model: form.model,
        temperature: form.temperature,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/agents')} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft size={18} /> Back to Agents
        </button>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
          {error ? `Failed to load agent: ${(error as Error).message}` : 'Agent not found'}
        </div>
      </div>
    );
  }

  const statusInfo = statusConfig[agent.status] || statusConfig.idle;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/agents')} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft size={18} /> Back to Agents
      </button>

      <div className="flex items-center gap-4">
        <div className={`${AVATAR_COLORS[0]} w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl`}>
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{agent.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-text-secondary">{agent.role}</span>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border-default pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'text-text-primary bg-white border border-border-default border-b-transparent -mb-px'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'chat' && id && (
        <AgentChat agentId={id} agentName={agent.name} />
      )}

      {activeTab === 'identity' && (
        <Card>
          <div className="space-y-4 max-w-xl">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Level</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value as AgentLevel })}
                className="w-full px-4 py-2.5 bg-surface-light border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
              >
                <option value="intern">Intern</option>
                <option value="specialist">Specialist</option>
                <option value="lead">Lead</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as AgentStatus })}
                className="w-full px-4 py-2.5 bg-surface-light border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
              >
                <option value="active">Active</option>
                <option value="idle">Idle</option>
                <option value="error">Error</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'soul' && (
        <Card>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary">Agent Personality (SOUL)</label>
            <p className="text-xs text-text-muted">Defines who this agent is - their personality, boundaries, and behavioral philosophy</p>
            <textarea
              value={form.soul_md}
              onChange={(e) => setForm({ ...form, soul_md: e.target.value })}
              rows={16}
              className="w-full px-4 py-3 bg-surface-light border border-border-default rounded-lg text-text-primary font-mono text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-y"
              placeholder="# Agent SOUL&#10;&#10;Define the agent's personality..."
            />
          </div>
        </Card>
      )}

      {activeTab === 'instructions' && (
        <Card>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary">Operating Instructions</label>
            <textarea
              value={form.agents_md}
              onChange={(e) => setForm({ ...form, agents_md: e.target.value })}
              rows={16}
              className="w-full px-4 py-3 bg-surface-light border border-border-default rounded-lg text-text-primary font-mono text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-y"
              placeholder="# Operating Instructions&#10;&#10;Define how the agent operates..."
            />
          </div>
        </Card>
      )}

      {activeTab === 'capabilities' && (
        <Card>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary">Capabilities & Tools</label>
            <textarea
              value={form.tools_md}
              onChange={(e) => setForm({ ...form, tools_md: e.target.value })}
              rows={16}
              className="w-full px-4 py-3 bg-surface-light border border-border-default rounded-lg text-text-primary font-mono text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-y"
              placeholder="# Capabilities&#10;&#10;Define what tools the agent can use..."
            />
          </div>
        </Card>
      )}

      {activeTab === 'heartbeat' && (
        <Card>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary">Heartbeat Checklist</label>
            <p className="text-xs text-text-muted">Checked on every heartbeat interval</p>
            <textarea
              value={form.heartbeat_md}
              onChange={(e) => setForm({ ...form, heartbeat_md: e.target.value })}
              rows={16}
              className="w-full px-4 py-3 bg-surface-light border border-border-default rounded-lg text-text-primary font-mono text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-y"
              placeholder="# Heartbeat Checklist&#10;&#10;- [ ] Check for new tasks..."
            />
          </div>
        </Card>
      )}

      {activeTab === 'cron' && id && (
        <CronJobManager agentId={id} />
      )}

      {activeTab === 'analytics' && id && (
        <AgentAnalytics agentId={id} />
      )}

      {activeTab === 'model' && (
        <Card>
          <div className="space-y-4 max-w-xl">
            <Input label="Provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="openai" />
            <Input label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="gpt-4o" />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Temperature</label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 bg-surface-light border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
              />
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'stats' && (
        <Card>
          {stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface-light rounded-lg p-4 border border-border-default">
                  <p className="text-xs text-text-secondary uppercase tracking-wider">Completed</p>
                  <p className="text-2xl font-bold text-teal-400 mt-1">{stats.total_completed ?? 0}</p>
                </div>
                {stats.tasks_by_status && Object.entries(stats.tasks_by_status).map(([status, count]) => (
                  <div key={status} className="bg-surface-light rounded-lg p-4 border border-border-default">
                    <p className="text-xs text-text-secondary uppercase tracking-wider">{status.replace('_', ' ')}</p>
                    <p className="text-2xl font-bold text-text-primary mt-1">{count as number}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-text-muted">No task stats available for this agent.</p>
          )}
        </Card>
      )}

      {activeTab !== 'stats' && activeTab !== 'chat' && activeTab !== 'cron' && activeTab !== 'analytics' && (
        <div className="flex items-center gap-4">
          <Button onClick={handleSave} disabled={mutation.isPending} size="lg">
            {mutation.isPending ? <Spinner size="sm" className="mr-2" /> : <Save size={18} className="mr-2" />}
            Save Changes
          </Button>
          {saveMessage && (
            <div className={`flex items-center gap-2 text-sm ${saveMessage.type === 'success' ? 'text-teal-400' : 'text-red-400'}`}>
              {saveMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {saveMessage.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
