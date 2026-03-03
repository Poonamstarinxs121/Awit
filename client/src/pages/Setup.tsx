import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PublicNav } from '../components/PublicNav';
import { CheckCircle } from 'lucide-react';
import { apiPost } from '../api/client';

export function Setup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [botToken, setBotToken] = useState('');
  const [telegramUserId, setTelegramUserId] = useState('');
  const [authMethod, setAuthMethod] = useState<'token' | 'apikey'>('token');
  const [claudeToken, setClaudeToken] = useState('');
  const [botValidated, setBotValidated] = useState(false);
  const [botUsername, setBotUsername] = useState('');
  const [launching, setLaunching] = useState(false);

  function validateBotToken(token: string) {
    setBotToken(token);
    const match = token.match(/^(\d+):[\w-]+$/);
    if (match) {
      setBotValidated(true);
      setBotUsername('@squidjob_bot');
    } else {
      setBotValidated(false);
      setBotUsername('');
    }
  }

  const [launchError, setLaunchError] = useState('');

  async function handleLaunch() {
    setLaunching(true);
    setLaunchError('');

    try {
      await apiPost('/v1/telegram/connect', {
        bot_token: botToken,
        telegram_user_id: telegramUserId,
      });

      await apiPost('/v1/config/providers', {
        provider: 'anthropic',
        api_key: claudeToken,
      });

      navigate('/setup/provisioning', {
        state: { botToken, telegramUserId, claudeToken }
      });
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : 'Setup failed. Please check your tokens and try again.');
      setLaunching(false);
    }
  }

  const canLaunch = botToken && telegramUserId && claudeToken;

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <PublicNav actionLabel="Dashboard" actionTo="/" />

      <div className="flex-1 flex justify-center px-4 py-8">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-text-primary">Connect your bot</h1>
            <p className="text-text-secondary mt-2">Link your Telegram bot to start building your AI squad</p>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600" />
              <span className="text-sm text-green-800">Signed in as {user?.email}</span>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="font-semibold text-text-primary">Don't have a bot yet?</h3>
                  <p className="text-sm text-green-700">Create one in 60 seconds with BotFather</p>
                </div>
              </div>

              <div className="space-y-3 pl-2">
                {[
                  'Click the button below to open BotFather in Telegram',
                  <>Type <code className="bg-[var(--card)] px-1.5 py-0.5 rounded text-sm font-mono border border-green-200">/newbot</code> and send</>,
                  'Pick a name (e.g., "My AI Squad")',
                  <>Pick a username ending in <code className="bg-[var(--card)] px-1.5 py-0.5 rounded text-sm font-mono border border-green-200">_bot</code></>,
                  'Copy the token and paste it below',
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
                <label className="text-sm font-semibold text-text-primary">Telegram Bot Token</label>
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
                  'Click the button below to open @userinfobot',
                  'Send any message to the bot',
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
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm space-y-6">
            <h2 className="text-xl font-bold text-text-primary">Connect Claude</h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAuthMethod('token')}
                className={`p-4 rounded-xl border-2 text-left transition-colors ${
                  authMethod === 'token'
                    ? 'border-brand-accent bg-brand-accent/5'
                    : 'border-[var(--border)] bg-[var(--card)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-text-primary">Setup Token</span>
                  <span className="text-[10px] font-bold uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Recommended</span>
                </div>
                <p className="text-xs text-text-secondary">Uses Claude subscription</p>
                <p className="text-xs text-green-600 mt-1 font-medium">💰 Flat $20-100/mo</p>
              </button>

              <button
                onClick={() => setAuthMethod('apikey')}
                className={`p-4 rounded-xl border-2 text-left transition-colors relative ${
                  authMethod === 'apikey'
                    ? 'border-brand-accent bg-brand-accent/5'
                    : 'border-[var(--border)] bg-[var(--card)] opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-text-primary">API Key</span>
                  <span className="text-[10px] font-bold uppercase bg-[var(--surface-elevated)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full">Coming soon</span>
                </div>
                <p className="text-xs text-text-secondary">Pay per use</p>
                <p className="text-xs text-blue-600 mt-1 font-medium">📊 Usage-based</p>
              </button>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="font-semibold text-text-primary">Get a Setup Token</h3>
                  <p className="text-sm text-green-700">Requires Claude Pro ($20/mo) or Max ($100/mo) subscription</p>
                </div>
              </div>

              <div className="space-y-3 pl-2">
                {[
                  <>Subscribe to Claude Pro/Max at <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-purple-accent underline">claude.ai</a></>,
                  <>Open terminal and run:<div className="mt-1.5 bg-[var(--card)] border border-green-200 rounded-lg px-3 py-2 font-mono text-sm text-text-primary">npx @anthropic-ai/claude-code setup-token</div></>,
                  'Your browser will open — click "Approve" to authorize',
                  'Copy the token from your terminal and paste below',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <div className="text-sm text-text-primary">{step}</div>
                  </div>
                ))}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                <p className="text-sm text-yellow-800">
                  <span className="font-medium">💡 Why setup token?</span> Uses your subscription quota instead of per-API billing. Much cheaper for heavy AI usage!
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">
                {authMethod === 'token' ? 'Setup Token' : 'API Key'}
              </label>
              <input
                type="text"
                placeholder="sk-ant-oat01-..."
                value={claudeToken}
                onChange={(e) => setClaudeToken(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors font-mono text-sm"
              />
            </div>
          </div>

          {launchError && (
            <div className="bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.3)] rounded-lg px-4 py-3 text-sm text-[var(--negative)]">
              {launchError}
            </div>
          )}

          <button
            onClick={handleLaunch}
            disabled={!canLaunch || launching}
            className="w-full py-4 bg-brand-accent hover:bg-brand-accent-hover text-white text-lg font-semibold rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
          >
            {launching ? 'Connecting...' : '🚀 Launch My Mission Control'}
          </button>

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
