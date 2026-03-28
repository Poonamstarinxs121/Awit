import { useState, useEffect } from 'react';
import { CheckCircle, Loader2, SkipForward, AlertCircle } from 'lucide-react';
import { apiPost } from '../../../api/client';
import type { WizardSessionData } from '../WizardShell';

interface ProvisionItem {
  id: string;
  label: string;
  description: string;
  emoji: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

interface Props {
  sessionData: WizardSessionData;
  completedSteps: string[];
  skippedSteps: string[];
  onComplete: () => void;
}

export function ProvisioningStep({ sessionData, completedSteps, skippedSteps, onComplete }: Props) {
  const [items, setItems] = useState<ProvisionItem[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [setupError, setSetupError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const allItems: ProvisionItem[] = [
      { id: 'provision', label: 'Provisioning your HQ', description: 'Creating your dedicated AI environment', emoji: '🚀', status: 'pending' },
      { id: 'prepare', label: 'Preparing environment', description: 'Uploading configuration files', emoji: '📦', status: 'pending' },
    ];

    if (sessionData.configuredProviders.length > 0) {
      allItems.push({ id: 'llm', label: 'Configuring LLM providers', description: `${sessionData.configuredProviders.length} provider(s) connected`, emoji: '🧠', status: 'pending' });
    }

    if (sessionData.telegramConfigured) {
      allItems.push({ id: 'telegram', label: 'Linking Telegram', description: 'Connecting your bot', emoji: '💬', status: 'pending' });
    } else if (skippedSteps.includes('telegram')) {
      allItems.push({ id: 'telegram', label: 'Telegram', description: 'Skipped', emoji: '💬', status: 'skipped' });
    }

    if (sessionData.whatsappConfigured) {
      allItems.push({ id: 'whatsapp', label: 'Connecting WhatsApp', description: 'Via Twilio', emoji: '📱', status: 'pending' });
    } else if (skippedSteps.includes('whatsapp')) {
      allItems.push({ id: 'whatsapp', label: 'WhatsApp', description: 'Skipped', emoji: '📱', status: 'skipped' });
    }

    if (sessionData.discordConfigured) {
      allItems.push({ id: 'discord', label: 'Setting up Discord', description: 'Webhook configured', emoji: '🎮', status: 'pending' });
    } else if (skippedSteps.includes('discord')) {
      allItems.push({ id: 'discord', label: 'Discord', description: 'Skipped', emoji: '🎮', status: 'skipped' });
    }

    if (sessionData.agentCreated) {
      allItems.push({ id: 'agent', label: 'Deploying first agent', description: 'Agent is ready', emoji: '🤖', status: 'pending' });
    } else if (skippedSteps.includes('agent')) {
      allItems.push({ id: 'agent', label: 'First Agent', description: 'Skipped', emoji: '🤖', status: 'skipped' });
    }

    if (sessionData.nodeRegistered) {
      allItems.push({ id: 'node', label: 'Registering node', description: 'Node connected', emoji: '🖥️', status: 'pending' });
    } else if (skippedSteps.includes('node')) {
      allItems.push({ id: 'node', label: 'Node', description: 'Skipped', emoji: '🖥️', status: 'skipped' });
    }

    allItems.push(
      { id: 'configure', label: 'Configuring Mission Control', description: 'Setting up workspace', emoji: '⚙️', status: 'pending' },
      { id: 'finalize', label: 'Finalizing setup', description: 'Security hardening', emoji: '🛡️', status: 'pending' },
      { id: 'activate', label: 'Final activation', description: 'Launching your squad', emoji: '✨', status: 'pending' },
    );

    setItems(allItems);
  }, [sessionData, completedSteps, skippedSteps]);

  useEffect(() => {
    if (items.length === 0) return;

    const pendingItems = items.filter(i => i.status === 'pending');
    if (pendingItems.length === 0) return;

    const durations = [800, 600, 1000, 800, 700, 600, 500, 800, 600, 500, 400];
    let stepIdx = 0;
    let timeout: NodeJS.Timeout;

    const pendingIndices = items.map((item, idx) => item.status === 'pending' ? idx : -1).filter(i => i >= 0);

    function advanceStep() {
      if (stepIdx >= pendingIndices.length) {
        apiPost('/v1/setup/complete', {})
          .then(() => {
            setIsComplete(true);
          })
          .catch(err => {
            console.error('Failed to mark setup complete:', err);
            setSetupError(true);
          });
        return;
      }

      const currentIdx = pendingIndices[stepIdx];

      setItems(prev => prev.map((s, i) => {
        if (s.status === 'skipped') return s;
        if (pendingIndices.indexOf(i) < stepIdx && s.status !== 'completed') return { ...s, status: 'completed' as const };
        if (i === currentIdx) return { ...s, status: 'in_progress' as const };
        return s;
      }));

      timeout = setTimeout(() => {
        setItems(prev => prev.map((s, i) => {
          if (i === currentIdx) return { ...s, status: 'completed' as const };
          return s;
        }));
        stepIdx++;
        advanceStep();
      }, durations[stepIdx] || 600);
    }

    const startTimeout = setTimeout(advanceStep, 500);

    return () => {
      clearTimeout(timeout);
      clearTimeout(startTimeout);
    };
  }, [items.length]);

  const completedCount = items.filter(s => s.status === 'completed').length;
  const totalActionable = items.filter(s => s.status !== 'skipped').length;
  const progress = totalActionable > 0 ? Math.round((completedCount / totalActionable) * 100) : 0;

  async function handleRetryComplete() {
    setRetrying(true);
    setSetupError(false);
    try {
      await apiPost('/v1/setup/complete', {});
      setIsComplete(true);
    } catch (err) {
      console.error('Failed to mark setup complete:', err);
      setSetupError(true);
    } finally {
      setRetrying(false);
    }
  }

  if (setupError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[rgba(255,59,48,0.1)] flex items-center justify-center mx-auto">
            <AlertCircle size={32} className="text-[var(--negative)]" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Setup Completion Failed</h1>
          <p className="text-text-secondary">We couldn't finalize your setup. Please try again.</p>

          <button
            onClick={handleRetryComplete}
            disabled={retrying}
            className="w-full py-4 bg-brand-accent hover:bg-brand-accent-hover text-white text-lg font-semibold rounded-full transition-colors shadow-lg disabled:opacity-50"
          >
            {retrying ? 'Retrying...' : 'Retry Setup Completion'}
          </button>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md text-center space-y-6">
          <div className="text-6xl">🎉</div>
          <h1 className="text-3xl font-bold text-text-primary">Your Mission Control is Ready!</h1>
          <p className="text-text-secondary">Your workspace has been configured and is ready for action.</p>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left">
            <p className="text-sm text-green-800 font-medium">All set!</p>
            <p className="text-sm text-green-700 mt-1">Head to the dashboard to start managing your AI squad.</p>
          </div>

          <button
            onClick={onComplete}
            className="w-full py-4 bg-brand-accent hover:bg-brand-accent-hover text-white text-lg font-semibold rounded-full transition-colors shadow-lg"
          >
            Open Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="text-5xl">🤖</div>
        <h1 className="text-2xl font-bold text-text-primary">Building Your Mission Control</h1>
        <p className="text-text-secondary">Setting everything up. This takes just a moment!</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Progress</span>
          <span className="text-text-secondary font-medium">{progress}%</span>
        </div>
        <div className="h-2 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
              item.status === 'in_progress' ? 'bg-amber-50' : ''
            }`}
          >
            <div className="shrink-0">
              {item.status === 'completed' ? (
                <CheckCircle size={22} className="text-green-500" />
              ) : item.status === 'in_progress' ? (
                <Loader2 size={22} className="text-amber-500 animate-spin" />
              ) : item.status === 'skipped' ? (
                <SkipForward size={22} className="text-text-muted" />
              ) : (
                <div className="w-[22px] h-[22px] rounded-full border-2 border-[var(--border)]" />
              )}
            </div>
            <span className={`flex-1 text-sm ${
              item.status === 'completed'
                ? 'text-text-muted line-through'
                : item.status === 'in_progress'
                  ? 'text-text-primary font-semibold'
                  : item.status === 'skipped'
                    ? 'text-text-muted italic'
                    : 'text-text-muted'
            }`}>
              {item.label}
              {item.status === 'skipped' && <span className="ml-2 text-xs">(skipped)</span>}
            </span>
            <span className="text-lg">{item.emoji}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
