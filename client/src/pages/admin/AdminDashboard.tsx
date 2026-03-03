import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch } from '../../api/client';
import { Spinner } from '../../components/ui/Spinner';
import { AdminShell } from './AdminShell';
import { Building2, Users, Bot, DollarSign, CheckCircle, Clock, XCircle, ExternalLink } from 'lucide-react';

interface TenantRow {
  id: string; name: string; plan: string; status: string; subdomain: string | null;
  created_at: string; user_count: number; agent_count: number; task_count: number;
  last_active_at: string | null; sub_status: string | null; current_period_end: string | null;
  stripe_customer_id: string | null;
}
interface FinanceData {
  mrr: number; arr: number;
  plan_counts: { starter: number; professional: number; enterprise: number };
  active_count: number; trial_count: number; suspended_count: number;
}

const PLAN_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  starter:      { bg: 'rgba(96,165,250,0.1)',  color: '#60A5FA', border: 'rgba(96,165,250,0.2)' },
  professional: { bg: 'rgba(191,90,242,0.1)', color: '#BF5AF2', border: 'rgba(191,90,242,0.2)' },
  enterprise:   { bg: 'rgba(255,159,10,0.1)', color: '#FF9F0A', border: 'rgba(255,159,10,0.2)' },
};

const STATUS_COLORS: Record<string, { dot: string; label: string }> = {
  active:    { dot: '#32D74B', label: 'Active' },
  trial:     { dot: '#FF9F0A', label: 'Trial' },
  suspended: { dot: '#FF453A', label: 'Suspended' },
};

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function relTime(d: string | null) {
  if (!d) return 'Never';
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return fmt(d);
}

export function AdminDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const { data: tenantsData, isLoading: loadingTenants } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => apiGet<{ tenants: TenantRow[] }>('/admin/v1/tenants'),
  });
  const { data: financeData, isLoading: loadingFinance } = useQuery({
    queryKey: ['admin-finance'],
    queryFn: () => apiGet<FinanceData>('/admin/v1/finance'),
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) => apiPatch(`/admin/v1/tenants/${id}/plan`, { plan }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }); setEditingPlanId(null); },
  });
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiPatch(`/admin/v1/tenants/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }),
  });

  const tenants = tenantsData?.tenants ?? [];
  const fin = financeData;

  const statCards = [
    { label: 'Total Tenants', value: tenants.length, icon: Building2, color: '#60A5FA' },
    { label: 'Active Tenants', value: fin?.active_count ?? '—', icon: CheckCircle, color: '#32D74B' },
    { label: 'Trial Tenants', value: fin?.trial_count ?? '—', icon: Clock, color: '#FF9F0A' },
    { label: 'Monthly Revenue', value: fin ? `$${fin.mrr.toLocaleString()}` : '—', icon: DollarSign, color: '#BF5AF2' },
  ];

  const planBreakdown = [
    { key: 'starter', label: 'Starter', price: 49, ...PLAN_COLORS.starter },
    { key: 'professional', label: 'Professional', price: 149, ...PLAN_COLORS.professional },
    { key: 'enterprise', label: 'Enterprise', price: 299, ...PLAN_COLORS.enterprise },
  ];

  return (
    <AdminShell title="Dashboard">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Admin Dashboard</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Platform-wide overview of all tenants and subscriptions</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {statCards.map(s => (
            <div key={s.label} style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={15} style={{ color: s.color }} />
                </div>
              </div>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {loadingFinance && s.label !== 'Total Tenants' ? '—' : s.value}
              </p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {planBreakdown.map(p => {
            const count = fin?.plan_counts[p.key as keyof typeof fin.plan_counts] ?? 0;
            const mrr = count * p.price;
            const pct = fin?.mrr ? Math.round((mrr / fin.mrr) * 100) : 0;
            return (
              <div key={p.key} style={{ backgroundColor: 'var(--card)', border: `1px solid ${p.border}`, borderRadius: '12px', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: p.color, backgroundColor: p.bg, padding: '2px 8px', borderRadius: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.label}</span>
                </div>
                <p style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{count} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>tenants</span></p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>${mrr.toLocaleString()}/mo · {pct}% of MRR</p>
                <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--surface-elevated)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: p.color, borderRadius: '2px', transition: 'width 600ms ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>All Tenants</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tenants.length} total</span>
          </div>

          {loadingTenants ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner /></div>
          ) : tenants.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>No tenants found</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-elevated)' }}>
                    {['Tenant', 'Plan', 'Status', 'Users', 'Agents', 'Last Active', 'Sub Ends', 'Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenants.map(t => {
                    const pc = PLAN_COLORS[t.plan] || PLAN_COLORS.starter;
                    const sc = STATUS_COLORS[t.status] || STATUS_COLORS.active;
                    return (
                      <tr key={t.id} style={{ borderTop: '1px solid var(--border)', transition: 'background 120ms' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <td style={{ padding: '12px 16px' }}>
                          <button onClick={() => navigate(`/admin/tenants/${t.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</p>
                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{t.id.slice(0, 8)}…</p>
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {editingPlanId === t.id ? (
                            <select autoFocus defaultValue={t.plan}
                              onChange={e => updatePlanMutation.mutate({ id: t.id, plan: e.target.value })}
                              onBlur={() => setEditingPlanId(null)}
                              style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                              {['starter', 'professional', 'enterprise'].map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          ) : (
                            <button onClick={() => setEditingPlanId(t.id)} style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, backgroundColor: pc.bg, color: pc.color, border: `1px solid ${pc.border}`, cursor: 'pointer', textTransform: 'capitalize' }}>
                              {t.plan}
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: sc.dot, fontWeight: 500 }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: sc.dot, flexShrink: 0 }} />
                            {sc.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{t.user_count}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{t.agent_count}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{relTime(t.last_active_at)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{fmt(t.current_period_end)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => navigate(`/admin/tenants/${t.id}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '4px 8px', borderRadius: '5px', fontSize: '11px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                              <ExternalLink size={10} /> View
                            </button>
                            <button
                              onClick={() => updateStatusMutation.mutate({ id: t.id, status: t.status === 'active' || t.status === 'trial' ? 'suspended' : 'active' })}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '4px 8px', borderRadius: '5px', fontSize: '11px', border: `1px solid ${t.status === 'suspended' ? 'rgba(50,215,75,0.3)' : 'rgba(255,69,58,0.3)'}`, backgroundColor: t.status === 'suspended' ? 'rgba(50,215,75,0.06)' : 'rgba(255,69,58,0.06)', color: t.status === 'suspended' ? '#32D74B' : '#FF453A', cursor: 'pointer' }}>
                              {t.status === 'suspended' ? <><CheckCircle size={10} /> Activate</> : <><XCircle size={10} /> Suspend</>}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
