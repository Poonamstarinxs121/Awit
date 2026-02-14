import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Trash2, Plus, LogOut, ChevronDown, ChevronUp, Webhook, Eye, ToggleLeft, ToggleRight, Send, MessageCircle, Unlink, Mail, Hash, Save } from 'lucide-react';
import { apiGet, apiPost, apiDelete, apiPatch, apiPut } from '../api/client';
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

interface AgentUsage {
  agent_id: string;
  agent_name: string | null;
  tokens_in: number;
  tokens_out: number;
  api_calls: number;
  estimated_cost: number;
}

interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface WebhookDelivery {
  id: string;
  event: string;
  response_status: number | null;
  success: boolean;
  attempts: number;
  created_at: string;
}

const WEBHOOK_EVENTS = [
  'task.created',
  'task.completed',
  'task.updated',
  'standup.generated',
  'agent.error',
  'agent.heartbeat',
];

const planVariant: Record<string, 'info' | 'warning' | 'active'> = {
  starter: 'info',
  professional: 'warning',
  enterprise: 'active',
};

const AGENT_COLORS = [
  'bg-teal-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-emerald-500',
  'bg-indigo-500',
  'bg-orange-500',
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function Settings() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [newProvider, setNewProvider] = useState('openai');
  const [newApiKey, setNewApiKey] = useState('');
  const [connectError, setConnectError] = useState('');
  const [showRawData, setShowRawData] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [webhookError, setWebhookError] = useState('');
  const [viewDeliveriesId, setViewDeliveriesId] = useState<string | null>(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramError, setTelegramError] = useState('');
  const [newChatId, setNewChatId] = useState('');
  const [newChatType, setNewChatType] = useState('private');
  const [deliveryEmailRecipients, setDeliveryEmailRecipients] = useState('');
  const [deliverySlackWebhook, setDeliverySlackWebhook] = useState('');
  const [deliverySaveSuccess, setDeliverySaveSuccess] = useState(false);

  const { data: providersData, isLoading: loadingProviders } = useQuery({
    queryKey: ['providers'],
    queryFn: () => apiGet<{ providers: Provider[] }>('/v1/config/providers'),
  });

  const { data: usageData, isLoading: loadingUsage } = useQuery({
    queryKey: ['usage'],
    queryFn: () => apiGet<{ usage: UsageRecord[] }>('/v1/config/usage'),
  });

  const { data: agentUsageData, isLoading: loadingAgentUsage } = useQuery({
    queryKey: ['usage-by-agent'],
    queryFn: () => apiGet<{ usage: AgentUsage[] }>('/v1/config/usage/by-agent'),
  });

  const { data: webhooksData, isLoading: loadingWebhooks } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => apiGet<WebhookItem[]>('/v1/webhooks'),
  });

  const { data: deliveriesData, isLoading: loadingDeliveries } = useQuery({
    queryKey: ['webhook-deliveries', viewDeliveriesId],
    queryFn: () => apiGet<WebhookDelivery[]>(`/v1/webhooks/${viewDeliveriesId}/deliveries`),
    enabled: !!viewDeliveriesId,
  });

  const createWebhookMutation = useMutation({
    mutationFn: (data: { url: string; events: string[]; secret?: string }) => apiPost('/v1/webhooks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setShowWebhookModal(false);
      setWebhookUrl('');
      setWebhookSecret('');
      setWebhookEvents([]);
      setWebhookError('');
    },
    onError: (err: Error) => setWebhookError(err.message),
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/v1/webhooks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => apiPatch(`/v1/webhooks/${id}`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const { data: telegramConfigData, isLoading: loadingTelegramConfig } = useQuery({
    queryKey: ['telegram-config'],
    queryFn: () => apiGet<{ config: any }>('/v1/telegram/config'),
  });

  const { data: telegramChatsData, isLoading: loadingTelegramChats } = useQuery({
    queryKey: ['telegram-chats'],
    queryFn: () => apiGet<any[]>('/v1/telegram/chats'),
  });

  const connectTelegramMutation = useMutation({
    mutationFn: (data: { bot_token: string }) => apiPost<{ bot_username: string }>('/v1/telegram/connect', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-config'] });
      setShowTelegramModal(false);
      setTelegramBotToken('');
      setTelegramError('');
    },
    onError: (err: Error) => setTelegramError(err.message),
  });

  const disconnectTelegramMutation = useMutation({
    mutationFn: () => apiDelete('/v1/telegram/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-config'] });
      queryClient.invalidateQueries({ queryKey: ['telegram-chats'] });
    },
  });

  const linkChatMutation = useMutation({
    mutationFn: (data: { chat_id: string; chat_type: string }) => apiPost('/v1/telegram/chats', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-chats'] });
      setNewChatId('');
      setNewChatType('private');
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: (data: { chat_id: string }) => apiPost<{ success: boolean }>('/v1/telegram/test', data),
  });

  interface DeliveryConfig {
    email_enabled: boolean;
    email_recipients: string[];
    slack_webhook_url: string | null;
    slack_enabled: boolean;
    telegram_enabled: boolean;
  }

  const { data: deliveryConfigData, isLoading: loadingDeliveryConfig } = useQuery({
    queryKey: ['delivery-config'],
    queryFn: () => apiGet<DeliveryConfig>('/v1/standups/delivery-config'),
  });

  const deliveryConfig = deliveryConfigData;

  const saveDeliveryMutation = useMutation({
    mutationFn: (data: Partial<DeliveryConfig>) => apiPut<DeliveryConfig>('/v1/standups/delivery-config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-config'] });
      setDeliverySaveSuccess(true);
      setTimeout(() => setDeliverySaveSuccess(false), 3000);
    },
  });

  const telegramConfig = telegramConfigData?.config;
  const telegramChats = telegramChatsData ?? [];

  const webhooks = webhooksData ?? [];
  const deliveries = deliveriesData ?? [];

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
  const agentUsage = agentUsageData?.usage ?? [];

  const dailyData = useMemo(() => {
    return [...usage]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((row) => ({
        date: row.date,
        cost: Number(row.estimated_cost),
        tokens_in: row.tokens_in,
        tokens_out: row.tokens_out,
        api_calls: row.api_calls,
      }));
  }, [usage]);

  const maxCost = useMemo(() => Math.max(...dailyData.map((d) => d.cost), 0.0001), [dailyData]);

  const totals = useMemo(() => {
    const totalTokens = usage.reduce((s, r) => s + r.tokens_in + r.tokens_out, 0);
    const totalCalls = usage.reduce((s, r) => s + r.api_calls, 0);
    const totalCost = usage.reduce((s, r) => s + Number(r.estimated_cost), 0);
    const avgDailyCost = usage.length > 0 ? totalCost / usage.length : 0;
    return { totalTokens, totalCalls, totalCost, avgDailyCost };
  }, [usage]);

  const maxAgentCost = useMemo(() => Math.max(...agentUsage.map((a) => Number(a.estimated_cost)), 0.0001), [agentUsage]);

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
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-light rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-xs uppercase tracking-wider">Total Tokens</p>
                <p className="text-white text-xl font-bold mt-1">{totals.totalTokens.toLocaleString()}</p>
              </div>
              <div className="bg-surface-light rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-xs uppercase tracking-wider">API Calls</p>
                <p className="text-white text-xl font-bold mt-1">{totals.totalCalls.toLocaleString()}</p>
              </div>
              <div className="bg-surface-light rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-xs uppercase tracking-wider">Total Cost</p>
                <p className="text-white text-xl font-bold mt-1">${totals.totalCost.toFixed(2)}</p>
              </div>
              <div className="bg-surface-light rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-xs uppercase tracking-wider">Avg Daily Cost</p>
                <p className="text-white text-xl font-bold mt-1">${totals.avgDailyCost.toFixed(2)}</p>
              </div>
            </div>

            <div>
              <h4 className="text-white text-sm font-medium mb-3">Daily Cost (Last 30 Days)</h4>
              <div className="flex items-end gap-1 h-48">
                {dailyData.map((day, i) => (
                  <div
                    key={day.date}
                    className="flex-1 bg-teal-500 rounded-t hover:bg-teal-400 transition-colors relative group cursor-pointer"
                    style={{ height: `${(day.cost / maxCost) * 100}%`, minHeight: '2px' }}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs p-2 rounded whitespace-nowrap z-10 shadow-lg border border-gray-700">
                      <p className="font-medium">{formatDate(day.date)}</p>
                      <p>Cost: ${day.cost.toFixed(4)}</p>
                      <p>Tokens: {(day.tokens_in + day.tokens_out).toLocaleString()}</p>
                      <p>Calls: {day.api_calls.toLocaleString()}</p>
                    </div>
                    {i % 5 === 0 && (
                      <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 text-gray-500 text-[10px] whitespace-nowrap">
                        {formatDate(day.date)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="h-5" />
            </div>

            {loadingAgentUsage ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : agentUsage.length > 0 && (
              <div>
                <h4 className="text-white text-sm font-medium mb-3">Per-Agent Breakdown</h4>
                <div className="space-y-3">
                  {agentUsage.map((agent, i) => {
                    const color = AGENT_COLORS[i % AGENT_COLORS.length];
                    const barWidth = (Number(agent.estimated_cost) / maxAgentCost) * 100;
                    return (
                      <div key={agent.agent_id} className="bg-surface-light rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium text-sm">{agent.agent_name || 'Unknown Agent'}</span>
                          <span className="text-teal-400 text-sm font-medium">${Number(agent.estimated_cost).toFixed(4)}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
                          <div
                            className={`${color} h-2.5 rounded-full transition-all`}
                            style={{ width: `${Math.max(barWidth, 1)}%` }}
                          />
                        </div>
                        <div className="flex gap-4 text-xs text-gray-400">
                          <span>Tokens: {(agent.tokens_in + agent.tokens_out).toLocaleString()}</span>
                          <span>API Calls: {agent.api_calls.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <button
                onClick={() => setShowRawData(!showRawData)}
                className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
              >
                {showRawData ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Raw Data
              </button>
              {showRawData && (
                <div className="overflow-x-auto mt-3">
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
                          <td className="py-2">${Number(row.estimated_cost).toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card title="Telegram Integration">
        {loadingTelegramConfig ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : telegramConfig ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-surface-light rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-3">
                <MessageCircle size={18} className="text-blue-400" />
                <div>
                  <p className="text-white font-medium">@{telegramConfig.bot_username}</p>
                  <p className="text-xs text-gray-500">
                    {telegramConfig.is_active ? 'Connected' : 'Inactive'}
                    {telegramConfig.created_at && ` · ${new Date(telegramConfig.created_at).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={telegramConfig.is_active ? 'active' : 'idle'}>
                  {telegramConfig.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => disconnectTelegramMutation.mutate()}
                  disabled={disconnectTelegramMutation.isPending}
                >
                  <Unlink size={14} className="mr-1" /> Disconnect
                </Button>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <h4 className="text-white text-sm font-medium mb-3">Linked Chats</h4>
              {loadingTelegramChats ? (
                <Spinner size="sm" />
              ) : telegramChats.length === 0 ? (
                <p className="text-gray-500 text-sm">No chats linked yet.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {telegramChats.map((chat: any) => (
                    <div key={chat.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <MessageCircle size={14} className="text-gray-400" />
                        <span className="text-white text-sm font-mono">{chat.chat_id}</span>
                        <Badge variant="info">{chat.chat_type}</Badge>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => sendTestMutation.mutate({ chat_id: chat.chat_id })}
                        disabled={sendTestMutation.isPending}
                      >
                        <Send size={12} className="mr-1" /> Test
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label="Chat ID"
                    value={newChatId}
                    onChange={(e) => setNewChatId(e.target.value)}
                    placeholder="e.g. 123456789 or -100123456789"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Type</label>
                  <select
                    value={newChatType}
                    onChange={(e) => setNewChatType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-light border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                  >
                    <option value="private">Private</option>
                    <option value="group">Group</option>
                    <option value="channel">Channel</option>
                  </select>
                </div>
                <Button
                  onClick={() => linkChatMutation.mutate({ chat_id: newChatId, chat_type: newChatType })}
                  disabled={!newChatId || linkChatMutation.isPending}
                  size="sm"
                  className="mb-0.5"
                >
                  <Plus size={14} className="mr-1" /> Link
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-500 text-sm">Connect a Telegram bot to receive notifications and send commands.</p>
            <Button onClick={() => setShowTelegramModal(true)} variant="secondary" size="sm">
              <MessageCircle size={16} className="mr-1.5" /> Connect Telegram Bot
            </Button>
          </div>
        )}
      </Card>

      <Card title="Webhooks">
        {loadingWebhooks ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : (
          <div className="space-y-4">
            {webhooks.length === 0 && (
              <p className="text-gray-500 text-sm">No webhooks registered yet.</p>
            )}
            {webhooks.map((wh) => (
              <div key={wh.id} className="bg-surface-light rounded-lg p-4 border border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Webhook size={18} className="text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{wh.url}</p>
                      <p className="text-xs text-gray-500">
                        Created {new Date(wh.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={wh.is_active ? 'active' : 'idle'}>
                      {wh.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <button
                      onClick={() => toggleWebhookMutation.mutate({ id: wh.id, is_active: !wh.is_active })}
                      className="text-gray-400 hover:text-white transition-colors"
                      title={wh.is_active ? 'Disable' : 'Enable'}
                    >
                      {wh.is_active ? <ToggleRight size={20} className="text-teal-500" /> : <ToggleLeft size={20} />}
                    </button>
                    <button
                      onClick={() => setViewDeliveriesId(viewDeliveriesId === wh.id ? null : wh.id)}
                      className="text-gray-400 hover:text-white transition-colors"
                      title="View deliveries"
                    >
                      <Eye size={16} />
                    </button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteWebhookMutation.mutate(wh.id)}
                      disabled={deleteWebhookMutation.isPending}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {wh.events.map((ev) => (
                    <Badge key={ev} variant="info">{ev}</Badge>
                  ))}
                </div>
                {viewDeliveriesId === wh.id && (
                  <div className="mt-3 border-t border-gray-700 pt-3">
                    <h5 className="text-white text-xs font-medium mb-2">Recent Deliveries</h5>
                    {loadingDeliveries ? (
                      <Spinner size="sm" />
                    ) : deliveries.length === 0 ? (
                      <p className="text-gray-500 text-xs">No deliveries yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {deliveries.map((d) => (
                          <div key={d.id} className="flex items-center justify-between text-xs bg-gray-800/50 rounded px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${d.success ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span className="text-gray-300">{d.event}</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-500">
                              <span>{d.response_status ?? '—'}</span>
                              <span>x{d.attempts}</span>
                              <span>{new Date(d.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <Button onClick={() => setShowWebhookModal(true)} variant="secondary" size="sm">
              <Plus size={16} className="mr-1.5" /> Add Webhook
            </Button>
          </div>
        )}
      </Card>

      <Card title="Standup Delivery">
        {loadingDeliveryConfig ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : (
          <div className="space-y-5">
            <p className="text-gray-400 text-sm">Configure where daily standups are delivered when generated.</p>

            <div className="bg-surface-light rounded-lg p-4 border border-gray-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail size={18} className="text-gray-400" />
                  <span className="text-white font-medium text-sm">Email (via Resend)</span>
                </div>
                <button
                  onClick={() => saveDeliveryMutation.mutate({ email_enabled: !deliveryConfig?.email_enabled })}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {deliveryConfig?.email_enabled ? <ToggleRight size={24} className="text-teal-500" /> : <ToggleLeft size={24} />}
                </button>
              </div>
              {deliveryConfig?.email_enabled && (
                <div className="space-y-2 pl-7">
                  <Input
                    label="Recipients (comma-separated)"
                    value={deliveryEmailRecipients || (deliveryConfig?.email_recipients?.join(', ') ?? '')}
                    onChange={(e) => setDeliveryEmailRecipients(e.target.value)}
                    placeholder="team@example.com, lead@example.com"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const recipients = deliveryEmailRecipients.split(',').map(e => e.trim()).filter(Boolean);
                      saveDeliveryMutation.mutate({ email_recipients: recipients });
                    }}
                    disabled={saveDeliveryMutation.isPending}
                  >
                    <Save size={12} className="mr-1" /> Save Recipients
                  </Button>
                  <p className="text-gray-500 text-xs">Requires a Resend API key stored in tenant settings.</p>
                </div>
              )}
            </div>

            <div className="bg-surface-light rounded-lg p-4 border border-gray-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash size={18} className="text-gray-400" />
                  <span className="text-white font-medium text-sm">Slack Webhook</span>
                </div>
                <button
                  onClick={() => saveDeliveryMutation.mutate({ slack_enabled: !deliveryConfig?.slack_enabled })}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {deliveryConfig?.slack_enabled ? <ToggleRight size={24} className="text-teal-500" /> : <ToggleLeft size={24} />}
                </button>
              </div>
              {deliveryConfig?.slack_enabled && (
                <div className="space-y-2 pl-7">
                  <Input
                    label="Webhook URL"
                    value={deliverySlackWebhook || (deliveryConfig?.slack_webhook_url ?? '')}
                    onChange={(e) => setDeliverySlackWebhook(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => saveDeliveryMutation.mutate({ slack_webhook_url: deliverySlackWebhook })}
                    disabled={!deliverySlackWebhook || saveDeliveryMutation.isPending}
                  >
                    <Save size={12} className="mr-1" /> Save Webhook URL
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-surface-light rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle size={18} className="text-gray-400" />
                  <span className="text-white font-medium text-sm">Telegram</span>
                  {!telegramConfig && <span className="text-gray-500 text-xs">(Connect bot first)</span>}
                </div>
                <button
                  onClick={() => saveDeliveryMutation.mutate({ telegram_enabled: !deliveryConfig?.telegram_enabled })}
                  className="text-gray-400 hover:text-white transition-colors"
                  disabled={!telegramConfig}
                >
                  {deliveryConfig?.telegram_enabled ? <ToggleRight size={24} className="text-teal-500" /> : <ToggleLeft size={24} />}
                </button>
              </div>
              {deliveryConfig?.telegram_enabled && (
                <p className="text-gray-500 text-xs mt-2 pl-7">Standups will be sent to all linked Telegram chats.</p>
              )}
            </div>

            {deliverySaveSuccess && (
              <p className="text-teal-400 text-sm">Delivery settings saved successfully!</p>
            )}
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

      <Modal open={showWebhookModal} onClose={() => { setShowWebhookModal(false); setWebhookError(''); }} title="Add Webhook">
        <div className="space-y-4">
          <Input
            label="Webhook URL"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://example.com/webhook"
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Events</label>
            <div className="grid grid-cols-2 gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={webhookEvents.includes(ev)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setWebhookEvents([...webhookEvents, ev]);
                      } else {
                        setWebhookEvents(webhookEvents.filter((x) => x !== ev));
                      }
                    }}
                    className="rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-teal-500"
                  />
                  {ev}
                </label>
              ))}
            </div>
          </div>
          <Input
            label="Secret (optional)"
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Used to sign payloads"
          />
          {webhookError && <p className="text-sm text-red-400">{webhookError}</p>}
          <Button
            onClick={() => createWebhookMutation.mutate({
              url: webhookUrl,
              events: webhookEvents,
              secret: webhookSecret || undefined,
            })}
            disabled={!webhookUrl || webhookEvents.length === 0 || createWebhookMutation.isPending}
            className="w-full"
          >
            {createWebhookMutation.isPending ? <Spinner size="sm" className="mr-2" /> : null}
            Create Webhook
          </Button>
        </div>
      </Modal>

      <Modal open={showTelegramModal} onClose={() => { setShowTelegramModal(false); setTelegramError(''); }} title="Connect Telegram Bot">
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Create a bot via <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">@BotFather</a> on Telegram, then paste the bot token below.
          </p>
          <Input
            label="Bot Token"
            type="password"
            value={telegramBotToken}
            onChange={(e) => setTelegramBotToken(e.target.value)}
            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
          />
          {telegramError && <p className="text-sm text-red-400">{telegramError}</p>}
          <Button
            onClick={() => connectTelegramMutation.mutate({ bot_token: telegramBotToken })}
            disabled={!telegramBotToken || connectTelegramMutation.isPending}
            className="w-full"
          >
            {connectTelegramMutation.isPending ? <Spinner size="sm" className="mr-2" /> : null}
            Connect Bot
          </Button>
        </div>
      </Modal>

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
              <option value="google">Google (Gemini)</option>
              <option value="mistral">Mistral</option>
              <option value="groq">Groq</option>
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
