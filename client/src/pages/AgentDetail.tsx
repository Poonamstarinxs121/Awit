import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, CheckCircle, AlertCircle, MessageSquare,
  Clock, BarChart3, User, Brain, Cpu, Zap, Heart,
  Play, Pause, Sparkles, Activity, ChevronRight,
  Settings2, BarChart2, Terminal,
} from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import { AgentChat } from '../components/AgentChat';
import { AgentAnalytics } from '../components/AgentAnalytics';
import { CronJobManager } from '../components/CronJobManager';
import type { Agent, AgentLevel, AgentStatus } from '../types';

const STATUS_DOT: Record<string, string> = {
  active:   '#30D158',
  idle:     '#FFD60A',
  error:    '#FF453A',
  disabled: '#636366',
};

const LEVEL_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  intern:     { bg: 'rgba(100,210,255,0.12)', text: '#64D2FF', label: 'Intern' },
  specialist: { bg: 'rgba(191,90,242,0.12)', text: '#BF5AF2', label: 'Specialist' },
  lead:       { bg: 'rgba(255,159,10,0.12)', text: '#FF9F0A', label: 'Lead' },
};

const TABS = [
  { id: 'chat',         label: 'Chat',         icon: MessageSquare,  group: 'Interact' },
  { id: 'analytics',   label: 'Analytics',    icon: BarChart3,       group: 'Interact' },
  { id: 'stats',       label: 'Task Stats',   icon: BarChart2,       group: 'Interact' },
  { id: 'identity',    label: 'Identity',     icon: User,            group: 'Configure' },
  { id: 'soul',        label: 'SOUL',         icon: Sparkles,        group: 'Configure' },
  { id: 'instructions',label: 'Instructions', icon: Brain,           group: 'Configure' },
  { id: 'capabilities',label: 'Capabilities', icon: Zap,             group: 'Configure' },
  { id: 'heartbeat',   label: 'Heartbeat',    icon: Heart,           group: 'Configure' },
  { id: 'model',       label: 'Model',        icon: Cpu,             group: 'Configure' },
  { id: 'cron',        label: 'Cron Jobs',    icon: Clock,           group: 'Automate' },
] as const;

type TabId = typeof TABS[number]['id'];

const TAB_GROUPS = ['Interact', 'Configure', 'Automate'];

