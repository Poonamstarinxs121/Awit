import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Trash2, Plus, LogOut } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import type { UsageRecord } from '../types';

interface Provider {
  id: string;
  provider: string;
  status: string;
  connected_at?: string;
  created_at?: string;
}

const planVariant: Record<string, 'info' | 'warning' | 'active'> = {
  starter: 'info',
  professional: 'warning',
  enterprise: 'active',
};

export function Settings() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [newProvider, setNewProvider] = useState('openai');
  const [newApiKey, setNewApiKey] = useState('');
  const [connectError, setConnectError] = useState('');

  const { data: providersData, isLoading: loadingProviders } = useQuery({
    queryKey: ['providers'],
    queryFn: () => apiGet<{ providers: Provider[] }>('/v1/config/providers'),
  });

  const { data: usageData, isLoading: loadingUsage } = useQuery({
    queryKey: ['usage'],
    queryFn: () => apiGet<{ usage: UsageRecord[] }>('/v1/config/usage'),
  });

  const connectMutation = useMutation({
    mutationFn: (data: { provider: string; api_key: string }) => apiPost('/v1/config/providers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      setShowConnectModal(false);
      setNewApiKey('');
      setConnectError('');
    },
    onError: (err: Error) => setConnectError(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/v1/config/providers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['providers'] }),
  });

  const providers = providersData?.providers ?? [];
  const usage = usageData?.usage ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <Card title="Tenant Info">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Company</span>
            <span className="text-white">{user?.tenantName || 'Your Company'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Plan</span>
            <Badge variant={planVariant['starter'] || 'info'}>Starter</Badge>
          </div>
        </div>
      </Card>

      <Card title="API Providers (BYOK)">
        {loadingProviders ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : (
          <div className="space-y-4">
            {providers.length === 0 && (
              <p className="text-gray-500 text-sm">No providers connected yet.</p>
            )}
            {providers.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-surface-light rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-3">
                  <Key size={18} className="text-gray-400" />
                  <div>
                    <p className="text-white font-medium capitalize">{p.provider}</p>
                    <p className="text-xs text-gray-500">
                      {p.status === 'active' ? 'Connected' : 'Inactive'}
                      {(p.connected_at || p.created_at) && ` · ${new Date(p.connected_at || p.created_at!).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.status === 'active' ? 'active' : 'idle'}>{p.status}</Badge>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => disconnectMutation.mutate(p.id)}
                    disabled={disconnectMutation.isPending}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
            <Button onClick={() => setShowConnectModal(true)} variant="secondary" size="sm">
              <Plus size={16} className="mr-1.5" /> Connect Provider
            </Button>
          </div>
        )}
      </Card>

      <Card title="Usage Overview">
        {loadingUsage ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : usage.length === 0 ? (
          <p className="text-gray-500 text-sm">No usage data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-700">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Tokens In</th>
                  <th className="pb-2 font-medium">Tokens Out</th>
                  <th className="pb-2 font-medium">API Calls</th>
                  <th className="pb-2 font-medium">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((row) => (
                  <tr key={row.id} className="border-b border-gray-800 text-gray-300">
                    <td className="py-2">{new Date(row.date).toLocaleDateString()}</td>
                    <td className="py-2">{row.tokens_in.toLocaleString()}</td>
                    <td className="py-2">{row.tokens_out.toLocaleString()}</td>
                    <td className="py-2">{row.api_calls.toLocaleString()}</td>
                    <td className="py-2">${row.estimated_cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Account">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Email</span>
            <span className="text-white">{user?.email || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Role</span>
            <Badge variant="info">{user?.role || '—'}</Badge>
          </div>
          <div className="pt-2">
            <Button variant="danger" size="sm" onClick={logout}>
              <LogOut size={16} className="mr-1.5" /> Logout
            </Button>
          </div>
        </div>
      </Card>

      <Modal open={showConnectModal} onClose={() => { setShowConnectModal(false); setConnectError(''); }} title="Connect Provider">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Provider</label>
            <select
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-light border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
              <option value="mistral">Mistral</option>
            </select>
          </div>
          <Input
            label="API Key"
            type="password"
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            placeholder="sk-..."
          />
          {connectError && <p className="text-sm text-red-400">{connectError}</p>}
          <Button
            onClick={() => connectMutation.mutate({ provider: newProvider, api_key: newApiKey })}
            disabled={!newApiKey || connectMutation.isPending}
            className="w-full"
          >
            {connectMutation.isPending ? <Spinner size="sm" className="mr-2" /> : null}
            Connect
          </Button>
        </div>
      </Modal>
    </div>
  );
}
