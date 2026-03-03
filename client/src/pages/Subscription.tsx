import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { apiGet, apiPost } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import {
  Check, Zap, Building2, Rocket, ExternalLink, AlertCircle, Crown,
  ArrowUpRight, ArrowDownRight, Key, Calendar, Receipt, CreditCard,
  Clock, DollarSign, TrendingUp, FileText
} from 'lucide-react';

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

interface BillingEvent {
  id: string;
  type: string;
  description: string;
  amount: string;
  date: string;
  status: string;
}

interface BillingSummary {
  current_plan: string;
  status: string;
  next_billing_date: string | null;
  total_usage_cost: number;
  stripe_connected: boolean;
}

const PLAN_ICONS: Record<string, React.FC<{ size?: number; style?: React.CSSProperties }>> = {
  starter: Zap,
  professional: Rocket,
  enterprise: Building2,
};

const PLAN_ORDER = ['starter', 'professional', 'enterprise'];

const PLAN_COLORS: Record<string, { color: string; glow: string; border: string; bg: string }> = {
  starter: { color: '#0A84FF', glow: 'rgba(10, 132, 255, 0.15)', border: 'rgba(10, 132, 255, 0.4)', bg: 'rgba(10, 132, 255, 0.08)' },
  professional: { color: '#BF5AF2', glow: 'rgba(191, 90, 242, 0.15)', border: 'rgba(191, 90, 242, 0.4)', bg: 'rgba(191, 90, 242, 0.08)' },
  enterprise: { color: '#FFD60A', glow: 'rgba(255, 214, 10, 0.15)', border: 'rgba(255, 214, 10, 0.4)', bg: 'rgba(255, 214, 10, 0.08)' },
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = then - now;
  const absDiff = Math.abs(diff);
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  if (diff > 0) {
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    return `in ${days} days`;
  } else {
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    active: { bg: 'rgba(50,215,75,0.12)', text: '#32D74B', border: 'rgba(50,215,75,0.3)' },
    paid: { bg: 'rgba(50,215,75,0.12)', text: '#32D74B', border: 'rgba(50,215,75,0.3)' },
    scheduled: { bg: 'rgba(10,132,255,0.12)', text: '#0A84FF', border: 'rgba(10,132,255,0.3)' },
    canceled: { bg: 'rgba(255,69,58,0.12)', text: '#FF453A', border: 'rgba(255,69,58,0.3)' },
  };
  const s = styles[status] || { bg: 'rgba(255,214,10,0.12)', text: '#FFD60A', border: 'rgba(255,214,10,0.3)' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

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

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ['billing-history'],
    queryFn: () => apiGet<{ events: BillingEvent[]; summary: BillingSummary }>('/v1/billing/history'),
  });

  const checkoutMutation = useMutation({
    mutationFn: (plan: string) => apiPost<{ url: string }>('/v1/billing/checkout', { plan }),
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
    onMutate: (plan) => setCheckoutPlan(plan),
    onSettled: () => setCheckoutPlan(null),
  });

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const data = await apiPost<{ url: string }>('/v1/billing/portal', {});
      if (data.url) window.location.href = data.url;
    } catch {} finally { setPortalLoading(false); }
  };

  const plans = plansData?.plans ?? {};
  const subscription = subData?.subscription ?? null;
  const currentPlan = subscription?.plan ?? 'starter';
  const currentPlanIndex = PLAN_ORDER.indexOf(currentPlan);
  const billingEvents = historyData?.events ?? [];
  const billingSummary = historyData?.summary;

  const planColor = PLAN_COLORS[currentPlan] || PLAN_COLORS.starter;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <nav style={{ width: '100%', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(26,26,26,0.8)', backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--accent)' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>S</span>
            </div>
            <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>SquidJob</span>
          </div>
          <Link to="/dashboard" style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
            &larr; Back to Dashboard
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.5px' }}>Billing & Subscription</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>Manage your plan, view invoices, and track usage</p>
        </div>

        {success && (
          <div style={{ borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', backgroundColor: 'rgba(50,215,75,0.1)', border: '1px solid rgba(50,215,75,0.25)' }}>
            <Check size={16} style={{ color: '#32D74B', flexShrink: 0 }} />
            <p style={{ fontSize: '13px', fontWeight: 500, color: '#32D74B' }}>Subscription activated successfully! Your plan has been updated.</p>
          </div>
        )}

        {canceled && (
          <div style={{ borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', backgroundColor: 'rgba(255,214,10,0.1)', border: '1px solid rgba(255,214,10,0.25)' }}>
            <AlertCircle size={16} style={{ color: '#FFD60A', flexShrink: 0 }} />
            <p style={{ fontSize: '13px', color: '#FFD60A' }}>Checkout was canceled. Your current plan is unchanged.</p>
          </div>
        )}

        {loadingSub ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner /></div>
        ) : (
          <div style={{ borderRadius: '14px', padding: '24px', marginBottom: '24px', backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: planColor.glow }}>
                  <Crown size={26} style={{ color: planColor.color }} />
                </div>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Current Plan</p>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', textTransform: 'capitalize' }}>
                    {plans[currentPlan]?.name ?? currentPlan}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                    {subscription && <StatusBadge status={subscription.status} />}
                    {subscription?.current_period_end && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Renews {new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {subscription?.stripe_customer_id && (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px',
                    fontSize: '13px', fontWeight: 500, cursor: portalLoading ? 'not-allowed' : 'pointer',
                    backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', transition: 'all 150ms', opacity: portalLoading ? 0.6 : 1,
                  }}
                >
                  {portalLoading ? <Spinner /> : <ExternalLink size={14} />}
                  Manage Billing
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Plan', value: plans[currentPlan]?.name ?? currentPlan, icon: Crown, color: planColor.color },
            { label: 'Status', value: subscription?.status ?? 'Active', icon: TrendingUp, color: '#32D74B' },
            { label: 'Next Billing', value: billingSummary?.next_billing_date ? relativeTime(billingSummary.next_billing_date) : 'N/A', icon: Calendar, color: '#0A84FF' },
            { label: 'Usage Cost', value: `$${(billingSummary?.total_usage_cost ?? 0).toFixed(2)}`, icon: DollarSign, color: '#FBBF24' },
          ].map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div key={stat.label} style={{ padding: '16px 18px', backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <StatIcon size={18} style={{ color: stat.color }} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>{stat.label}</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px', textTransform: 'capitalize' }}>{stat.value}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ borderRadius: '14px', backgroundColor: 'var(--card)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(10,132,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={16} style={{ color: '#0A84FF' }} />
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Billing Schedule</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Upcoming and past billing events</p>
              </div>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {loadingHistory ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><Spinner /></div>
              ) : billingEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px' }}>
                  <Calendar size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No billing events yet. Subscribe to a plan to see your billing schedule.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {billingEvents.map((event) => (
                    <div key={event.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: event.type === 'upcoming' ? 'rgba(10,132,255,0.1)' : event.type === 'subscription' ? 'rgba(50,215,75,0.1)' : 'rgba(255,214,10,0.1)',
                        }}>
                          {event.type === 'upcoming' ? <Clock size={14} style={{ color: '#0A84FF' }} /> :
                           event.type === 'subscription' ? <CreditCard size={14} style={{ color: '#32D74B' }} /> :
                           <FileText size={14} style={{ color: '#FFD60A' }} />}
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{event.description}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {' · '}{relativeTime(event.date)}
                          </p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{event.amount}</span>
                        <StatusBadge status={event.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ borderRadius: '14px', backgroundColor: 'var(--card)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(167,139,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Receipt size={16} style={{ color: '#A78BFA' }} />
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Payment Details</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Your payment information and invoices</p>
              </div>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Payment Method</span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {subscription?.stripe_customer_id ? 'Card on file' : 'Not configured'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Billing Cycle</span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Monthly</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Plan Price</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: planColor.color }}>
                    {plans[currentPlan]?.price ?? 'Free'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>AI Usage Cost (BYOK)</span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#FBBF24' }}>
                    ${(billingSummary?.total_usage_cost ?? 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Member Since</span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {subscription?.created_at
                      ? new Date(subscription.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                      : '—'}
                  </span>
                </div>

                {subscription?.stripe_customer_id && (
                  <button
                    onClick={handlePortal}
                    disabled={portalLoading}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                      backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)',
                      border: '1px solid var(--border)', cursor: portalLoading ? 'not-allowed' : 'pointer',
                      marginTop: '4px', transition: 'all 150ms', width: '100%',
                    }}
                  >
                    <ExternalLink size={14} />
                    View Invoices on Stripe
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {loadingPlans ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner /></div>
        ) : (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>Choose Your Plan</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
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
                    style={{
                      borderRadius: '14px', padding: '24px', position: 'relative',
                      backgroundColor: 'var(--card)',
                      border: isCurrent ? `2px solid ${colors.border}` : '1px solid var(--border)',
                      boxShadow: isCurrent ? `0 0 24px ${colors.glow}` : undefined,
                      transition: 'all 200ms',
                    }}
                  >
                    {isCurrent && (
                      <div style={{
                        position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
                        padding: '3px 14px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        backgroundColor: colors.bg, color: colors.color, border: `1px solid ${colors.border}`,
                      }}>
                        Current Plan
                      </div>
                    )}

                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glow, marginBottom: '14px' }}>
                        <Icon size={24} style={{ color: colors.color }} />
                      </div>
                      <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>{plan.name}</h3>
                      <div>
                        <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {isEnterprise ? 'Custom' : plan.price.replace('/month', '')}
                        </span>
                        {!isEnterprise && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>/month</span>}
                      </div>
                    </div>

                    <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border)', marginBottom: '20px' }} />

                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {plan.features.map((feature) => (
                        <li key={feature} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          <Check size={15} style={{ color: '#32D74B', flexShrink: 0, marginTop: '1px' }} />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {isEnterprise ? (
                      <a
                        href="mailto:hello@squidjob.com?subject=Enterprise Plan Inquiry"
                        style={{
                          display: 'block', width: '100%', textAlign: 'center', padding: '12px', borderRadius: '10px',
                          fontSize: '13px', fontWeight: 500, textDecoration: 'none',
                          backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        Contact Sales
                      </a>
                    ) : isCurrent ? (
                      <button
                        disabled
                        style={{
                          width: '100%', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 500,
                          backgroundColor: 'var(--surface-elevated)', color: 'var(--text-muted)',
                          border: '1px solid var(--border)', cursor: 'default',
                        }}
                      >
                        Current Plan
                      </button>
                    ) : (
                      <button
                        onClick={() => checkoutMutation.mutate(planKey)}
                        disabled={!!checkoutPlan}
                        style={{
                          width: '100%', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          border: isUpgrade ? 'none' : '1px solid var(--border)',
                          backgroundColor: isUpgrade ? 'var(--accent)' : 'var(--surface-elevated)',
                          color: isUpgrade ? '#fff' : 'var(--text-primary)',
                          cursor: checkoutPlan ? 'not-allowed' : 'pointer', opacity: checkoutPlan ? 0.6 : 1,
                          transition: 'all 150ms',
                        }}
                      >
                        {checkoutPlan === planKey ? <Spinner /> : isUpgrade ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                        {isUpgrade ? 'Upgrade' : 'Downgrade'} to {plan.name}
                      </button>
                    )}
                  </div>
                );
              })}

              {Object.keys(plans).length === 0 && (
                <div style={{ gridColumn: 'span 3', padding: '48px', textAlign: 'center' }}>
                  <AlertCircle size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>Stripe is not configured yet. Connect your Stripe account to enable billing.</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Set STRIPE_SECRET_KEY and STRIPE_PRICE_* environment variables to enable billing.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: '24px', borderRadius: '14px', padding: '20px 24px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Key size={16} style={{ color: 'var(--text-secondary)' }} />
            <h3 style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Bring Your Own Keys (BYOK)</h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '6px' }}>
            Your AI agents run on your own LLM API keys — OpenAI, Anthropic (Claude), Gemini, Groq, Mistral, or local Ollama.
            SquidJob charges for the platform, not for AI token usage. You stay in full control of your AI costs.
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Configure your keys in{' '}
            <Link to="/settings" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Settings &rarr; API Keys</Link>.
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '24px' }}>
          Subscribed as: {user?.email}
        </p>
      </div>
    </div>
  );
}
