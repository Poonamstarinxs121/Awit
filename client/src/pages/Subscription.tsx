import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Check } from 'lucide-react';

const FEATURES = [
  'Unlimited AI agents',
  'Mission Control dashboard',
  'Telegram integration',
  'Custom squad setup',
  'Personal onboarding',
  'Priority support',
];

export function Subscription() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-brand-bg">
      <nav className="w-full border-b border-border-default bg-white/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-lg font-bold text-text-primary tracking-tight">SquidJob</span>
          </div>
          <Link to="/" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            &larr; Back to Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <h1 className="text-3xl font-bold text-text-primary text-center">Subscription</h1>

        <div className="bg-white border border-border-default rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Early Access Plan</h2>
              <p className="text-text-secondary text-sm mt-1">$99/month + your Claude subscription</p>
            </div>
            <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-sm font-medium">
              Active
            </span>
          </div>

          <p className="text-text-muted text-sm mt-4">
            Subscribed as: {user?.email}
          </p>

          <button className="mt-4 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors">
            Manage Subscription
          </button>

          <p className="text-xs text-text-muted mt-2">
            Update payment method, view invoices, or cancel your subscription.
          </p>
        </div>

        <div className="bg-white border border-border-default rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-text-primary mb-4">What's Included</h3>
          <div className="space-y-3">
            {FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <Check size={18} className="text-green-500 shrink-0" />
                <span className="text-text-primary text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔑</span>
            <div>
              <h3 className="font-bold text-text-primary">Bring Your Own Claude</h3>
              <p className="text-sm text-text-secondary mt-1">
                Your AI agents run on your Claude Pro or Max subscription ($20-100/mo). This keeps your data private and gives you full control over AI costs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
