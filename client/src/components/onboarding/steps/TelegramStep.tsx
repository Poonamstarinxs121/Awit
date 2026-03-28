import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { apiPost } from '../../../api/client';

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

export function TelegramStep({ onNext, onSkip }: Props) {
  const [botToken, setBotToken] = useState('');
  const [telegramUserId, setTelegramUserId] = useState('');
  const [botValidated, setBotValidated] = useState(false);
  const [botUsername, setBotUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testSuccess, setTestSuccess] = useState(false);

  function validateBotToken(token: string) {
    setBotToken(token);
    const match = token.match(/^(\d+):[\w-]+$/);
    if (match) {
      setBotValidated(true);
      setBotUsername('Bot token valid');
    } else {
      setBotValidated(false);
      setBotUsername('');
    }
  }

  async function handleConnect(): Promise<boolean> {
    setSaving(true);
    setError('');
    try {
      await apiPost('/v1/telegram/connect', {
        bot_token: botToken,
        telegram_user_id: telegramUserId,
      });
      setTestSuccess(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Telegram');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleTestAndContinue() {
    if (testSuccess) {
      onNext();
      return;
    }
    const success = await handleConnect();
    if (success) {
      onNext();
    }
  }

  const canConnect = botToken && telegramUserId && botValidated;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary">Connect Telegram</h1>
        <p className="text-text-secondary mt-2">Link your Telegram bot for instant messaging with your AI agents</p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h3 className="font-semibold text-text-primary">Create a Telegram Bot</h3>
              <p className="text-sm text-green-700">Quick setup with BotFather</p>
            </div>
          </div>
          <div className="space-y-3 pl-2">
            {[
              'Open @BotFather in Telegram',
              <>Type <code className="bg-white px-1.5 py-0.5 rounded text-sm font-mono border border-green-200">/newbot</code> and follow the prompts</>,
              'Copy the bot token and paste below',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-purple-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-sm text-text-primary">{step}</span>
              </div>
            ))}
          </div>
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-purple-accent hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.44-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.12.098.153.229.168.326.016.097.036.317.02.489z"/></svg>
            Open @BotFather
          </a>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-text-primary">Bot Token</label>
            {botValidated && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle size={14} /> {botUsername}
              </span>
            )}
          </div>
          <input
            type="text"
            placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
            value={botToken}
            onChange={(e) => validateBotToken(e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors ${
              botValidated ? 'border-brand-accent bg-brand-accent/5' : 'border-[var(--border)] bg-[var(--card)]'
            }`}
          />
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-lg bg-purple-accent/10 flex items-center justify-center text-lg">🆔</span>
            <div>
              <h3 className="font-semibold text-text-primary">Find your Telegram ID</h3>
              <p className="text-sm text-green-700">This ensures only YOU can message your bot</p>
            </div>
          </div>
          <div className="space-y-3 pl-2">
            {[
              'Open @userinfobot in Telegram',
              'Send any message to it',
              'Copy your "Id" number and paste below',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-purple-accent text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="text-sm text-text-primary">{step}</span>
              </div>
            ))}
          </div>
          <a
            href="https://t.me/userinfobot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-purple-accent hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.44-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.12.098.153.229.168.326.016.097.036.317.02.489z"/></svg>
            Open @userinfobot
          </a>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-text-primary">Your Telegram User ID</label>
          <input
            type="text"
            placeholder="123456789"
            value={telegramUserId}
            onChange={(e) => setTelegramUserId(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors"
          />
        </div>

        {testSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2">
            <CheckCircle size={18} className="text-green-600" />
            <span className="text-sm text-green-800 font-medium">Telegram connected successfully!</span>
          </div>
        )}

        {error && (
          <div className="bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.3)] rounded-lg px-4 py-3 text-sm text-[var(--negative)]">
            {error}
          </div>
        )}

        {!testSuccess && (
          <button
            onClick={handleConnect}
            disabled={!canConnect || saving}
            className="w-full py-3 bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-brand-accent/10 text-text-primary font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Testing connection...' : 'Test Connection'}
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
          onClick={testSuccess ? onNext : handleTestAndContinue}
          disabled={!testSuccess && !canConnect}
          className="flex-1 py-4 bg-brand-accent hover:bg-brand-accent-hover text-white font-semibold rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