interface AgentStats {
  tasks_by_status: Record<string, number>;
  total_completed: number;
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  backgroundColor: 'var(--surface-elevated)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  outline: 'none',
  cursor: 'pointer',
};

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  backgroundColor: 'var(--surface-elevated)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '12.5px',
  lineHeight: '1.6',
  resize: 'vertical' as const,
  outline: 'none',
  minHeight: '320px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  backgroundColor: 'var(--surface-elevated)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  outline: 'none',
};

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div style={{ marginBottom: '6px' }}>
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: hint ? '2px' : 0 }}>{label}</p>
      {hint && <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  );
}

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    name: '', role: '',
    level: 'intern' as AgentLevel,
    status: 'idle' as AgentStatus,
    soul_md: '', agents_md: '', tools_md: '', heartbeat_md: '',
    provider: '', model: '', temperature: 0.7,
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
    mutationFn: (updates: Record<string, unknown>) =>
      apiPatch<{ agent: Agent }>(`/v1/agents/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setSaveMsg({ type: 'success', text: 'Saved successfully' });
      setTimeout(() => setSaveMsg(null), 3000);
    },
    onError: (err: Error) => {
      setSaveMsg({ type: 'error', text: err.message || 'Failed to save' });
      setTimeout(() => setSaveMsg(null), 5000);
    },
  });

  const handleSave = () => {
    mutation.mutate({
      name: form.name, role: form.role, level: form.level, status: form.status,
      soul_md: form.soul_md, agents_md: form.agents_md,
      tools_md: form.tools_md, heartbeat_md: form.heartbeat_md,
      model_config: { provider: form.provider, model: form.model, temperature: form.temperature },
    });
  };

  const isPaused = (agent as any)?.is_paused;
  const canSave = !['stats', 'chat', 'cron', 'analytics'].includes(activeTab);

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
      <Spinner size="lg" />
    </div>
  );

  if (error || !agent) return (
    <div style={{ padding: '32px' }}>
      <button onClick={() => navigate('/agents')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
        <ArrowLeft size={15} /> Back to Agents
      </button>
      <div style={{ padding: '16px', backgroundColor: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.25)', borderRadius: '10px', color: '#FF453A', fontSize: '13px' }}>
        {error ? `Failed to load agent: ${(error as Error).message}` : 'Agent not found'}
      </div>
    </div>
  );

  const levelInfo = LEVEL_COLOR[agent.level] || LEVEL_COLOR.intern;
  const statusDot = STATUS_DOT[agent.status] || STATUS_DOT.idle;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', minHeight: 0 }}>

      {/* Back nav */}
      <button
        onClick={() => navigate('/agents')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500,
          padding: '0 0 14px', width: 'fit-content',
          transition: 'color 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <ArrowLeft size={14} strokeWidth={2} /> All Agents
      </button>

      {/* Hero header card */}
      <div style={{
        backgroundColor: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: '14px', padding: '24px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '20px', marginBottom: '16px',
        backgroundImage: 'linear-gradient(135deg, var(--card) 0%, var(--surface) 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Avatar */}
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px', flexShrink: 0,
            backgroundColor: 'var(--accent-soft)',
            border: '2px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '26px', fontWeight: 700,
            fontFamily: 'var(--font-heading)',
            color: 'var(--accent)',
            position: 'relative',
          }}>
            {agent.name.charAt(0).toUpperCase()}
            <div style={{
              position: 'absolute', bottom: '-4px', right: '-4px',
              width: '16px', height: '16px', borderRadius: '50%',
              backgroundColor: statusDot,
              border: '2.5px solid var(--card)',
              boxShadow: `0 0 8px ${statusDot}60`,
            }} />
          </div>

          {/* Name + meta */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h1 style={{
                fontSize: '22px', fontWeight: 700,
                fontFamily: 'var(--font-heading)',
                color: 'var(--text-primary)', margin: 0,
                letterSpacing: '-0.3px',
              }}>{agent.name}</h1>
              <span style={{
                padding: '2px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                backgroundColor: levelInfo.bg, color: levelInfo.text,
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>{levelInfo.label}</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 8px' }}>
              {agent.role || 'No role defined'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: statusDot, boxShadow: `0 0 6px ${statusDot}` }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'capitalize' }}>{agent.status}</span>
              </div>
              {isPaused && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#FFD60A', backgroundColor: 'rgba(255,214,10,0.1)', padding: '2px 8px', borderRadius: '5px' }}>
                  PAUSED
                </span>
              )}
              {agent.provider && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', backgroundColor: 'var(--surface-elevated)', padding: '2px 8px', borderRadius: '5px', border: '1px solid var(--border)' }}>
                  {agent.provider}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={async () => {
              const endpoint = isPaused ? `/v1/agents/${id}/resume` : `/v1/agents/${id}/pause`;
              await apiPost(endpoint, {});
              queryClient.invalidateQueries({ queryKey: ['agent', id] });
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px',
              border: '1px solid',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              backgroundColor: isPaused ? 'rgba(48,209,88,0.1)' : 'rgba(255,214,10,0.1)',
              borderColor: isPaused ? 'rgba(48,209,88,0.3)' : 'rgba(255,214,10,0.3)',
              color: isPaused ? '#30D158' : '#FFD60A',
              transition: 'all 150ms',
            }}
          >
            {isPaused ? <><Play size={13} fill="currentColor" /> Resume</> : <><Pause size={13} fill="currentColor" /> Pause</>}
          </button>
        </div>
      </div>

      {/* Two-column layout: tab sidebar + content */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

        {/* Vertical tab sidebar */}
        <div style={{
          width: '176px', flexShrink: 0,
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          {TAB_GROUPS.map((group, gi) => {
            const groupTabs = TABS.filter(t => t.group === group);
            return (
              <div key={group}>
                {gi > 0 && <div style={{ height: '1px', backgroundColor: 'var(--border)' }} />}
                <div style={{ padding: '8px 12px 4px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                    {group}
                  </span>
                </div>
                {groupTabs.map(tab => {
                  const active = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
                        padding: '8px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
                        backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: '12.5px', fontWeight: active ? 600 : 400,
                        transition: 'background-color 150ms, color 150ms',
                        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                        position: 'relative',
                      }}
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                    >
                      <Icon size={14} strokeWidth={active ? 2.3 : 1.9} style={{ color: active ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />
                      <span>{tab.label}</span>
                      {active && <ChevronRight size={12} style={{ marginLeft: 'auto', color: 'var(--accent)', flexShrink: 0 }} />}
                    </button>
                  );
                })}
                <div style={{ height: '4px' }} />
              </div>
            );
          })}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === 'chat' && id && (
            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
              <AgentChat agentId={id} agentName={agent.name} />
            </div>
          )}

          {activeTab === 'analytics' && id && (
            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', padding: '20px' }}>
              <AgentAnalytics agentId={id} />
            </div>
          )}

          {activeTab === 'cron' && id && (
            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', padding: '20px' }}>
              <CronJobManager agentId={id} />
            </div>
          )}

          {activeTab === 'stats' && (
            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>Task Statistics</h3>
              {stats ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                  <StatCard label="Completed" value={stats.total_completed ?? 0} color="#30D158" />
                  {stats.tasks_by_status && Object.entries(stats.tasks_by_status).map(([status, count]) => (
                    <StatCard key={status} label={status.replace(/_/g, ' ')} value={count as number} />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No task statistics available
                </div>
              )}
            </div>
          )}

          {activeTab === 'identity' && (
            <ConfigCard title="Identity" icon={User} onSave={handleSave} saving={mutation.isPending} saveMsg={saveMsg}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <FieldLabel label="Agent Name" />
                  <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Oracle" />
                </div>
                <div>
                  <FieldLabel label="Role" />
                  <input style={inputStyle} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Lead Research Agent" />
                </div>
                <div>
                  <FieldLabel label="Level" hint="Agent's hierarchy tier" />
                  <select style={selectStyle} value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value as AgentLevel }))}>
                    <option value="intern">Intern</option>
                    <option value="specialist">Specialist</option>
                    <option value="lead">Lead</option>
                  </select>
                </div>
                <div>
                  <FieldLabel label="Status" hint="Current operational state" />
                  <select style={selectStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as AgentStatus }))}>
                    <option value="active">Active</option>
                    <option value="idle">Idle</option>
                    <option value="error">Error</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>
            </ConfigCard>
          )}

          {activeTab === 'soul' && (
            <ConfigCard title="SOUL Configuration" icon={Sparkles} onSave={handleSave} saving={mutation.isPending} saveMsg={saveMsg}>
              <FieldLabel label="Agent Personality (SOUL.md)" hint="Defines who this agent is — their personality, boundaries, and philosophy. Written in Markdown." />
              <textarea
                style={textareaStyle}
                value={form.soul_md}
                onChange={e => setForm(f => ({ ...f, soul_md: e.target.value }))}
                placeholder={'# Agent SOUL\n\n## Identity\nI am...\n\n## Values\n- ...\n\n## Boundaries\n- ...'}
              />
            </ConfigCard>
          )}

          {activeTab === 'instructions' && (
            <ConfigCard title="Operating Instructions" icon={Brain} onSave={handleSave} saving={mutation.isPending} saveMsg={saveMsg}>
              <FieldLabel label="System Instructions (AGENTS.md)" hint="How this agent operates, its goals, and how it interacts with other agents." />
              <textarea
                style={textareaStyle}
                value={form.agents_md}
                onChange={e => setForm(f => ({ ...f, agents_md: e.target.value }))}
                placeholder={'# Operating Instructions\n\n## Primary Goals\n- ...\n\n## Workflow\n1. ...'}
              />
            </ConfigCard>
          )}

          {activeTab === 'capabilities' && (
            <ConfigCard title="Capabilities & Tools" icon={Zap} onSave={handleSave} saving={mutation.isPending} saveMsg={saveMsg}>
              <FieldLabel label="Tools & Capabilities (TOOLS.md)" hint="Define what tools, APIs, and capabilities this agent can access and how to use them." />
              <textarea
                style={textareaStyle}
                value={form.tools_md}
                onChange={e => setForm(f => ({ ...f, tools_md: e.target.value }))}
                placeholder={'# Tools & Capabilities\n\n## Available Tools\n- web_search: ...\n- code_exec: ...'}
              />
            </ConfigCard>
          )}

          {activeTab === 'heartbeat' && (
            <ConfigCard title="Heartbeat Checklist" icon={Heart} onSave={handleSave} saving={mutation.isPending} saveMsg={saveMsg}>
              <FieldLabel label="Heartbeat Protocol (HEARTBEAT.md)" hint="Checklist executed on every heartbeat interval to keep the agent aligned and productive." />
              <textarea
                style={textareaStyle}
                value={form.heartbeat_md}
                onChange={e => setForm(f => ({ ...f, heartbeat_md: e.target.value }))}
                placeholder={'# Heartbeat Checklist\n\n- [ ] Check for new tasks\n- [ ] Review pending approvals\n- [ ] Report blockers'}
              />
            </ConfigCard>
          )}

          {activeTab === 'model' && (
            <ConfigCard title="Model Configuration" icon={Cpu} onSave={handleSave} saving={mutation.isPending} saveMsg={saveMsg}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <FieldLabel label="Provider" hint="LLM provider (uses your BYOK key)" />
                  <select style={selectStyle} value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
                    <option value="">Select provider...</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google Gemini</option>
                    <option value="mistral">Mistral</option>
                    <option value="groq">Groq</option>
                    <option value="ollama">Ollama (local)</option>
                  </select>
                </div>
                <div>
                  <FieldLabel label="Model" hint="Exact model identifier" />
                  <input style={inputStyle} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="e.g. gpt-4o, claude-3-5-sonnet" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <FieldLabel label={`Temperature: ${form.temperature.toFixed(1)}`} hint="0 = deterministic, 2 = very creative" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>0.0</span>
                    <input
                      type="range" min={0} max={2} step={0.1}
                      value={form.temperature}
                      onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) }))}
                      style={{ flex: 1, accentColor: 'var(--accent)' }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>2.0</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>
                      {form.temperature.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </ConfigCard>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfigCard({ title, icon: Icon, children, onSave, saving, saveMsg }: {
  title: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  saveMsg: { type: 'success' | 'error'; text: string } | null;
}) {
  return (
    <div style={{
      backgroundColor: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: '12px', overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon size={16} strokeWidth={2} style={{ color: 'var(--accent)' } as React.CSSProperties} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {saveMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: saveMsg.type === 'success' ? '#30D158' : '#FF453A' }}>
              {saveMsg.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
              {saveMsg.text}
            </div>
          )}
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '7px',
              backgroundColor: 'var(--accent)', border: 'none',
              color: '#fff', fontSize: '12px', fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: 'opacity 150ms',
            }}
          >
            {saving ? <Spinner size="sm" /> : <Save size={13} />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      <div style={{ padding: '20px' }}>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
      borderRadius: '10px', padding: '16px',
    }}>
      <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
        {label}
      </p>
      <p style={{ fontSize: '28px', fontWeight: 700, color: color || 'var(--text-primary)', fontFamily: 'var(--font-heading)', margin: 0 }}>
        {value}
      </p>
    </div>
  );
}
