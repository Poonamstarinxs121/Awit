import { Rocket, Brain, MessageCircle, Server, Bot } from 'lucide-react';

interface Props {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: Props) {
  const features = [
    { icon: Brain, label: 'Connect an LLM provider', desc: 'OpenAI, Claude, Gemini, and more' },
    { icon: MessageCircle, label: 'Set up messaging', desc: 'Telegram, WhatsApp, or Discord' },
    { icon: Bot, label: 'Create your first agent', desc: 'An AI assistant ready to work' },
    { icon: Server, label: 'Register a node', desc: 'Connect your infrastructure' },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="text-6xl mb-4">🚀</div>
        <h1 className="text-3xl font-bold text-text-primary">Welcome to Mission Control</h1>
        <p className="text-text-secondary mt-2 text-lg">
          Let's get your workspace set up. This wizard will guide you through everything you need to get started.
        </p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">What we'll set up</h2>
        <div className="space-y-4">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-brand-accent/10 flex items-center justify-center shrink-0">
                <f.icon size={20} className="text-brand-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{f.label}</p>
                <p className="text-xs text-text-secondary">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-sm text-green-800">
          <span className="font-medium">Don't worry —</span> most steps are optional and can be configured later from Settings. Only an LLM provider is required to get started.
        </p>
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 bg-brand-accent hover:bg-brand-accent-hover text-white text-lg font-semibold rounded-full transition-colors shadow-lg"
      >
        Let's Get Started
      </button>
    </div>
  );
}
