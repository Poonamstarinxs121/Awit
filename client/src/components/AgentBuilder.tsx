import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Sparkles, Check, Loader2 } from 'lucide-react';
import { apiPost } from '../api/client';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Spinner } from './ui/Spinner';
import type { Agent, AgentLevel } from '../types';

const STEPS = ['Identity', 'SoulCraft', 'Capabilities', 'Configuration', 'Review'];

const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  google: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  mistral: ['mistral-large-latest', 'mistral-small-latest', 'open-mistral-nemo'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
};

const ROLE_DEFAULTS: Record<string, { agents_md: string; tools_md: string; heartbeat_md: string }> = {
  lead: {
    agents_md: '- Coordinate team efforts and delegate tasks appropriately\n- Review work from other agents before final delivery\n- Make architectural and strategic decisions\n- Escalate blockers and communicate status to stakeholders',
    tools_md: '- Task management and delegation\n- Code review and approval\n- Strategic planning and roadmap management\n- Cross-team communication',
    heartbeat_md: '- [ ] Check for new tasks requiring delegation\n- [ ] Review pending work from team members\n- [ ] Update project status and blockers\n- [ ] Ensure team alignment on priorities',
  },
  specialist: {
    agents_md: '- Execute assigned tasks with high quality and attention to detail\n- Provide expert-level work in your domain\n- Collaborate with teammates when needed\n- Document your work and decisions',
    tools_md: '- Domain-specific tools and frameworks\n- Documentation and knowledge base access\n- Collaboration and communication channels\n- Testing and quality assurance tools',
    heartbeat_md: '- [ ] Check for newly assigned tasks\n- [ ] Continue work on in-progress items\n- [ ] Report blockers or questions\n- [ ] Update task status',
  },
  intern: {
    agents_md: '- Complete assigned tasks following provided guidelines\n- Ask questions when unsure about requirements\n- Learn from feedback and improve over time\n- Support the team with routine tasks',
    tools_md: '- Basic task execution tools\n- Documentation access for learning\n- Communication channels for asking questions',
    heartbeat_md: '- [ ] Check for new task assignments\n- [ ] Work on current tasks\n- [ ] Ask for help if blocked',
  },
};

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((step, index) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                index < currentStep
                  ? 'bg-brand-accent border-brand-accent text-white'
                  : index === currentStep
                  ? 'border-brand-accent text-brand-accent bg-transparent'
                  : 'border-border-default text-text-muted bg-transparent'
              }`}
            >
              {index < currentStep ? <Check size={18} /> : index + 1}
            </div>
            <span
              className={`text-xs mt-2 whitespace-nowrap ${
                index <= currentStep ? 'text-text-primary' : 'text-text-muted'
              }`}
            >
              {step}
            </span>
          </div>
          {index < STEPS.length - 1 && (
            <div
              className={`w-16 h-0.5 mx-2 mb-5 ${
                index < currentStep ? 'bg-brand-accent' : 'bg-border-default'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function AgentBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [useSoulCraft, setUseSoulCraft] = useState(true);

  const [form, setForm] = useState({
    name: '',
    role: '',
    level: 'specialist' as AgentLevel,
    description: '',
    tone: '',
    strengths: '',
    values: '',
    avoid: '',
    soul_md: '',
    agents_md: '',
    tools_md: '',
    heartbeat_md: '',
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
  });

  const generateSoulMutation = useMutation({
    mutationFn: () =>
      apiPost<{ soul_md: string }>('/v1/agents/generate-soul', {
        name: form.name,
        role: form.role,
        tone: form.tone,
        strengths: form.strengths,
        values: form.values,
        avoid: form.avoid,
        description: form.description,
      }),
    onSuccess: (data) => {
      setForm((prev) => ({ ...prev, soul_md: data.soul_md }));
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiPost<{ agent: Agent }>('/v1/agents', {
        name: form.name,
        role: form.role,
        level: form.level,
        soul_md: form.soul_md,
        agents_md: form.agents_md,
        tools_md: form.tools_md,
        heartbeat_md: form.heartbeat_md,
        model_config: {
          provider: form.provider,
          model: form.model,
          temperature: form.temperature,
        },
      }),
    onSuccess: (data) => {
      navigate(`/agents/${data.agent.id}`);
    },
  });

  const canProceed = () => {
    switch (step) {
      case 0:
        return form.name.trim() !== '' && form.role.trim() !== '';
      case 1:
        return form.soul_md.trim() !== '';
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (step === 0) {
      const defaults = ROLE_DEFAULTS[form.level] || ROLE_DEFAULTS.specialist;
      setForm((prev) => ({
        ...prev,
        agents_md: prev.agents_md || defaults.agents_md,
        tools_md: prev.tools_md || defaults.tools_md,
        heartbeat_md: prev.heartbeat_md || defaults.heartbeat_md,
      }));
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/agents')}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={18} /> Back to Agents
      </button>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">Create New Agent</h1>
        <p className="text-text-secondary mt-1">Build your AI squad member step by step</p>
      </div>

      <StepIndicator currentStep={step} />

      {step === 0 && (
        <Card title="Agent Identity">
          <div className="space-y-4 max-w-xl">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Aria, DevBot, QA-Rex"
            />
            <Input
              label="Role / Title"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="e.g. Frontend Engineer, QA Specialist, Content Writer"
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Level</label>
              <div className="flex gap-3">
                {(['intern', 'specialist', 'lead'] as AgentLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setForm({ ...form, level: lvl })}
                    className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium capitalize transition-all ${
                      form.level === lvl
                        ? 'border-brand-accent bg-brand-accent/10 text-text-primary'
                        : 'border-border-default bg-surface-light text-text-secondary hover:border-brand-accent/40'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">
                Description <span className="text-text-muted">(optional)</span>
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-surface-light border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-y text-sm"
                placeholder="Brief description of what this agent will do..."
              />
            </div>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card title="SoulCraft — Agent Personality">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                {useSoulCraft
                  ? 'Answer a few questions and we\'ll generate a personality profile for your agent.'
                  : 'Write the SOUL.md identity document directly.'}
              </p>
              <button
                onClick={() => setUseSoulCraft(!useSoulCraft)}
                className="text-xs text-brand-accent hover:text-brand-accent-hover transition-colors whitespace-nowrap ml-4"
              >
                {useSoulCraft ? 'Write manually instead' : 'Use SoulCraft wizard'}
              </button>
            </div>

            {useSoulCraft && (
              <div className="space-y-4">
                <div className="space-y-4 bg-surface-light/50 rounded-xl p-5 border border-border-default">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-text-secondary">
                      What tone should {form.name || 'this agent'} use?
                    </label>
                    <Input
                      value={form.tone}
                      onChange={(e) => setForm({ ...form, tone: e.target.value })}
                      placeholder="e.g. formal, casual, witty, empathetic, direct"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-text-secondary">
                      What are {form.name || 'this agent'}'s key strengths?
                    </label>
                    <textarea
                      value={form.strengths}
                      onChange={(e) => setForm({ ...form, strengths: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-3 bg-surface-light border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-y text-sm"
                      placeholder="e.g. deep technical knowledge, creative problem solving, attention to detail"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-text-secondary">
                      What values or principles guide {form.name || 'this agent'}'s work?
                    </label>
                    <textarea
                      value={form.values}
                      onChange={(e) => setForm({ ...form, values: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-3 bg-surface-light border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-y text-sm"
                      placeholder="e.g. code quality over speed, user-first thinking, transparency"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-text-secondary">
                      Are there topics {form.name || 'this agent'} should avoid or defer?
                    </label>
                    <textarea
                      value={form.avoid}
                      onChange={(e) => setForm({ ...form, avoid: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-3 bg-surface-light border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-y text-sm"
                      placeholder="e.g. security decisions, budget discussions, HR matters"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => generateSoulMutation.mutate()}
                  disabled={generateSoulMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {generateSoulMutation.isPending ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} className="mr-2" />
                      Generate SOUL.md
                    </>
                  )}
                </Button>

                {generateSoulMutation.isError && (
                  <p className="text-sm text-red-400">
                    {(generateSoulMutation.error as Error).message || 'Generation failed. A template was used instead.'}
                  </p>
                )}
              </div>
            )}

            {form.soul_md && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">
                  {useSoulCraft ? 'Generated SOUL.md — feel free to edit' : 'SOUL.md'}
                </label>
                <textarea
                  value={form.soul_md}
                  onChange={(e) => setForm({ ...form, soul_md: e.target.value })}
                  rows={10}
                  className="w-full px-4 py-3 bg-surface-light border border-border-default rounded-lg text-text-primary font-mono text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-y"
                  placeholder="Define who this agent is..."
                />
              </div>
            )}

            {!useSoulCraft && !form.soul_md && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-secondary">SOUL.md</label>
                <textarea
                  value={form.soul_md}
                  onChange={(e) => setForm({ ...form, soul_md: e.target.value })}
                  rows={12}
                  className="w-full px-4 py-3 bg-surface-light border border-border-default rounded-lg text-text-primary font-mono text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-y"
                  placeholder={'You are ' + (form.name || '[Agent Name]') + ', the ' + (form.role || '[Role]') + ' for the team.\n\nDefine personality, approach, beliefs, and working style...'}
                />
              </div>
            )}
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card title="Capabilities">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                Operating Instructions
              </label>
              <p className="text-xs text-text-muted">What should this agent do? How should it operate?</p>
              <textarea
                value={form.agents_md}
                onChange={(e) => setForm({ ...form, agents_md: e.target.value })}
                rows={8}
                className="w-full px-4 py-3 bg-surface-light border border-border-default rounded-lg text-text-primary font-mono text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-y"
                placeholder="Define operating instructions..."
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                Tools & Capabilities
              </label>
              <p className="text-xs text-text-muted">What tools and capabilities does this agent have access to?</p>
              <textarea
                value={form.tools_md}
                onChange={(e) => setForm({ ...form, tools_md: e.target.value })}
                rows={8}
                className="w-full px-4 py-3 bg-surface-light border border-border-default rounded-lg text-text-primary font-mono text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-y"
                placeholder="Define available tools..."
              />
            </div>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card title="Model Configuration">
          <div className="space-y-5 max-w-xl">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Provider</label>
              <select
                value={form.provider}
                onChange={(e) => {
                  const provider = e.target.value;
                  const models = MODEL_OPTIONS[provider];
                  setForm({ ...form, provider, model: models[0] });
                }}
                className="w-full px-4 py-2.5 bg-surface-light border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google (Gemini)</option>
                <option value="mistral">Mistral</option>
                <option value="groq">Groq</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Model</label>
              <select
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                className="w-full px-4 py-2.5 bg-surface-light border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
              >
                {(MODEL_OPTIONS[form.provider] || []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">
                Temperature: {form.temperature.toFixed(1)}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                className="w-full accent-brand-accent"
              />
              <div className="flex justify-between text-xs text-text-muted">
                <span>Precise (0.0)</span>
                <span>Creative (1.0)</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                Heartbeat Checklist
              </label>
              <p className="text-xs text-text-muted">Tasks checked on every heartbeat interval</p>
              <textarea
                value={form.heartbeat_md}
                onChange={(e) => setForm({ ...form, heartbeat_md: e.target.value })}
                rows={6}
                className="w-full px-4 py-3 bg-surface-light border border-border-default rounded-lg text-text-primary font-mono text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-y"
                placeholder="- [ ] Check for new tasks..."
              />
            </div>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card title="Review & Create">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-light rounded-lg p-4 border border-border-default">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Name</p>
                <p className="text-text-primary font-medium">{form.name}</p>
              </div>
              <div className="bg-surface-light rounded-lg p-4 border border-border-default">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Role</p>
                <p className="text-text-primary font-medium">{form.role}</p>
              </div>
              <div className="bg-surface-light rounded-lg p-4 border border-border-default">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Level</p>
                <p className="text-text-primary font-medium capitalize">{form.level}</p>
              </div>
              <div className="bg-surface-light rounded-lg p-4 border border-border-default">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Model</p>
                <p className="text-text-primary font-medium">{form.provider} / {form.model}</p>
              </div>
              <div className="bg-surface-light rounded-lg p-4 border border-border-default">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Temperature</p>
                <p className="text-text-primary font-medium">{form.temperature.toFixed(1)}</p>
              </div>
            </div>

            {form.soul_md && (
              <div className="bg-surface-light rounded-lg p-4 border border-border-default">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">SOUL.md</p>
                <p className="text-text-secondary text-sm whitespace-pre-wrap">{form.soul_md}</p>
              </div>
            )}

            {form.agents_md && (
              <div className="bg-surface-light rounded-lg p-4 border border-border-default">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">Operating Instructions</p>
                <p className="text-text-secondary text-sm whitespace-pre-wrap">{form.agents_md}</p>
              </div>
            )}

            {form.tools_md && (
              <div className="bg-surface-light rounded-lg p-4 border border-border-default">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">Tools & Capabilities</p>
                <p className="text-text-secondary text-sm whitespace-pre-wrap">{form.tools_md}</p>
              </div>
            )}

            {form.heartbeat_md && (
              <div className="bg-surface-light rounded-lg p-4 border border-border-default">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">Heartbeat Checklist</p>
                <p className="text-text-secondary text-sm whitespace-pre-wrap">{form.heartbeat_md}</p>
              </div>
            )}

            {createMutation.isError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
                {(createMutation.error as Error).message || 'Failed to create agent'}
              </div>
            )}

            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              size="lg"
              className="w-full"
            >
              {createMutation.isPending ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creating Agent...
                </>
              ) : (
                'Create Agent'
              )}
            </Button>
          </div>
        </Card>
      )}

      <div className="flex justify-between">
        {step > 0 ? (
          <Button variant="secondary" onClick={handleBack}>
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
        ) : (
          <div />
        )}
        {step < STEPS.length - 1 && (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ArrowRight size={16} className="ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
