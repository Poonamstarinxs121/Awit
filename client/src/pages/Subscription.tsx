import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { apiGet, apiPost } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import { Check, Zap, Building2, Rocket, ExternalLink, AlertCircle } from 'lucide-react';

interface Plan {
  name: string;
  price: string;
  agents: number;
  tasks: number;
  features: string[];
}

interface SubscriptionRecord {
  id: string;
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  current_period_end: string | null;
  created_at: string;
}

const PLAN_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  starter: Zap,
  professional: Rocket,
  enterprise: Building2,
};

const PLAN_ORDER = ['starter', 'professional', 'enterprise'];

export function Subscription() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

  const { data: plansData, isLoading: loadingPlans } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: () => apiGet<{ plans: Record<string, Plan> }>('/v1/billing/plans'),
  });

  const { data: subData, isLoading: loadingSub } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => apiGet<{ subscription: SubscriptionRecord | null }>('/v1/billing/subscription'),
  });

  const checkoutMutation = useMutation({
    mutationFn: (plan: string) => apiPost<{ url: string }>('/v1/billing/checkout', { plan }),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onMutate: (plan) => setCheckoutPlan(plan),
    onSettled: () => setCheckoutPlan(null),
  });

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const data = await apiPost<{ url: string }>('/v1/billing/portal', {});
      if (data.url) window.location.href = data.url;
    } catch {
    } finally {
      setPortalLoading(false);
    }
  };

  const plans = plansData?.plans ?? {};
  const subscription = subData?.subscription ?? null;
  const currentPlan = subscription?.plan ?? user?.plan ?? 'starter';
  const stripeConfigured = Object.values(plans).some((p) => (p as Plan & { priceId?: string }));

  return (
    <div className="min-h-screen bg-brand-bg">
      <nav className="w-full border-b border-border-default bg-white/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-lg font-bold text-text-primary tracking-tight font-heading">SquidJob</span>
          </div>
          <Link to="/" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            &larr; Back to Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-text-primary font-heading">Subscription</h1>
          <p className="text-text-secondary">Manage your SquidJob plan and billing</p>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <Check size={18} className="text-green-600 shrink-0" />
            <p className="text-sm text-green-700 font-medium">Subscription activated successfully! Your plan has been updated.</p>
          </div>
        )}

        {canceled && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-700">Checkout was canceled. Your current plan is unchanged.</p>
          </div>
        )}

        {loadingSub ? (
          <div className="flex justify-center py-8"><Spinner size="lg" /></div>
        ) : subscription ? (
          <div className="bg-white border border-border-default rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Current Plan</p>
                <h2 className="text-xl font-bold text-text-primary capitalize mt-0.5">{subscription.plan}</h2>
                {subscription.current_period_end && (
                  <p className="text-xs text-text-muted mt-1">
                    Renews {new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${
                  subscription.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' :
                  subscription.status === 'canceled' ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-yellow-50 text-yellow-700 border-yellow-200'
                }`}>
                  {subscription.status}
                </span>
                {subscription.stripe_customer_id && (
                  <button
                    onClick={handlePortal}
                    disabled={portalLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
                  >
                    {portalLoading ? <Spinner size="sm" /> : <ExternalLink size={14} />}
                    Manage Billing
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {loadingPlans ? (
          <div className="flex justify-center py-8"><Spinner size="lg" /></div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-4">Plans</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {PLAN_ORDER.filter((k) => plans[k]).map((planKey) => {
                const plan = plans[planKey] as Plan;
                const isCurrent = currentPlan === planKey;
                const Icon = PLAN_ICONS[planKey] ?? Zap;
                const isEnterprise = planKey === 'enterprise';

                return (
                  <div
                    key={planKey}
                    className={`bg-white rounded-xl border p-6 space-y-5 transition-shadow ${
                      isCurrent ? 'border-brand-accent shadow-md ring-1 ring-brand-accent/20' : 'border-border-default hover:shadow-md'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          planKey === 'starter' ? 'bg-blue-50' :
                          planKey === 'professional' ? 'bg-purple-50' :
                          'bg-gray-100'
                        }`}>
                          <Icon size={20} className={
                            planKey === 'starter' ? 'text-brand-accent' :
                            planKey === 'professional' ? 'text-purple-600' :
                            'text-gray-600'
                          } />
                        </div>
                        {isCurrent && (
                          <span className="text-xs font-medium text-brand-accent bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                            Current Plan
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-text-primary">{plan.name}</h3>
                      <p className="text-2xl font-bold text-text-primary">{plan.price}</p>
                    </div>

                    <ul className="space-y-2.5">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-sm text-text-secondary">
                          <Check size={16} className="text-green-500 shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {isEnterprise ? (
                      <a
                        href="mailto:hello@squidjob.com?subject=Enterprise Plan Inquiry"
                        className="block w-full text-center px-4 py-2.5 rounded-lg border border-border-default text-text-primary hover:bg-surface-light transition-colors text-sm font-medium"
                      >
                        Contact Sales
                      </a>
                    ) : isCurrent ? (
                      <button
                        disabled
                        className="w-full px-4 py-2.5 rounded-lg bg-surface-light text-text-muted text-sm font-medium cursor-default border border-border-default"
                      >
                        Current Plan
                      </button>
                    ) : (
                      <button
                        onClick={() => checkoutMutation.mutate(planKey)}
                        disabled={!!checkoutPlan}
                        className="w-full px-4 py-2.5 rounded-lg bg-brand-accent hover:bg-brand-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {checkoutPlan === planKey ? <Spinner size="sm" /> : null}
                        {PLAN_ORDER.indexOf(planKey) > PLAN_ORDER.indexOf(currentPlan) ? 'Upgrade' : 'Switch'} to {plan.name}
                      </button>
                    )}
                  </div>
                );
              })}

              {Object.keys(plans).length === 0 && (
                <div className="col-span-3 py-12 text-center space-y-3">
                  <AlertCircle size={32} className="text-text-muted mx-auto" />
                  <p className="text-text-secondary">Stripe is not configured yet. Connect your Stripe account to enable billing.</p>
                  <p className="text-xs text-text-muted">Set STRIPE_SECRET_KEY and STRIPE_PRICE_* environment variables to enable billing.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-surface-light border border-border-default rounded-xl p-6 space-y-2">
          <h3 className="font-semibold text-text-primary">Bring Your Own Keys</h3>
          <p className="text-sm text-text-secondary">
            Your AI agents run on your own LLM API keys — OpenAI, Anthropic, Gemini, Groq, Mistral, or local Ollama. SquidJob charges for the platform, not for AI token usage. Configure your keys in{' '}
            <Link to="/settings" className="text-brand-accent hover:underline">Settings</Link>.
          </p>
        </div>

        <p className="text-center text-xs text-text-muted">
          Subscribed as: {user?.email}
        </p>
      </div>
    </div>
  );
}
