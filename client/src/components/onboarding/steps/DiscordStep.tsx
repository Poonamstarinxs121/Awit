import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { apiPost } from '../../../api/client';

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

export function DiscordStep({ onNext, onSkip }: Props) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  const isValidUrl = webhookUrl.startsWith('https://discord.com/api/webhooks/') || webhookUrl.startsWith('https://discordapp.com/api/webhooks/');

  async function handleConnect() {
    if (!webhookUrl || !isValidUrl) {
      setError('Please enter a valid Discord webhook URL');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiPost('/v1/webhooks', {
        url: webhookUrl,
        events: ['task.created', 'task.completed', 'agent.error'],
        secret: '',
      });
      setConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save webhook');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary">Connect Discord</h1>
        <p className="text-text-secondary mt-2">Receive notifications in your Discord server</p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm space-y-5">
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-text-primary text-sm">How to get a Discord Webhook URL</h3>
          <div className="space-y-2">
            {[
              'Open your Discord server settings',
              'Go to Integrations > Webhooks',
              'Click "New Webhook" and choose a channel',
              'Copy the Webhook URL and paste below',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-sm text-text-primary">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-text-primary">Webhook URL</label>
          <input
            type="url"
            placeholder="https://discord.com/api/webhooks/..."
            value={webhookUrl}
            onChange={(e) => { setWebhookUrl(e.target.value); setError(''); }}
            className={`w-full px-4 py-3 border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors font-mono text-sm ${
              webhookUrl && isValidUrl ? 'border-brand-accent bg-brand-accent/5' : 'border-[var(--border)] bg-[var(--card)]'
            }`}
          />
          {webhookUrl && !isValidUrl && (
            <p className="text-xs text-[var(--negative)]">URL must start with https://discord.com/api/webhooks/</p>
          )}
        </div>

        {connected && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2">
            <CheckCircle size={18} className="text-green-600" />
            <span className="text-sm text-green-800 font-medium">Discord webhook saved!</span>
          </div>
        )}

        {error && (
          <div className="bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.3)] rounded-lg px-4 py-3 text-sm text-[var(--negative)]">
            {error}
          </div>
        )}

        {!connected && (
          <button
            onClick={handleConnect}
            disabled={!isValidUrl || saving}
            className="w-full py-3 bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-brand-accent/10 text-text-primary font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Webhook'}
          </button>
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
          disabled={!connected}
          className="flex-1 py-4 bg-brand-accent hover:bg-brand-accent-hover text-white font-semibold rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
