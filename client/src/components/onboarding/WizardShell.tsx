import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Circle, ChevronRight, SkipForward } from 'lucide-react';
import { PublicNav } from '../PublicNav';
import { WelcomeStep } from './steps/WelcomeStep';
import { LLMProviderStep } from './steps/LLMProviderStep';
import { TelegramStep } from './steps/TelegramStep';
import { WhatsAppStep } from './steps/WhatsAppStep';
import { DiscordStep } from './steps/DiscordStep';
import { CreateAgentStep } from './steps/CreateAgentStep';
import { RegisterNodeStep } from './steps/RegisterNodeStep';
import { ProvisioningStep } from './steps/ProvisioningStep';

export interface WizardStepConfig {
  id: string;
  label: string;
  emoji: string;
  optional: boolean;
}

export interface WizardSessionData {
  configuredProviders: string[];
  telegramConfigured: boolean;
  whatsappConfigured: boolean;
  discordConfigured: boolean;
  agentCreated: boolean;
  nodeRegistered: boolean;
}

const STEPS: WizardStepConfig[] = [
  { id: 'welcome', label: 'Welcome', emoji: '👋', optional: false },
  { id: 'llm', label: 'LLM Provider', emoji: '🧠', optional: false },
  { id: 'telegram', label: 'Telegram', emoji: '💬', optional: true },
  { id: 'whatsapp', label: 'WhatsApp', emoji: '📱', optional: true },
  { id: 'discord', label: 'Discord', emoji: '🎮', optional: true },
  { id: 'agent', label: 'First Agent', emoji: '🤖', optional: true },
  { id: 'node', label: 'Register Node', emoji: '🖥️', optional: true },
  { id: 'launch', label: 'Launch', emoji: '🚀', optional: false },
];

const STORAGE_KEY = 'squidjob_wizard_progress';

interface WizardProgress {
  currentStep: number;
  completedSteps: number[];
  skippedSteps: number[];
  sessionData: WizardSessionData;
}

function loadProgress(): WizardProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return {
    currentStep: 0,
    completedSteps: [],
    skippedSteps: [],
    sessionData: {
      configuredProviders: [],
      telegramConfigured: false,
      whatsappConfigured: false,
      discordConfigured: false,
      agentCreated: false,
      nodeRegistered: false,
    },
  };
}

