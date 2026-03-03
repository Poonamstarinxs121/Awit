import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../api/client';
import { Spinner } from '../../components/ui/Spinner';
import { AdminShell } from './AdminShell';
import { TrendingUp, DollarSign, Users, BarChart3 } from 'lucide-react';

interface FinanceData {
  mrr: number; arr: number;
  plan_counts: { starter: number; professional: number; enterprise: number };
  active_count: number; trial_count: number; suspended_count: number;
  monthly_signups: { month: string; count: number }[];
}
interface TenantRow {
  id: string; name: string; plan: string; status: string;
  sub_status: string | null; current_period_end: string | null;
  stripe_customer_id: string | null;
}
interface UsageRow {
  tenant_id: string; tenant_name: string; plan: string;
  total_tokens: string; total_calls: number; total_cost: string; active_days: number;
}

const PLAN_COLORS = {
  starter:      { bg: 'rgba(96,165,250,0.1)',  color: '#60A5FA', border: 'rgba(96,165,250,0.2)', price: 49 },
  professional: { bg: 'rgba(191,90,242,0.1)', color: '#BF5AF2', border: 'rgba(191,90,242,0.2)', price: 149 },
  enterprise:   { bg: 'rgba(255,159,10,0.1)', color: '#FF9F0A', border: 'rgba(255,159,10,0.2)', price: 299 },
};

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function MiniBarChart({ data }: { data: { month: string; count: number }[] }) {
  if (!data.length) return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>No data</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '100px', padding: '0 4px' }}>
      {data.map(d => {
        const pct = (d.count / max) * 100;
        const monthLabel = d.month.split('-')[1] + '/' + d.month.split('-')[0].slice(2);
        return (
          <div key={d.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{d.count > 0 ? d.count : ''}</span>
            <div style={{ width: '100%', height: `${Math.max(pct, 4)}%`, backgroundColor: 'var(--accent)', borderRadius: '3px 3px 0 0', transition: 'height 400ms ease', opacity: 0.85 }} />
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{monthLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

export function FinancePage() {
  const { data: financeData, isLoading: loadingFinance } = useQuery({
    queryKey: ['admin-finance'],
    queryFn: () => apiGet<FinanceData>('/admin/v1/finance'),
  });
  const { data: tenantsData } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => apiGet<{ tenants: TenantRow[] }>('/admin/v1/tenants'),
  });
  const { data: usageData } = useQuery({
    queryKey: ['admin-usage'],
    queryFn: () => apiGet<{ by_tenant: UsageRow[]; totals: unknown }>('/admin/v1/usage'),
  });

  const fin = financeData;
  const tenants = tenantsData?.tenants ?? [];
  const usageRows: UsageRow[] = (usageData?.by_tenant ?? []) as UsageRow[];
  const totalTenants = (fin?.active_count ?? 0) + (fin?.trial_count ?? 0) + (fin?.suspended_count ?? 0);

  const statCards = [
    { label: 'Monthly Recurring Revenue', value: fin ? `$${fin.mrr.toLocaleString()}` : '—', sub: fin ? `$${fin.arr.toLocaleString()} ARR` : '', icon: DollarSign, color: '#BF5AF2' },
    { label: 'Annual Run Rate', value: fin ? `$${fin.arr.toLocaleString()}` : '—', sub: '12× MRR', icon: TrendingUp, color: '#32D74B' },
    { label: 'Active Subscribers', value: fin?.active_count ?? '—', sub: `${fin?.trial_count ?? 0} on trial`, icon: Users, color: '#60A5FA' },
    { label: 'Avg Revenue / Tenant', value: fin && totalTenants ? `$${Math.round(fin.mrr / totalTenants)}` : '—', sub: 'per month', icon: BarChart3, color: '#FF9F0A' },
  ];

  return (
    <AdminShell title="Revenue & MRR">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Revenue & Finance</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Subscription revenue, plan distribution, and tenant usage costs</p>
        </div>

        {loadingFinance ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner /></div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {statCards.map(s => (
                <div key={s.label} style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1.3 }}>{s.label}</span>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <s.icon size={15} style={{ color: s.color }} />
                    </div>
                  </div>
                  <p style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{s.value}</p>
                  {s.sub && <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.sub}</p>}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {(Object.entries(PLAN_COLORS) as [keyof typeof PLAN_COLORS, typeof PLAN_COLORS.starter][]).map(([key, p]) => {
                const count = fin?.plan_counts[key] ?? 0;
                const mrr = count * p.price;
                const pct = fin?.mrr ? Math.round((mrr / fin.mrr) * 100) : 0;
                return (
                  <div key={key} style={{ backgroundColor: 'var(--card)', border: `1px solid ${p.border}`, borderRadius: '12px', padding: '18px 20px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: p.color, backgroundColor: p.bg, padding: '2px 8px', borderRadius: '5px', textTransform: 'capitalize', letterSpacing: '0.04em' }}>{key}</span>
                    <p style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: '10px 0 2px' }}>{count} <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)' }}>tenants</span></p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>${mrr.toLocaleString()}/mo · {pct}% of MRR</p>
                    <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--surface-elevated)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: p.color, borderRadius: '2px', transition: 'width 600ms ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Monthly New Tenants (Last 12 Months)</h2>
              <MiniBarChart data={fin?.monthly_signups ?? []} />
            </div>
          </>
        )}

        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Subscriptions</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-elevated)' }}>
                  {['Tenant', 'Plan', 'Sub Status', 'Period End'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => {
                  const pc = PLAN_COLORS[t.plan as keyof typeof PLAN_COLORS] || PLAN_COLORS.starter;
                  return (
                    <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{t.name}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', backgroundColor: pc.bg, color: pc.color, textTransform: 'capitalize' }}>{t.plan}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: t.sub_status === 'active' ? '#32D74B' : 'var(--text-muted)' }}>{t.sub_status || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>{fmt(t.current_period_end)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {usageRows.length > 0 && (
          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Usage Cost Leaderboard</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-elevated)' }}>
                  {['#', 'Tenant', 'Plan', 'Tokens', 'API Calls', 'Est. Cost'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usageRows.map((u, i) => {
                  const pc = PLAN_COLORS[u.plan as keyof typeof PLAN_COLORS] || PLAN_COLORS.starter;
                  return (
                    <tr key={u.tenant_id} style={{ borderTop: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>#{i + 1}</td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{u.tenant_name}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: pc.bg, color: pc.color, textTransform: 'capitalize' }}>{u.plan}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>{Number(u.total_tokens).toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>{u.total_calls.toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, color: Number(u.total_cost) > 0 ? '#FF9F0A' : 'var(--text-muted)' }}>
                        ${Number(u.total_cost).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
