import { useState } from 'react';
import { CheckCircle, Plus, Trash2, Key } from 'lucide-react';
import { apiPost, apiGet } from '../../../api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Props {
  onNext: (providers: string[]) => void;
}

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic (Claude)', color: '#d97757', placeholder: 'sk-ant-...', pattern: /^sk-ant-/ },
  { id: 'openai', label: 'OpenAI', color: '#10a37f', placeholder: 'sk-...', pattern: /^sk-/ },
  { id: 'google', label: 'Google Gemini', color: '#4285f4', placeholder: 'AIza...', pattern: /^AIza/ },
  { id: 'mistral', label: 'Mistral', color: '#ff7000', placeholder: 'Your Mistral API key', pattern: /.{8,}/ },
  { id: 'groq', label: 'Groq', color: '#f55036', placeholder: 'gsk_...', pattern: /^gsk_/ },
  { id: 'ollama', label: 'Ollama (Local)', color: '#888', placeholder: 'http://localhost:11434', pattern: /^https?:\/\// },
];

export function LLMProviderStep({ onNext }: Props) {
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [authMethod, setAuthMethod] = useState<'token' | 'apikey'>('token');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: providersData } = useQuery({
    queryKey: ['providers'],
    queryFn: () => apiGet<{ providers: { id: string; provider: string; status: string }[] }>('/v1/config/providers'),
  });

  const connectedProviders = providersData?.providers ?? [];
  const hasProvider = connectedProviders.length > 0;

  const providerConfig = PROVIDERS.find(p => p.id === selectedProvider)!;

  const isKeyFormatValid = (() => {
    const trimmed = apiKey.trim();
    if (!trimmed) return false;
    return providerConfig.pattern.test(trimmed);
  })();

  async function handleConnect() {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    if (!isKeyFormatValid) {
      const formatHints: Record<string, string> = {
        anthropic: 'Anthropic keys should start with "sk-ant-"',
        openai: 'OpenAI keys should start with "sk-"',
        google: 'Google Gemini keys should start with "AIza"',
        mistral: 'Key must be at least 8 characters',
        groq: 'Groq keys should start with "gsk_"',
        ollama: 'Ollama URL must start with http:// or https://',
      };
      setError(formatHints[selectedProvider] || 'Invalid key format');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiPost('/v1/config/providers', {
        provider: selectedProvider,
        api_key: apiKey.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      setApiKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect provider');
    } finally {
      setSaving(false);
    }
  }

  function handleNext() {
    const providerIds = connectedProviders.map(p => p.provider);
    onNext(providerIds);
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary">Connect an LLM Provider</h1>
        <p className="text-text-secondary mt-2">Add at least one AI provider to power your agents</p>
      </div>

      {connectedProviders.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Connected Providers</h3>
          {connectedProviders.map(p => {
            const info = PROVIDERS.find(pr => pr.id === p.provider);
            return (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-[var(--surface-elevated)] rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-500" />
                  <span className="text-sm font-medium text-text-primary">{info?.label || p.provider}</span>
                </div>
                <span className="text-xs text-green-600 font-medium">Active</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm space-y-5">
        <h2 className="text-lg font-bold text-text-primary">Add a Provider</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => { setSelectedProvider(p.id); setApiKey(''); setError(''); }}
              className={`px-3 py-2.5 rounded-lg border-2 text-left text-sm font-medium transition-colors ${
                selectedProvider === p.id
                  ? 'border-brand-accent bg-brand-accent/5 text-text-primary'
                  : 'border-[var(--border)] bg-[var(--card)] text-text-secondary hover:border-text-muted'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                {p.label}
              </div>
            </button>
          ))}
        </div>

        {selectedProvider === 'anthropic' && (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setAuthMethod('token')}
                className={`p-3 rounded-xl border-2 text-left transition-colors ${
                  authMethod === 'token'
                    ? 'border-brand-accent bg-brand-accent/5'
                    : 'border-[var(--border)] bg-[var(--card)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-text-primary text-sm">Setup Token</span>
                  <span className="text-[10px] font-bold uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Recommended</span>
                </div>
                <p className="text-xs text-text-secondary">Uses Claude subscription</p>
              </button>
              <button
                onClick={() => setAuthMethod('apikey')}
                className={`p-3 rounded-xl border-2 text-left transition-colors ${
                  authMethod === 'apikey'
                    ? 'border-brand-accent bg-brand-accent/5'
                    : 'border-[var(--border)] bg-[var(--card)]'
                }`}
              >
                <span className="font-semibold text-text-primary text-sm">API Key</span>
                <p className="text-xs text-text-secondary">Pay per use</p>
              </button>
            </div>

            {authMethod === 'token' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3 mb-4">
                <h3 className="font-semibold text-text-primary text-sm">Get a Setup Token</h3>
                <div className="space-y-2">
                  {[
                    <>Subscribe to Claude Pro/Max at <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-purple-accent underline">claude.ai</a></>,
                    <>Run: <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono border border-green-200">npx @anthropic-ai/claude-code setup-token</code></>,
                    'Approve in your browser when prompted',
                    'Copy the token and paste below',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-sm text-text-primary">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-semibold text-text-primary">
            {selectedProvider === 'anthropic' ? (authMethod === 'token' ? 'Setup Token' : 'API Key') :
             selectedProvider === 'ollama' ? 'Ollama URL' : 'API Key'}
          </label>
          <input
            type="text"
            placeholder={providerConfig.placeholder}
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setError(''); }}
            className={`w-full px-4 py-3 border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors font-mono text-sm ${
              apiKey && isKeyFormatValid ? 'border-brand-accent bg-brand-accent/5' : 'border-[var(--border)] bg-[var(--card)]'
            }`}
          />
          {apiKey && !isKeyFormatValid && (
            <p className="text-xs text-[var(--negative)] mt-1">Invalid format — expected pattern: {providerConfig.placeholder}</p>
          )}
        </div>

        {error && (
          <div className="bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.3)] rounded-lg px-4 py-3 text-sm text-[var(--negative)]">
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={!isKeyFormatValid || saving}
          className="w-full py-3 bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-brand-accent/10 text-text-primary font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          {saving ? 'Connecting...' : 'Connect Provider'}
        </button>
      </div>

      <button
        onClick={handleNext}
        disabled={!hasProvider}
        className="w-full py-4 bg-brand-accent hover:bg-brand-accent-hover text-white text-lg font-semibold rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
      >
        Continue
      </button>

      {!hasProvider && (
        <p className="text-center text-sm text-text-muted">Connect at least one provider to continue</p>
      )}
    </div>
  );
}
