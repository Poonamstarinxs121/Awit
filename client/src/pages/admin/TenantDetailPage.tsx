import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiDelete } from '../../api/client';
import { Spinner } from '../../components/ui/Spinner';
import { AdminShell } from './AdminShell';
import {
  ArrowLeft, Users, Bot, CheckSquare, Zap, ExternalLink,
  FileText, Download, Copy, AlertTriangle, CheckCircle, XCircle
} from 'lucide-react';

interface TenantDetail {
  id: string; name: string; plan: string; status: string; subdomain: string | null;
  created_at: string; sub_status: string | null; current_period_end: string | null;
  stripe_customer_id: string | null; stripe_subscription_id: string | null;
}
interface UsageData {
  user_count: number; agent_count: number; task_count: number;
  total_tokens: string; total_cost: string;
}
interface Invoice {
  id: string; number: string; amount_paid: number; amount_due: number;
  currency: string; status: string; created: number;
  period_start: number; period_end: number;
  hosted_invoice_url: string | null; invoice_pdf: string | null;
}
interface TenantUser { id: string; email: string; name: string; role: string; created_at: string; }

const PLAN_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  starter:      { bg: 'rgba(96,165,250,0.1)',  color: '#60A5FA', border: 'rgba(96,165,250,0.2)' },
  professional: { bg: 'rgba(191,90,242,0.1)', color: '#BF5AF2', border: 'rgba(191,90,242,0.2)' },
  enterprise:   { bg: 'rgba(255,159,10,0.1)', color: '#FF9F0A', border: 'rgba(255,159,10,0.2)' },
};
const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  active:    { dot: '#32D74B', label: 'Active' },
  trial:     { dot: '#FF9F0A', label: 'Trial' },
  suspended: { dot: '#FF453A', label: 'Suspended' },
};
const INVOICE_STATUS_CONFIG: Record<string, { bg: string; color: string }> = {
  paid:   { bg: 'rgba(50,215,75,0.1)',  color: '#32D74B' },
  open:   { bg: 'rgba(255,159,10,0.1)', color: '#FF9F0A' },
  void:   { bg: 'rgba(120,120,120,0.1)', color: 'var(--text-muted)' },
  draft:  { bg: 'rgba(96,165,250,0.1)', color: '#60A5FA' },
};

