import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch, apiPost, apiDelete } from '../../api/client';
import { Spinner } from '../../components/ui/Spinner';
import { AdminShell } from './AdminShell';
import { Search, Plus, X, ExternalLink, CheckCircle, XCircle, Trash2, ChevronDown } from 'lucide-react';

interface TenantRow {
  id: string; name: string; plan: string; status: string; subdomain: string | null;
  created_at: string; user_count: number; agent_count: number; task_count: number;
  last_active_at: string | null; sub_status: string | null; current_period_end: string | null;
  stripe_customer_id: string | null;
}

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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
};

export function TenantsListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showOnboard, setShowOnboard] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteInput, setDeleteInput] = useState('');

  const [form, setForm] = useState({ name: '', email: '', password: '', plan: 'starter', subdomain: '' });
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => apiGet<{ tenants: TenantRow[] }>('/admin/v1/tenants'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiPatch(`/admin/v1/tenants/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }),
  });
  const updatePlanMutation = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) => apiPatch(`/admin/v1/tenants/${id}/plan`, { plan }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/v1/tenants/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }); setDeleteConfirm(null); setDeleteInput(''); },
  });

  const tenants = data?.tenants ?? [];
  const filtered = useMemo(() => tenants.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.id.includes(search)) return false;
    if (planFilter !== 'all' && t.plan !== planFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  }), [tenants, search, planFilter, statusFilter]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError('Name, email and password are required.');
      return;
    }
    setCreating(true);
    setFormError('');
    try {
      await apiPost('/admin/v1/tenants', { name: form.name, email: form.email, password: form.password, plan: form.plan, subdomain: form.subdomain || undefined });
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      setShowOnboard(false);
      setForm({ name: '', email: '', password: '', plan: 'starter', subdomain: '' });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create tenant');
    } finally {
      setCreating(false);
    }
  };

  const selectStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', outline: 'none' };

  return (
    <AdminShell title="All Tenants">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>All Tenants</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Manage all subscriber workspaces</p>
          </div>
          <button onClick={() => setShowOnboard(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Onboard New Tenant
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', padding: '12px 16px', backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by tenant name or ID…"
              style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: '7px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }} />
          </div>
          <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} style={selectStyle}>
            <option value="all">All Plans</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
          </select>
          {(search || planFilter !== 'all' || statusFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setPlanFilter('all'); setStatusFilter('all'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
              <X size={12} /> Clear
            </button>
          )}
        </div>

        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Tenants</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{filtered.length} of {tenants.length}</span>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spinner /></div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '13px' }}>No tenants match your filters</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-elevated)' }}>
                    {['Tenant', 'Subdomain', 'Plan', 'Status', 'Users', 'Agents', 'Last Active', 'Sub Ends', 'Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => {
                    const pc = PLAN_COLORS[t.plan] || PLAN_COLORS.starter;
                    const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.active;
                    const isDeleteTarget = deleteConfirm === t.id;
                    return (
                      <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <td style={{ padding: '12px 16px' }}>
                          <button onClick={() => navigate(`/admin/tenants/${t.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</p>
                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{t.id.slice(0, 8)}…</p>
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{t.subdomain || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '5px', backgroundColor: pc.bg, color: pc.color, border: `1px solid ${pc.border}`, textTransform: 'capitalize' }}>{t.plan}</span>
                            <button onClick={() => {}} title="Change plan" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                              <ChevronDown size={11} />
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: sc.dot, flexShrink: 0 }} />
                            {sc.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>{t.user_count}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>{t.agent_count}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{relTime(t.last_active_at)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmt(t.current_period_end)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {isDeleteTarget ? (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', color: '#FF453A' }}>Confirm delete?</span>
                              <button onClick={() => deleteMutation.mutate(t.id)} style={{ padding: '4px 8px', borderRadius: '5px', border: 'none', backgroundColor: '#FF453A', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                              <button onClick={() => { setDeleteConfirm(null); setDeleteInput(''); }} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button onClick={() => navigate(`/admin/tenants/${t.id}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '5px 8px', borderRadius: '5px', fontSize: '11px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <ExternalLink size={10} /> View
                              </button>
                              <button
                                onClick={() => updateStatusMutation.mutate({ id: t.id, status: t.status === 'suspended' ? 'active' : 'suspended' })}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '5px 8px', borderRadius: '5px', fontSize: '11px', border: `1px solid ${t.status === 'suspended' ? 'rgba(50,215,75,0.3)' : 'rgba(255,159,10,0.3)'}`, backgroundColor: t.status === 'suspended' ? 'rgba(50,215,75,0.06)' : 'rgba(255,159,10,0.06)', color: t.status === 'suspended' ? '#32D74B' : '#FF9F0A', cursor: 'pointer' }}>
                                {t.status === 'suspended' ? <><CheckCircle size={10} /> Activate</> : <><XCircle size={10} /> Suspend</>}
                              </button>
                              <button
                                onClick={() => { setDeleteConfirm(t.id); setDeleteInput(''); }}
                                disabled={t.status !== 'suspended'}
                                title={t.status !== 'suspended' ? 'Suspend the tenant before deleting' : 'Delete tenant'}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '5px 8px', borderRadius: '5px', fontSize: '11px', border: '1px solid rgba(255,69,58,0.2)', backgroundColor: 'rgba(255,69,58,0.04)', color: t.status !== 'suspended' ? 'var(--text-muted)' : '#FF453A', cursor: t.status !== 'suspended' ? 'not-allowed' : 'pointer', opacity: t.status !== 'suspended' ? 0.4 : 1 }}>
                                <Trash2 size={10} />
                              </button>
                            </div>
                          )}
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

      {showOnboard && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }} onClick={e => { if (e.target === e.currentTarget) setShowOnboard(false); }}>
          <div style={{ width: '420px', height: '100vh', backgroundColor: 'var(--card)', borderLeft: '1px solid var(--border)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Onboard New Tenant</h2>
              <button onClick={() => setShowOnboard(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            {formError && <div style={{ padding: '10px 12px', borderRadius: '7px', backgroundColor: 'rgba(255,69,58,0.06)', border: '1px solid rgba(255,69,58,0.2)', fontSize: '12px', color: '#FF453A' }}>{formError}</div>}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Workspace Name *</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Admin Email *</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@company.com" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Password *</label>
              <input style={inputStyle} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 8 characters" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Plan</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                <option value="starter">Starter — $49/mo</option>
                <option value="professional">Professional — $149/mo</option>
                <option value="enterprise">Enterprise — $299/mo</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subdomain (optional)</label>
              <input style={inputStyle} value={form.subdomain} onChange={e => setForm(f => ({ ...f, subdomain: e.target.value }))} placeholder="acme" />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
              <button onClick={() => setShowOnboard(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCreate} disabled={creating} style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Creating…' : 'Create Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
