import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { apiPost } from '../../../api/client';

interface Props {
  configuredProviders: string[];
  onNext: () => void;
  onSkip: () => void;
}

const MODEL_OPTIONS: Record<string, { label: string; models: string[] }> = {
  anthropic: { label: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'] },
  openai: { label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  google: { label: 'Google', models: ['gemini-2.0-flash', 'gemini-1.5-pro'] },
  mistral: { label: 'Mistral', models: ['mistral-large-latest', 'mistral-medium-latest'] },
  groq: { label: 'Groq', models: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768'] },
  ollama: { label: 'Ollama', models: ['llama3', 'mistral', 'codellama'] },
};

export function CreateAgentStep({ configuredProviders, onNext, onSkip }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);

  const availableModels = configuredProviders.flatMap(p => {
    const opts = MODEL_OPTIONS[p];
    if (!opts) return [];
    return opts.models.map(m => ({ provider: p, model: m, label: `${opts.label} - ${m}` }));
  });

  async function handleCreate() {
    if (!name.trim()) {
      setError('Agent name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const modelParts = selectedModel.split('/');
      const provider = modelParts[0] || configuredProviders[0] || 'anthropic';
      const model = modelParts[1] || availableModels[0]?.model || 'claude-sonnet-4-20250514';

      await apiPost('/v1/agents', {
        name: name.trim(),
        role: description.trim() || 'General Assistant',
        soul_md: systemPrompt.trim() || '',
        model_config: {
          provider,
          model,
        },
        level: 'specialist',
      });
      setCreated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary">Create Your First Agent</h1>
        <p className="text-text-secondary mt-2">Set up an AI agent to start working for you</p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm space-y-5">
        {created ? (
          <div className="text-center py-6 space-y-4">
            <div className="text-5xl">🎉</div>
            <h3 className="text-xl font-bold text-text-primary">Agent Created!</h3>
            <p className="text-text-secondary">Your agent "{name}" is ready to go.</p>
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2 justify-center">
              <CheckCircle size={18} className="text-green-600" />
              <span className="text-sm text-green-800 font-medium">Agent is active</span>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">Agent Name *</label>
              <input
                type="text"
                placeholder="e.g., Research Assistant"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">Role / Description</label>
              <input
                type="text"
                placeholder="e.g., Helps with research and summarization"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors"
              />
            </div>

            {availableModels.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-primary">LLM Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors"
                >
                  <option value="">Use default</option>
                  {availableModels.map(m => (
                    <option key={`${m.provider}/${m.model}`} value={`${m.provider}/${m.model}`}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">System Prompt (optional)</label>
              <textarea
                placeholder="Give your agent a personality or specific instructions..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors resize-none"
              />
            </div>

            {error && (
              <div className="bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.3)] rounded-lg px-4 py-3 text-sm text-[var(--negative)]">
                {error}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={!name.trim() || saving}
              className="w-full py-3 bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-brand-accent/10 text-text-primary font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating...' : 'Create Agent'}
            </button>
          </>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-4 bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--surface-elevated)] text-text-secondary font-medium rounded-full transition-colors"
        >
          Skip for Now
        </button>
        <button
          onClick={onNext}
          disabled={!created}
          className="flex-1 py-4 bg-brand-accent hover:bg-brand-accent-hover text-white font-semibold rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
