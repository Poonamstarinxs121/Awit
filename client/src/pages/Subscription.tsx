import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { apiGet, apiPost } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import { Check, Zap, Building2, Rocket, ExternalLink, AlertCircle, Crown, ArrowUpRight, ArrowDownRight, Key } from 'lucide-react';

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

const PLAN_COLORS: Record<string, { icon: string; glow: string; border: string; bg: string }> = {
  starter: {
    icon: 'text-[#0A84FF]',
    glow: 'rgba(10, 132, 255, 0.15)',
    border: 'rgba(10, 132, 255, 0.4)',
    bg: 'rgba(10, 132, 255, 0.08)',
  },
  professional: {
    icon: 'text-[#BF5AF2]',
    glow: 'rgba(191, 90, 242, 0.15)',
    border: 'rgba(191, 90, 242, 0.4)',
    bg: 'rgba(191, 90, 242, 0.08)',
  },
  enterprise: {
    icon: 'text-[#FFD60A]',
    glow: 'rgba(255, 214, 10, 0.15)',
    border: 'rgba(255, 214, 10, 0.4)',
    bg: 'rgba(255, 214, 10, 0.08)',
  },
};

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
  const currentPlan = subscription?.plan ?? 'starter';
  const currentPlanIndex = PLAN_ORDER.indexOf(currentPlan);

  const getStatusStyle = (status: string) => {
    if (status === 'active') return { bg: 'rgba(50, 215, 75, 0.12)', text: '#32D74B', border: 'rgba(50, 215, 75, 0.3)' };
    if (status === 'canceled') return { bg: 'rgba(255, 69, 58, 0.12)', text: '#FF453A', border: 'rgba(255, 69, 58, 0.3)' };
    return { bg: 'rgba(255, 214, 10, 0.12)', text: '#FFD60A', border: 'rgba(255, 214, 10, 0.3)' };
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <nav className="w-full border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(26, 26, 26, 0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>SquidJob</span>
          </div>
          <Link to="/dashboard" className="text-sm transition-colors hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
            &larr; Back to Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>Subscription & Billing</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your SquidJob plan, billing, and usage</p>
        </div>

        {success && (
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: 'rgba(50, 215, 75, 0.1)', border: '1px solid rgba(50, 215, 75, 0.25)' }}>
            <Check size={18} className="shrink-0" style={{ color: '#32D74B' }} />
            <p className="text-sm font-medium" style={{ color: '#32D74B' }}>Subscription activated successfully! Your plan has been updated.</p>
          </div>
        )}

        {canceled && (
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: 'rgba(255, 214, 10, 0.1)', border: '1px solid rgba(255, 214, 10, 0.25)' }}>
            <AlertCircle size={18} className="shrink-0" style={{ color: '#FFD60A' }} />
            <p className="text-sm" style={{ color: '#FFD60A' }}>Checkout was canceled. Your current plan is unchanged.</p>
          </div>
        )}

        {loadingSub ? (
          <div className="flex justify-center py-8"><Spinner size="lg" /></div>
        ) : (
          <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: PLAN_COLORS[currentPlan]?.glow ?? 'rgba(10, 132, 255, 0.15)' }}>
                  <Crown size={28} style={{ color: PLAN_COLORS[currentPlan]?.icon === 'text-[#0A84FF]' ? '#0A84FF' : PLAN_COLORS[currentPlan]?.icon === 'text-[#BF5AF2]' ? '#BF5AF2' : '#FFD60A' }} />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Current Plan</p>
                  <h2 className="text-2xl font-bold capitalize" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                    {plans[currentPlan]?.name ?? currentPlan}
                  </h2>
                  <div className="flex items-center gap-3 mt-1">
                    {subscription && (
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide"
                        style={{
                          backgroundColor: getStatusStyle(subscription.status).bg,
                          color: getStatusStyle(subscription.status).text,
                          border: `1px solid ${getStatusStyle(subscription.status).border}`,
                        }}
                      >
                        {subscription.status}
                      </span>
                    )}
                    {subscription?.current_period_end && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Renews {new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {subscription?.stripe_customer_id && (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
                  style={{ backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' }}
                >
                  {portalLoading ? <Spinner size="sm" /> : <ExternalLink size={14} />}
                  Manage Billing
                </button>
              )}
            </div>
          </div>
        )}

        {loadingPlans ? (
          <div className="flex justify-center py-8"><Spinner size="lg" /></div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold mb-5" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>Choose Your Plan</h2>
            <div className="grid md:grid-cols-3 gap-5">
              {PLAN_ORDER.filter((k) => plans[k]).map((planKey) => {
                const plan = plans[planKey] as Plan;
                const isCurrent = currentPlan === planKey;
                const Icon = PLAN_ICONS[planKey] ?? Zap;
                const isEnterprise = planKey === 'enterprise';
                const planIndex = PLAN_ORDER.indexOf(planKey);
                const isUpgrade = planIndex > currentPlanIndex;
                const isDowngrade = planIndex < currentPlanIndex;
                const colors = PLAN_COLORS[planKey];

                return (
                  <div
                    key={planKey}
                    className="rounded-xl p-6 space-y-5 transition-all relative"
                    style={{
                      backgroundColor: 'var(--card)',
                      border: isCurrent ? `2px solid ${colors.border}` : '1px solid var(--border)',
                      boxShadow: isCurrent ? `0 0 20px ${colors.glow}` : undefined,
                    }}
                  >
                    {isCurrent && (
                      <div
                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: colors.bg,
                          color: colors.icon === 'text-[#0A84FF]' ? '#0A84FF' : colors.icon === 'text-[#BF5AF2]' ? '#BF5AF2' : '#FFD60A',
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        Current Plan
                      </div>
                    )}

                    <div className="space-y-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: colors.glow }}
                      >
                        <Icon size={24} className={colors.icon} />
                      </div>
                      <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{plan.name}</h3>
                      <div>
                        <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                          {isEnterprise ? 'Custom' : plan.price.replace('/month', '')}
                        </span>
                        {!isEnterprise && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/month</span>}
                      </div>
                    </div>

                    <div className="w-full h-px" style={{ backgroundColor: 'var(--border)' }} />

                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <Check size={16} className="shrink-0 mt-0.5" style={{ color: '#32D74B' }} />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="pt-1">
                      {isEnterprise ? (
                        <a
                          href="mailto:hello@squidjob.com?subject=Enterprise Plan Inquiry"
                          className="block w-full text-center px-4 py-3 rounded-lg text-sm font-medium transition-all"
                          style={{ backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' }}
                        >
                          Contact Sales
                        </a>
                      ) : isCurrent ? (
                        <button
                          disabled
                          className="w-full px-4 py-3 rounded-lg text-sm font-medium cursor-default"
                          style={{ backgroundColor: 'var(--surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                        >
                          Current Plan
                        </button>
                      ) : (
                        <button
                          onClick={() => checkoutMutation.mutate(planKey)}
                          disabled={!!checkoutPlan}
                          className="w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                          style={{
                            backgroundColor: isUpgrade ? 'var(--accent)' : 'var(--surface-elevated)',
                            color: isUpgrade ? '#fff' : 'var(--text-primary)',
                            border: isUpgrade ? 'none' : '1px solid var(--border-strong)',
                          }}
                        >
                          {checkoutPlan === planKey ? <Spinner size="sm" /> : isUpgrade ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                          {isUpgrade ? 'Upgrade' : 'Downgrade'} to {plan.name}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {Object.keys(plans).length === 0 && (
                <div className="col-span-3 py-12 text-center space-y-3">
                  <AlertCircle size={32} className="mx-auto" style={{ color: 'var(--text-muted)' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>Stripe is not configured yet. Connect your Stripe account to enable billing.</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Set STRIPE_SECRET_KEY and STRIPE_PRICE_* environment variables to enable billing.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="rounded-xl p-6 space-y-3" style={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Key size={18} style={{ color: 'var(--text-secondary)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Bring Your Own Keys (BYOK)</h3>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Your AI agents run on your own LLM API keys — OpenAI, Anthropic (Claude), Gemini, Groq, Mistral, or local Ollama.
            SquidJob charges for the platform, not for AI token usage. You stay in full control of your AI costs.
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Configure your keys in{' '}
            <Link to="/settings" style={{ color: 'var(--accent)' }} className="hover:underline">Settings → API Keys</Link>.
          </p>
        </div>

        <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Subscribed as: {user?.email}
        </p>
      </div>
    </div>
  );
}
