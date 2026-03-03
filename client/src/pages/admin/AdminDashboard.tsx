import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../../api/client';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { Users, Bot, CheckSquare, Activity, TrendingUp, Building2, ChevronDown } from 'lucide-react';

interface TenantRow {
  id: string;
  name: string;
  plan: string;
  created_at: string;
  user_count: number;
  agent_count: number;
  task_count: number;
  last_active_at: string | null;
  sub_status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
}

interface UsageTotals {
  tenant_count: number;
  user_count: number;
  agent_count: number;
  total_revenue_proxy: number;
}

const PLAN_VARIANT: Record<string, 'info' | 'warning' | 'active'> = {
  starter: 'info',
  professional: 'warning',
  enterprise: 'active',
};

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function relTime(d: string | null): string {
  if (!d) return 'Never';
  const now = Date.now();
  const then = new Date(d).getTime();
  const diff = now - then;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export function AdminDashboard() {
  const queryClient = useQueryClient();
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const { data: tenantsData, isLoading: loadingTenants } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => apiGet<{ tenants: TenantRow[] }>('/admin/v1/tenants'),
  });

  const { data: usageData, isLoading: loadingUsage } = useQuery({
    queryKey: ['admin-usage'],
    queryFn: () => apiGet<{ by_tenant: unknown[]; totals: UsageTotals }>('/admin/v1/usage'),
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) =>
      apiPatch(`/admin/v1/tenants/${id}/plan`, { plan }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      setEditingPlanId(null);
    },
  });

  const tenants = tenantsData?.tenants ?? [];
  const totals = usageData?.totals;

  const statCards = [
    { label: 'Tenants', value: totals?.tenant_count ?? '—', icon: Building2, color: 'text-blue-600 bg-blue-50' },
    { label: 'Users', value: totals?.user_count ?? '—', icon: Users, color: 'text-purple-600 bg-purple-50' },
    { label: 'Agents', value: totals?.agent_count ?? '—', icon: Bot, color: 'text-green-600 bg-green-50' },
    { label: 'Est. LLM Cost', value: `$${Number(totals?.total_revenue_proxy ?? 0).toFixed(2)}`, icon: TrendingUp, color: 'text-orange-600 bg-orange-50' },
  ];

  return (
    <div className="min-h-screen bg-brand-bg">
      <nav className="w-full border-b border-border-default bg-white">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-lg font-bold text-text-primary font-heading">SquidJob Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <Activity size={16} className="text-text-muted" />
            <span className="text-sm text-text-secondary">SaaS Admin Console</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-heading">Admin Dashboard</h1>
          <p className="text-text-secondary text-sm mt-1">Overview of all tenants and platform usage</p>
        </div>

        {loadingUsage ? (
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-border-default p-5 animate-pulse h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border border-border-default p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <stat.icon size={18} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                    <p className="text-xs text-text-muted">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl border border-border-default shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border-default flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">Tenants</h2>
            <span className="text-sm text-text-muted">{tenants.length} total</span>
          </div>

          {loadingTenants ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-16 text-text-muted">No tenants found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-light">
                    <th className="text-left px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Tenant</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Plan</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Users</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Agents</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Tasks</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Last Active</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Joined</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-surface-light transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-text-primary">{tenant.name}</p>
                          <p className="text-xs text-text-muted font-mono">{tenant.id.slice(0, 8)}…</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {editingPlanId === tenant.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              defaultValue={tenant.plan}
                              onChange={(e) => updatePlanMutation.mutate({ id: tenant.id, plan: e.target.value })}
                              className="text-xs px-2 py-1 border border-border-default rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-accent"
                              autoFocus
                              onBlur={() => setEditingPlanId(null)}
                            >
                              <option value="starter">Starter</option>
                              <option value="professional">Professional</option>
                              <option value="enterprise">Enterprise</option>
                            </select>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Badge variant={PLAN_VARIANT[tenant.plan] ?? 'info'}>
                              {tenant.plan}
                            </Badge>
                            {tenant.sub_status && tenant.sub_status !== 'active' && (
                              <span className="text-[10px] text-red-500">({tenant.sub_status})</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm text-text-primary">{tenant.user_count}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm text-text-primary">{tenant.agent_count}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm text-text-primary">{tenant.task_count}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-text-secondary">{relTime(tenant.last_active_at)}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-text-muted">{formatDate(tenant.created_at)}</span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => setEditingPlanId(tenant.id)}
                          className="flex items-center gap-1 text-xs text-brand-accent hover:underline"
                        >
                          <ChevronDown size={12} /> Change Plan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-text-muted pb-4">
          SquidJob SaaS Admin Console · All times UTC
        </div>
      </div>
    </div>
  );
}