function saveProgress(progress: WizardProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function clearWizardProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

export function OnboardingWizard() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<WizardProgress>(loadProgress);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const currentStepIndex = progress.currentStep;
  const currentStepConfig = STEPS[currentStepIndex];

  const goToStep = useCallback((index: number) => {
    setProgress(prev => ({ ...prev, currentStep: index }));
  }, []);

  const completeStep = useCallback((sessionUpdate?: Partial<WizardSessionData>) => {
    setProgress(prev => {
      const newCompleted = prev.completedSteps.includes(prev.currentStep)
        ? prev.completedSteps
        : [...prev.completedSteps, prev.currentStep];
      const newSkipped = prev.skippedSteps.filter(s => s !== prev.currentStep);
      const nextStep = Math.min(prev.currentStep + 1, STEPS.length - 1);
      return {
        ...prev,
        currentStep: nextStep,
        completedSteps: newCompleted,
        skippedSteps: newSkipped,
        sessionData: sessionUpdate ? { ...prev.sessionData, ...sessionUpdate } : prev.sessionData,
      };
    });
  }, []);

  const skipStep = useCallback(() => {
    setProgress(prev => {
      const newSkipped = prev.skippedSteps.includes(prev.currentStep)
        ? prev.skippedSteps
        : [...prev.skippedSteps, prev.currentStep];
      const nextStep = Math.min(prev.currentStep + 1, STEPS.length - 1);
      return {
        ...prev,
        currentStep: nextStep,
        skippedSteps: newSkipped,
      };
    });
  }, []);

  const getStepStatus = (index: number): 'completed' | 'skipped' | 'active' | 'upcoming' => {
    if (progress.completedSteps.includes(index)) return 'completed';
    if (progress.skippedSteps.includes(index)) return 'skipped';
    if (index === currentStepIndex) return 'active';
    return 'upcoming';
  };

  const renderStep = () => {
    switch (currentStepConfig.id) {
      case 'welcome':
        return <WelcomeStep onNext={() => completeStep()} />;
      case 'llm':
        return (
          <LLMProviderStep
            onNext={(providers) => completeStep({ configuredProviders: providers })}
          />
        );
      case 'telegram':
        return (
          <TelegramStep
            onNext={() => completeStep({ telegramConfigured: true })}
            onSkip={skipStep}
          />
        );
      case 'whatsapp':
        return (
          <WhatsAppStep
            onNext={() => completeStep({ whatsappConfigured: true })}
            onSkip={skipStep}
          />
        );
      case 'discord':
        return (
          <DiscordStep
            onNext={() => completeStep({ discordConfigured: true })}
            onSkip={skipStep}
          />
        );
      case 'agent':
        return (
          <CreateAgentStep
            configuredProviders={progress.sessionData.configuredProviders}
            onNext={() => completeStep({ agentCreated: true })}
            onSkip={skipStep}
          />
        );
      case 'node':
        return (
          <RegisterNodeStep
            onNext={() => completeStep({ nodeRegistered: true })}
            onSkip={skipStep}
          />
        );
      case 'launch':
        return (
          <ProvisioningStep
            sessionData={progress.sessionData}
            completedSteps={progress.completedSteps.map(i => STEPS[i]?.id).filter(Boolean)}
            skippedSteps={progress.skippedSteps.map(i => STEPS[i]?.id).filter(Boolean)}
            onComplete={() => {
              clearWizardProgress();
              window.location.href = '/dashboard';
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <PublicNav actionLabel="Dashboard" actionTo="/" />

      <div className="flex-1 flex">
        <div className="hidden md:flex w-72 border-r border-[var(--border)] bg-[var(--card)] flex-col p-6">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-6">Setup Progress</h2>
          <div className="space-y-1 flex-1">
            {STEPS.map((step, index) => {
              const status = getStepStatus(index);
              return (
                <button
                  key={step.id}
                  onClick={() => {
                    if (status === 'completed' || status === 'skipped' || index <= currentStepIndex) {
                      goToStep(index);
                    }
                  }}
                  disabled={status === 'upcoming'}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    status === 'active'
                      ? 'bg-brand-accent/10 text-text-primary'
                      : status === 'completed'
                      ? 'text-text-secondary hover:bg-[var(--surface-elevated)]'
                      : status === 'skipped'
                      ? 'text-text-muted hover:bg-[var(--surface-elevated)]'
                      : 'text-text-muted cursor-not-allowed'
                  }`}
                >
                  <span className="shrink-0">
                    {status === 'completed' ? (
                      <CheckCircle size={18} className="text-green-500" />
                    ) : status === 'skipped' ? (
                      <SkipForward size={18} className="text-text-muted" />
                    ) : status === 'active' ? (
                      <div className="w-[18px] h-[18px] rounded-full border-2 border-brand-accent flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-brand-accent" />
                      </div>
                    ) : (
                      <Circle size={18} className="text-text-muted" />
                    )}
                  </span>
                  <span className="text-sm font-medium flex-1">{step.label}</span>
                  {step.optional && status === 'upcoming' && (
                    <span className="text-[10px] text-text-muted">Optional</span>
                  )}
                  {status === 'active' && (
                    <ChevronRight size={14} className="text-brand-accent" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <div className="flex items-center justify-between text-xs text-text-muted mb-2">
              <span>Progress</span>
              <span>{Math.round(((progress.completedSteps.length + progress.skippedSteps.length) / (STEPS.length - 1)) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${((progress.completedSteps.length + progress.skippedSteps.length) / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 flex justify-center px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-2xl">
            <div className="md:hidden mb-6">
              <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
                <span>{currentStepConfig.emoji}</span>
                <span>Step {currentStepIndex + 1} of {STEPS.length}</span>
                {currentStepConfig.optional && (
                  <span className="text-[10px] bg-[var(--surface-elevated)] px-2 py-0.5 rounded-full">Optional</span>
                )}
              </div>
              <div className="h-1.5 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${((currentStepIndex) / (STEPS.length - 1)) * 100}%` }}
                />
              </div>
            </div>

            {renderStep()}
          </div>
        </div>
      </div>
    </div>
  );
}