function fmt(d: string | null | number) {
  if (!d) return '—';
  const date = typeof d === 'number' ? new Date(d * 1000) : new Date(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

type Tab = 'overview' | 'billing' | 'users' | 'actions';

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [newPlan, setNewPlan] = useState('');
  const [deleteInput, setDeleteInput] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const { data: tenantData, isLoading } = useQuery({
    queryKey: ['admin-tenant', id],
    queryFn: () => apiGet<{ tenant: TenantDetail; usage: UsageData }>(`/admin/v1/tenants/${id}`),
    enabled: !!id,
  });
  const { data: invoiceData, isLoading: loadingInvoices } = useQuery({
    queryKey: ['admin-invoices', id],
    queryFn: () => apiGet<{ invoices: Invoice[] }>(`/admin/v1/tenants/${id}/invoices`),
    enabled: tab === 'billing' && !!id,
  });
  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-tenant-users', id],
    queryFn: () => apiGet<{ users: TenantUser[] }>(`/admin/v1/tenants/${id}/users`),
    enabled: tab === 'users' && !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => apiPatch(`/admin/v1/tenants/${id}/status`, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-tenant', id] }); queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }); setActionMsg('Status updated.'); },
  });
  const updatePlanMutation = useMutation({
    mutationFn: (plan: string) => apiPatch(`/admin/v1/tenants/${id}/plan`, { plan }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-tenant', id] }); queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }); setActionMsg('Plan updated.'); },
  });
  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/admin/v1/tenants/${id}`),
    onSuccess: () => navigate('/admin/tenants'),
  });

  if (isLoading) return <AdminShell title="Tenant Detail"><div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner /></div></AdminShell>;
  if (!tenantData?.tenant) return <AdminShell title="Not Found"><div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Tenant not found.</div></AdminShell>;

  const { tenant, usage } = tenantData;
  const pc = PLAN_COLORS[tenant.plan] || PLAN_COLORS.starter;
  const sc = STATUS_CONFIG[tenant.status] || STATUS_CONFIG.active;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'billing', label: 'Billing & Invoices' },
    { key: 'users', label: 'Users' },
    { key: 'actions', label: 'Actions' },
  ];

  return (
    <AdminShell title={tenant.name}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <button onClick={() => navigate('/admin/tenants')} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start', padding: '4px 0' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
          <ArrowLeft size={14} /> All Tenants
        </button>

        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '22px 24px', display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '14px', backgroundColor: pc.bg, border: `1px solid ${pc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: pc.color }}>{tenant.name.charAt(0).toUpperCase()}</span>
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>{tenant.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '5px', backgroundColor: pc.bg, color: pc.color, border: `1px solid ${pc.border}`, textTransform: 'capitalize' }}>{tenant.plan}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: sc.dot, fontWeight: 500 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: sc.dot }} />{sc.label}
              </span>
              {tenant.subdomain && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tenant.subdomain}.squidjob.com</span>}
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Created {fmt(tenant.created_at)}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1px', backgroundColor: 'var(--border)', borderRadius: '8px', overflow: 'hidden', width: 'fit-content' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setActionMsg(''); }}
              style={{ padding: '8px 18px', fontSize: '13px', fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)', backgroundColor: tab === t.key ? 'var(--card)' : 'var(--surface-elevated)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 120ms' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label: 'Users', value: usage.user_count, icon: Users, color: '#60A5FA' },
                { label: 'Agents', value: usage.agent_count, icon: Bot, color: '#BF5AF2' },
                { label: 'Tasks', value: usage.task_count, icon: CheckSquare, color: '#32D74B' },
                { label: 'Est. Cost', value: `$${Number(usage.total_cost).toFixed(2)}`, icon: Zap, color: '#FF9F0A' },
              ].map(s => (
                <div key={s.label} style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</span>
                    <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <s.icon size={13} style={{ color: s.color }} />
                    </div>
                  </div>
                  <p style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</p>
                </div>
              ))}
            </div>
            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Subscription</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {[
                  { label: 'Plan', value: tenant.plan },
                  { label: 'Status', value: tenant.sub_status || 'active' },
                  { label: 'Period End', value: fmt(tenant.current_period_end) },
                  { label: 'Stripe Customer', value: tenant.stripe_customer_id ? tenant.stripe_customer_id.slice(0, 14) + '…' : '—' },
                  { label: 'Tokens Used', value: Number(usage.total_tokens).toLocaleString() },
                ].map(row => (
                  <div key={row.label}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{row.label}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'billing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {tenant.stripe_customer_id ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Stripe Customer</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{tenant.stripe_customer_id}</p>
                </div>
                <a href={`https://dashboard.stripe.com/customers/${tenant.stripe_customer_id}`} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '7px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)', fontSize: '12px', textDecoration: 'none', fontWeight: 500 }}>
                  <ExternalLink size={12} /> Open in Stripe
                </a>
              </div>
            ) : (
              <div style={{ padding: '14px 18px', backgroundColor: 'rgba(255,159,10,0.05)', border: '1px solid rgba(255,159,10,0.2)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                No Stripe customer linked to this tenant. Invoices will appear here once the tenant subscribes via Stripe.
              </div>
            )}

            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Invoice History</div>
              {loadingInvoices ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner /></div>
              ) : !invoiceData?.invoices?.length ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {tenant.stripe_customer_id ? 'No invoices found for this customer.' : 'No Stripe customer linked.'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface-elevated)' }}>
                      {['Invoice #', 'Date', 'Period', 'Amount', 'Status', 'Links'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceData.invoices.map(inv => {
                      const isc = INVOICE_STATUS_CONFIG[inv.status] || INVOICE_STATUS_CONFIG.open;
                      return (
                        <tr key={inv.id} style={{ borderTop: '1px solid var(--border)' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                          <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{inv.number || inv.id.slice(0, 12)}</td>
                          <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmt(inv.created)}</td>
                          <td style={{ padding: '10px 14px', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmt(inv.period_start)} – {fmt(inv.period_end)}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {((inv.amount_paid || inv.amount_due) / 100).toLocaleString('en-US', { style: 'currency', currency: inv.currency?.toUpperCase() || 'USD' })}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', backgroundColor: isc.bg, color: isc.color }}>
                              {inv.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {inv.hosted_invoice_url && <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#60A5FA', textDecoration: 'none' }}><ExternalLink size={10} /> View</a>}
                              {inv.invoice_pdf && <a href={inv.invoice_pdf} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none' }}><Download size={10} /> PDF</a>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Workspace Users {usersData ? `(${usersData.users.length})` : ''}
            </div>
            {loadingUsers ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner /></div>
            ) : !usersData?.users?.length ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>No users found</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-elevated)' }}>
                    {['Name', 'Email', 'Role', 'Joined'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usersData.users.map(u => (
                    <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{u.name}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', textTransform: 'capitalize', backgroundColor: u.role === 'owner' ? 'rgba(255,159,10,0.1)' : 'var(--surface-elevated)', color: u.role === 'owner' ? '#FF9F0A' : 'var(--text-muted)' }}>{u.role}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>{fmt(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'actions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {actionMsg && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(50,215,75,0.06)', border: '1px solid rgba(50,215,75,0.2)', fontSize: '12px', color: '#32D74B' }}>
                {actionMsg}
              </div>
            )}

            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Change Plan</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select value={newPlan || tenant.plan} onChange={e => setNewPlan(e.target.value)} style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer', outline: 'none' }}>
                  <option value="starter">Starter — $49/mo</option>
                  <option value="professional">Professional — $149/mo</option>
                  <option value="enterprise">Enterprise — $299/mo</option>
                </select>
                <button onClick={() => newPlan && updatePlanMutation.mutate(newPlan)} disabled={!newPlan || newPlan === tenant.plan || updatePlanMutation.isPending}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: (!newPlan || newPlan === tenant.plan) ? 0.5 : 1 }}>
                  {updatePlanMutation.isPending ? 'Applying…' : 'Apply'}
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {tenant.status === 'suspended' ? 'Activate Tenant' : 'Suspend Tenant'}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                {tenant.status === 'suspended'
                  ? 'Reactivate this workspace. Users will regain access immediately.'
                  : 'Suspend this workspace. Users will be unable to access it. This is required before deletion.'}
              </p>
              <button
                onClick={() => updateStatusMutation.mutate(tenant.status === 'suspended' ? 'active' : 'suspended')}
                disabled={updateStatusMutation.isPending}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: tenant.status === 'suspended' ? '#32D74B' : '#FF9F0A', color: tenant.status === 'suspended' ? '#000' : '#000', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                {tenant.status === 'suspended' ? <><CheckCircle size={14} /> Activate Workspace</> : <><XCircle size={14} /> Suspend Workspace</>}
              </button>
            </div>

            <div style={{ backgroundColor: 'rgba(255,69,58,0.04)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: '12px', padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <AlertTriangle size={15} style={{ color: '#FF453A' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#FF453A' }}>Danger Zone — Delete Tenant</h3>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                This permanently deletes all data for this workspace including all users, agents, tasks, and settings. This cannot be undone.
                {tenant.status !== 'suspended' && <span style={{ color: '#FF9F0A', fontWeight: 600 }}> Tenant must be suspended first.</span>}
              </p>
              {tenant.status === 'suspended' && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    placeholder={`Type "${tenant.name}" to confirm`}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(255,69,58,0.3)', backgroundColor: 'rgba(255,69,58,0.04)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                  />
                  <button
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteInput !== tenant.name || deleteMutation.isPending}
                    style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#FF453A', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: deleteInput !== tenant.name ? 0.4 : 1 }}>
                    {deleteMutation.isPending ? 'Deleting…' : 'Delete Forever'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
