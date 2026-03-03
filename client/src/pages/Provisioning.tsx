import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { apiPost } from '../api/client';

interface ProvisionStep {
  id: string;
  label: string;
  description: string;
  emoji: string;
  status: 'pending' | 'in_progress' | 'completed';
}

const INITIAL_STEPS: ProvisionStep[] = [
  { id: 'provision', label: 'Provisioning your HQ', description: 'Creating your dedicated AI environment', emoji: '🚀', status: 'pending' },
  { id: 'prepare', label: 'Preparing environment', description: 'Uploading configuration files', emoji: '📦', status: 'pending' },
  { id: 'install_ai', label: 'Installing AI systems', description: 'Setting up orchestration framework', emoji: '🤖', status: 'pending' },
  { id: 'connect_claude', label: 'Connecting to Claude', description: 'Authenticating with your subscription', emoji: '🧠', status: 'pending' },
  { id: 'link_telegram', label: 'Linking Telegram', description: 'Connecting your bot', emoji: '💬', status: 'pending' },
  { id: 'start_gateway', label: 'Starting AI gateway', description: 'Bringing your assistant online', emoji: '⚡', status: 'pending' },
  { id: 'install_plugins', label: 'Installing plugins', description: 'Memory, usage tracking & more', emoji: '🔌', status: 'pending' },
  { id: 'configure', label: 'Configuring Mission Control', description: 'Setting up workspace', emoji: '⚙️', status: 'pending' },
  { id: 'finalize', label: 'Finalizing setup', description: 'Security hardening', emoji: '🛡️', status: 'pending' },
  { id: 'checkpoint', label: 'Creating checkpoint', description: 'Saving state for recovery', emoji: '💾', status: 'pending' },
  { id: 'activate', label: 'Final activation', description: 'Launching your squad', emoji: '✨', status: 'pending' },
];

export function Provisioning() {
  const navigate = useNavigate();
  const location = useLocation();
  const [steps, setSteps] = useState<ProvisionStep[]>(INITIAL_STEPS);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const botUsername = (location.state as any)?.botUsername || '';

  useEffect(() => {
    const durations = [800, 600, 2500, 1000, 800, 700, 2000, 600, 500, 800, 600];

    let timeout: NodeJS.Timeout;
    let stepIdx = 0;

    function advanceStep() {
      if (stepIdx >= INITIAL_STEPS.length) {
        apiPost('/v1/setup/complete', {}).catch(err => {
          console.error('Failed to mark setup complete:', err);
        });
        setIsComplete(true);
        return;
      }

      setSteps((prev) => prev.map((s, i) => ({
        ...s,
        status: i < stepIdx ? 'completed' : i === stepIdx ? 'in_progress' : 'pending',
      })));
      setCurrentStepIndex(stepIdx);

      timeout = setTimeout(() => {
        setSteps((prev) => prev.map((s, i) => ({
          ...s,
          status: i <= stepIdx ? 'completed' : 'pending',
        })));
        stepIdx++;
        advanceStep();
      }, durations[stepIdx] || 1000);
    }

    advanceStep();

    return () => clearTimeout(timeout);
  }, []);

  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const currentStep = steps[currentStepIndex];

  if (isComplete) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-6">
          <div className="text-6xl">🎉</div>
          <h1 className="text-3xl font-bold text-text-primary">Your Mission Control is Ready!</h1>
          <p className="text-text-secondary">Your AI squad has been deployed and is ready for action.</p>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left">
            <p className="text-sm text-green-800 font-medium">Go to Telegram First!</p>
            <p className="text-sm text-green-700 mt-1">Message your bot to start talking to your Lead Agent (Oracle).</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full py-3 bg-brand-accent hover:bg-brand-accent-hover text-white font-medium rounded-full transition-colors"
            >
              Open Dashboard
            </button>
            <button
              onClick={() => { window.location.href = '/agents'; }}
              className="w-full py-3 bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--surface-elevated)] text-text-primary font-medium rounded-full transition-colors"
            >
              Meet Your Squad
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="max-w-xl w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="text-5xl">🤖</div>
          <h1 className="text-2xl font-bold text-text-primary">Building Your Mission Control</h1>
          <p className="text-text-secondary">This takes about 2 minutes. Hang tight!</p>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--surface-elevated)] flex items-center justify-center text-2xl">
              {currentStep?.emoji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-text-primary">{currentStep?.label}</h3>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              </div>
              <p className="text-sm text-text-secondary">{currentStep?.description}</p>
            </div>
          </div>
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
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                step.status === 'in_progress' ? 'bg-amber-50' : ''
              }`}
            >
              <div className="shrink-0">
                {step.status === 'completed' ? (
                  <CheckCircle size={22} className="text-green-500" />
                ) : step.status === 'in_progress' ? (
                  <Loader2 size={22} className="text-amber-500 animate-spin" />
                ) : (
                  <div className="w-[22px] h-[22px] rounded-full border-2 border-[var(--border)]" />
                )}
              </div>
              <span className={`flex-1 text-sm ${
                step.status === 'completed'
                  ? 'text-text-muted line-through'
                  : step.status === 'in_progress'
                    ? 'text-text-primary font-semibold'
                    : 'text-text-muted'
              }`}>
                {step.label}
              </span>
              <span className="text-lg">{step.emoji}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
