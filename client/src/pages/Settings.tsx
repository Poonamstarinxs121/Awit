import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Key, Trash2, Plus, LogOut, ChevronDown, ChevronUp, Webhook, Eye, ToggleLeft, ToggleRight,
  Send, MessageCircle, Unlink, Mail, Hash, Save, Tag, Copy, Check, AlertCircle,
  Settings as SettingsIcon, Shield, Zap, Bell, Globe, User, Building2, CreditCard, Lock,
  Download, Monitor, Chrome, ExternalLink, Package
} from 'lucide-react';
import { apiGet, apiPost, apiDelete, apiPatch, apiPut } from '../api/client';
import { useAuth } from '../hooks/useAuth';
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

interface TagItem {
  id: string;
  name: string;
  color: string;
  usage_count: number;
}

interface ApiToken {
  id: string;
  name: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface DeliveryConfig {
  email_enabled: boolean;
  email_recipients: string[];
  slack_webhook_url: string | null;
  slack_enabled: boolean;
  telegram_enabled: boolean;
}

const WEBHOOK_EVENTS = [
  'task.created', 'task.completed', 'task.updated',
  'standup.generated', 'agent.error', 'agent.heartbeat',
];

const TAG_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#db2777', '#0891b2', '#65a30d'];

const PROVIDER_ICONS: Record<string, { label: string; color: string }> = {
  openai: { label: 'OpenAI', color: '#10a37f' },
  anthropic: { label: 'Anthropic', color: '#d97757' },
  google: { label: 'Google Gemini', color: '#4285f4' },
  mistral: { label: 'Mistral', color: '#ff7000' },
  groq: { label: 'Groq', color: '#f55036' },
  ollama: { label: 'Ollama', color: '#ffffff' },
};

type SettingsTab = 'general' | 'integrations' | 'security' | 'notifications' | 'downloads';

const tabs: { key: SettingsTab; label: string; icon: typeof SettingsIcon }[] = [
  { key: 'general', label: 'General', icon: SettingsIcon },
  { key: 'integrations', label: 'Integrations', icon: Globe },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'downloads', label: 'Downloads', icon: Download },
];

function SectionCard({ title, icon: Icon, children, subtitle }: { title: string; icon: typeof Key; children: React.ReactNode; subtitle?: string }) {
  return (
    <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', maxWidth: '100%' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={16} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{title}</h3>
          {subtitle && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</p>}
        </div>
      </div>
      <div style={{ padding: '20px', overflow: 'hidden', maxWidth: '100%' }}>{children}</div>
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span style={{
      width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block',
      backgroundColor: active ? '#32D74B' : 'var(--text-muted)',
      boxShadow: active ? '0 0 6px rgba(50,215,75,0.4)' : 'none',
    }} />
  );
}

function SmallBadge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600,
      backgroundColor: `${color}15`, border: `1px solid ${color}30`, color,
    }}>
      {children}
    </span>
  );
}

function ActionButton({ children, onClick, disabled, variant = 'secondary', fullWidth }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger'; fullWidth?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { backgroundColor: 'var(--accent)', color: '#fff', border: 'none' },
    secondary: { backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    danger: { backgroundColor: 'rgba(255,59,48,0.1)', color: '#FF453A', border: '1px solid rgba(255,59,48,0.2)' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 150ms',
        width: fullWidth ? '100%' : undefined, justifyContent: fullWidth ? 'center' : undefined,
      }}
    >
      {children}
    </button>
  );
}

function InputField({ label, value, onChange, placeholder, type = 'text' }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      {label && <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '9px 12px', backgroundColor: 'var(--surface-elevated)',
          border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)',
          fontSize: '13px', outline: 'none', fontFamily: 'var(--font-body)',
        }}
      />
    </div>
  );
}

function ToggleSwitch({ active, onToggle, disabled }: { active: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button onClick={onToggle} disabled={disabled} style={{ cursor: disabled ? 'not-allowed' : 'pointer', background: 'none', border: 'none', padding: 0 }}>
      {active ? <ToggleRight size={24} style={{ color: '#32D74B' }} /> : <ToggleLeft size={24} style={{ color: 'var(--text-muted)' }} />}
    </button>
  );
}

export function Settings() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

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
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waAccountSid, setWaAccountSid] = useState('');
  const [waAuthToken, setWaAuthToken] = useState('');
  const [waNumber, setWaNumber] = useState('');
  const [waError, setWaError] = useState('');
  const [waTestTo, setWaTestTo] = useState('');
  const [showNewTagModal, setShowNewTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#2563eb');
  const [showNewTokenModal, setShowNewTokenModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenExpiry, setNewTokenExpiry] = useState('');
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

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

  const { data: telegramConfigData, isLoading: loadingTelegramConfig } = useQuery({
    queryKey: ['telegram-config'],
    queryFn: () => apiGet<{ config: any }>('/v1/telegram/config'),
  });

  const { data: telegramChatsData, isLoading: loadingTelegramChats } = useQuery({
    queryKey: ['telegram-chats'],
    queryFn: () => apiGet<any[]>('/v1/telegram/chats'),
  });

  const { data: whatsappConfigData, isLoading: loadingWhatsApp } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: () => apiGet<{ config: any }>('/v1/whatsapp/config'),
  });

  const { data: deliveryConfigData, isLoading: loadingDeliveryConfig } = useQuery({
    queryKey: ['delivery-config'],
    queryFn: () => apiGet<DeliveryConfig>('/v1/standups/delivery-config'),
  });

  const { data: tagsData, isLoading: loadingTags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => apiGet<{ tags: TagItem[] }>('/v1/tags'),
  });

  const { data: apiTokensData, isLoading: loadingApiTokens } = useQuery({
    queryKey: ['api-tokens'],
    queryFn: () => apiGet<{ tokens: ApiToken[] }>('/v1/api-tokens'),
  });

  const createWebhookMutation = useMutation({
    mutationFn: (data: { url: string; events: string[]; secret?: string }) => apiPost('/v1/webhooks', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks'] }); setShowWebhookModal(false); setWebhookUrl(''); setWebhookSecret(''); setWebhookEvents([]); setWebhookError(''); },
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

  const connectTelegramMutation = useMutation({
    mutationFn: (data: { bot_token: string }) => apiPost<{ bot_username: string }>('/v1/telegram/connect', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['telegram-config'] }); setShowTelegramModal(false); setTelegramBotToken(''); setTelegramError(''); },
    onError: (err: Error) => setTelegramError(err.message),
  });

  const disconnectTelegramMutation = useMutation({
    mutationFn: () => apiDelete('/v1/telegram/disconnect'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['telegram-config'] }); queryClient.invalidateQueries({ queryKey: ['telegram-chats'] }); },
  });

  const linkChatMutation = useMutation({
    mutationFn: (data: { chat_id: string; chat_type: string }) => apiPost('/v1/telegram/chats', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['telegram-chats'] }); setNewChatId(''); setNewChatType('private'); },
  });

  const sendTestMutation = useMutation({
    mutationFn: (data: { chat_id: string }) => apiPost<{ success: boolean }>('/v1/telegram/test', data),
  });

  const connectMutation = useMutation({
    mutationFn: (data: { provider: string; api_key: string }) => apiPost('/v1/config/providers', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['providers'] }); setShowConnectModal(false); setNewApiKey(''); setConnectError(''); },
    onError: (err: Error) => setConnectError(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/v1/config/providers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['providers'] }),
  });

  const saveDeliveryMutation = useMutation({
    mutationFn: (data: Partial<DeliveryConfig>) => apiPut<DeliveryConfig>('/v1/standups/delivery-config', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['delivery-config'] }); setDeliverySaveSuccess(true); setTimeout(() => setDeliverySaveSuccess(false), 3000); },
  });

  const connectWhatsAppMutation = useMutation({
    mutationFn: (data: { account_sid: string; auth_token: string; whatsapp_number: string }) => apiPost('/v1/whatsapp/connect', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] }); setShowWhatsAppModal(false); setWaAccountSid(''); setWaAuthToken(''); setWaNumber(''); setWaError(''); },
    onError: (err: Error) => setWaError(err.message),
  });

  const disconnectWhatsAppMutation = useMutation({
    mutationFn: () => apiDelete('/v1/whatsapp/disconnect'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] }),
  });

  const testWhatsAppMutation = useMutation({
    mutationFn: (data: { to: string }) => apiPost('/v1/whatsapp/test', data),
  });

  const createTagMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) => apiPost('/v1/tags', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tags'] }); setShowNewTagModal(false); setNewTagName(''); setNewTagColor('#2563eb'); },
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/v1/tags/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  });

  const createTokenMutation = useMutation({
    mutationFn: (data: { name: string; expires_in_days?: number }) => apiPost<{ token: ApiToken; raw_token: string }>('/v1/api-tokens', data),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['api-tokens'] }); setShowNewTokenModal(false); setNewTokenName(''); setNewTokenExpiry(''); setRevealedToken(data.raw_token); },
  });

  const deleteTokenMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/v1/api-tokens/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-tokens'] }),
  });

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token).then(() => { setCopiedToken(true); setTimeout(() => setCopiedToken(false), 2000); });
  };

  const providers = providersData?.providers ?? [];
  const usage = usageData?.usage ?? [];
  const agentUsage = agentUsageData?.usage ?? [];
  const webhooks = webhooksData ?? [];
  const deliveries = deliveriesData ?? [];
  const telegramConfig = telegramConfigData?.config;
  const telegramChats = telegramChatsData ?? [];
  const whatsappConfig = whatsappConfigData?.config;
  const deliveryConfig = deliveryConfigData;
  const tags = tagsData?.tags ?? [];
  const apiTokens = apiTokensData?.tokens ?? [];

  const dailyData = useMemo(() => {
    return [...usage]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((row) => ({ date: row.date, cost: Number(row.estimated_cost), tokens_in: row.tokens_in, tokens_out: row.tokens_out, api_calls: row.api_calls }));
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

  const AGENT_COLORS = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f97316', '#ef4444', '#10b981', '#6366f1', '#f59e0b'];

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const renderGeneral = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionCard title="Workspace" icon={Building2} subtitle="Your organization details">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Company</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.tenantName || 'Your Company'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Plan</span>
            <SmallBadge color="#0A84FF">Starter</SmallBadge>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="API Providers (BYOK)" icon={Key} subtitle="Connect your own LLM API keys">
        {loadingProviders ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}><Spinner /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {providers.length === 0 && (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '8px 0' }}>No providers connected. Add your API keys to start using AI agents.</p>
            )}
            {providers.map((p) => {
              const pInfo = PROVIDER_ICONS[p.provider] || { label: p.provider, color: 'var(--text-secondary)' };
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: `${pInfo.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Key size={16} style={{ color: pInfo.color }} />
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{pInfo.label}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <StatusDot active={p.status === 'active'} />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {p.status === 'active' ? 'Connected' : 'Inactive'}
                          {(p.connected_at || p.created_at) && ` · ${new Date(p.connected_at || p.created_at!).toLocaleDateString()}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ActionButton variant="danger" onClick={() => disconnectMutation.mutate(p.id)} disabled={disconnectMutation.isPending}>
                    <Trash2 size={14} />
                  </ActionButton>
                </div>
              );
            })}
            <ActionButton onClick={() => setShowConnectModal(true)}>
              <Plus size={14} /> Connect Provider
            </ActionButton>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Usage Overview" icon={Zap} subtitle="Token usage and cost tracking">
        {loadingUsage ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}><Spinner /></div>
        ) : usage.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No usage data yet. Usage tracking begins when agents process tasks.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="mobile-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[
                { label: 'Total Tokens', value: totals.totalTokens.toLocaleString(), color: '#60A5FA' },
                { label: 'API Calls', value: totals.totalCalls.toLocaleString(), color: '#A78BFA' },
                { label: 'Total Cost', value: `$${totals.totalCost.toFixed(2)}`, color: '#34D399' },
                { label: 'Avg Daily', value: `$${totals.avgDailyCost.toFixed(2)}`, color: '#FBBF24' },
              ].map((s) => (
                <div key={s.label} style={{ padding: '14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{s.label}</p>
                  <p style={{ fontSize: '18px', fontWeight: 700, color: s.color, marginTop: '4px' }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div>
              <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>Daily Cost (Last 30 Days)</h4>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '120px' }}>
                {dailyData.map((day, i) => (
                  <div
                    key={day.date}
                    style={{ flex: 1, backgroundColor: '#14b8a6', borderRadius: '2px 2px 0 0', height: `${Math.max((day.cost / maxCost) * 100, 1)}%`, transition: 'height 300ms', cursor: 'pointer', position: 'relative' }}
                    className="group"
                    title={`${formatDate(day.date)}: $${day.cost.toFixed(4)} · ${(day.tokens_in + day.tokens_out).toLocaleString()} tokens`}
                  />
                ))}
              </div>
            </div>

            {!loadingAgentUsage && agentUsage.length > 0 && (
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>Per-Agent Breakdown</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {agentUsage.map((agent, i) => {
                    const color = AGENT_COLORS[i % AGENT_COLORS.length];
                    const barWidth = (Number(agent.estimated_cost) / maxAgentCost) * 100;
                    return (
                      <div key={agent.agent_id} style={{ padding: '10px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{agent.agent_name || 'Unknown Agent'}</span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color }}>${Number(agent.estimated_cost).toFixed(4)}</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px' }}>
                          <div style={{ width: `${Math.max(barWidth, 1)}%`, height: '6px', borderRadius: '3px', backgroundColor: color, transition: 'width 300ms' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>Tokens: {(agent.tokens_in + agent.tokens_out).toLocaleString()}</span>
                          <span>Calls: {agent.api_calls.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowRawData(!showRawData)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {showRawData ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Raw Data
            </button>
            {showRawData && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Date', 'Tokens In', 'Tokens Out', 'API Calls', 'Est. Cost'].map(h => (
                        <th key={h} style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{new Date(row.date).toLocaleDateString()}</td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{row.tokens_in.toLocaleString()}</td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{row.tokens_out.toLocaleString()}</td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{row.api_calls.toLocaleString()}</td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>${Number(row.estimated_cost).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Tags" icon={Tag} subtitle="Categorize and filter your tasks">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loadingTags ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}><Spinner /></div>
          ) : tags.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No tags yet. Create your first tag to organize tasks.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {tags.map((tag) => (
                <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', backgroundColor: `${tag.color}15`, border: `1px solid ${tag.color}30` }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: tag.color }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: tag.color }}>{tag.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{tag.usage_count}</span>
                  <button onClick={() => deleteTagMutation.mutate(tag.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <ActionButton onClick={() => setShowNewTagModal(true)}>
            <Tag size={13} /> New Tag
          </ActionButton>
        </div>
      </SectionCard>
    </div>
  );

  const renderIntegrations = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionCard title="Telegram" icon={MessageCircle} subtitle="Receive notifications and send commands via Telegram">
        {loadingTelegramConfig ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}><Spinner /></div>
        ) : telegramConfig ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="mobile-stack" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '10px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle size={16} style={{ color: '#3b82f6' }} />
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>@{telegramConfig.bot_username}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <StatusDot active={telegramConfig.is_active} />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {telegramConfig.is_active ? 'Connected' : 'Inactive'}
                      {telegramConfig.created_at && ` · ${new Date(telegramConfig.created_at).toLocaleDateString()}`}
                    </span>
                  </div>
                </div>
              </div>
              <ActionButton variant="danger" onClick={() => disconnectTelegramMutation.mutate()} disabled={disconnectTelegramMutation.isPending}>
                <Unlink size={13} /> Disconnect
              </ActionButton>
            </div>

            <div>
              <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Linked Chats</h4>
              {loadingTelegramChats ? <Spinner /> : telegramChats.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No chats linked yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  {telegramChats.map((chat: any) => (
                    <div key={chat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageCircle size={12} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>{chat.chat_id}</span>
                        <SmallBadge color="#3b82f6">{chat.chat_type}</SmallBadge>
                      </div>
                      <ActionButton onClick={() => sendTestMutation.mutate({ chat_id: chat.chat_id })} disabled={sendTestMutation.isPending}>
                        <Send size={11} /> Test
                      </ActionButton>
                    </div>
                  ))}
                </div>
              )}
              <div className="mobile-stack" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <InputField label="Chat ID" value={newChatId} onChange={setNewChatId} placeholder="e.g. 123456789" />
                </div>
                <div style={{ width: '120px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Type</label>
                  <select
                    value={newChatType}
                    onChange={(e) => setNewChatType(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                  >
                    <option value="private">Private</option>
                    <option value="group">Group</option>
                    <option value="channel">Channel</option>
                  </select>
                </div>
                <ActionButton onClick={() => linkChatMutation.mutate({ chat_id: newChatId, chat_type: newChatType })} disabled={!newChatId || linkChatMutation.isPending}>
                  <Plus size={13} /> Link
                </ActionButton>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>Connect a Telegram bot to receive notifications and send commands.</p>
            <ActionButton onClick={() => setShowTelegramModal(true)}>
              <MessageCircle size={14} /> Connect Telegram Bot
            </ActionButton>
          </div>
        )}
      </SectionCard>

      <SectionCard title="WhatsApp (Twilio)" icon={MessageCircle} subtitle="Send and receive commands via WhatsApp">
        {loadingWhatsApp ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}><Spinner /></div>
        ) : whatsappConfig ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="mobile-stack" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '10px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle size={16} style={{ color: '#22c55e' }} />
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{whatsappConfig.whatsapp_number}</p>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SID: {whatsappConfig.account_sid?.slice(0, 8)}...</span>
                </div>
              </div>
              <ActionButton variant="danger" onClick={() => disconnectWhatsAppMutation.mutate()} disabled={disconnectWhatsAppMutation.isPending}>
                <Unlink size={13} /> Disconnect
              </ActionButton>
            </div>
            <div style={{ padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '6px' }}>Webhook URL</p>
              <code style={{ display: 'block', fontSize: '11px', color: 'var(--text-primary)', backgroundColor: 'var(--bg)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                {window.location.origin}/v1/whatsapp/webhook
              </code>
            </div>
            <div className="mobile-stack" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <InputField label="Send test to" value={waTestTo} onChange={setWaTestTo} placeholder="+1234567890" />
              </div>
              <ActionButton onClick={() => testWhatsAppMutation.mutate({ to: waTestTo })} disabled={!waTestTo || testWhatsAppMutation.isPending}>
                <Send size={12} /> Send Test
              </ActionButton>
            </div>
            {testWhatsAppMutation.isSuccess && <p style={{ fontSize: '12px', color: '#32D74B' }}>Test message sent!</p>}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>Connect Twilio WhatsApp to send and receive commands. Use the sandbox for testing.</p>
            <ActionButton onClick={() => setShowWhatsAppModal(true)}>
              <MessageCircle size={14} /> Connect WhatsApp
            </ActionButton>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Webhooks" icon={Webhook} subtitle="Receive event notifications via HTTP">
        {loadingWebhooks ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}><Spinner /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {webhooks.length === 0 && (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No webhooks registered yet.</p>
            )}
            {webhooks.map((wh) => (
              <div key={wh.id} style={{ padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <Webhook size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wh.url}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Created {new Date(wh.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <StatusDot active={wh.is_active} />
                    <ToggleSwitch active={wh.is_active} onToggle={() => toggleWebhookMutation.mutate({ id: wh.id, is_active: !wh.is_active })} />
                    <button onClick={() => setViewDeliveriesId(viewDeliveriesId === wh.id ? null : wh.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}>
                      <Eye size={14} />
                    </button>
                    <button onClick={() => deleteWebhookMutation.mutate(wh.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {wh.events.map((ev) => <SmallBadge key={ev} color="#3b82f6">{ev}</SmallBadge>)}
                </div>
                {viewDeliveriesId === wh.id && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                    <h5 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Recent Deliveries</h5>
                    {loadingDeliveries ? <Spinner /> : deliveries.length === 0 ? (
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No deliveries yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                        {deliveries.map((d) => (
                          <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', padding: '6px 8px', backgroundColor: 'var(--bg)', borderRadius: '6px', flexWrap: 'wrap', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: d.success ? '#32D74B' : '#FF453A' }} />
                              <span style={{ color: 'var(--text-secondary)' }}>{d.event}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', color: 'var(--text-muted)' }}>
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
            <ActionButton onClick={() => setShowWebhookModal(true)}>
              <Plus size={14} /> Add Webhook
            </ActionButton>
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderSecurity = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionCard title="API Tokens" icon={Lock} subtitle="Personal API tokens for automation clients">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {revealedToken && (
            <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(50,215,75,0.08)', border: '1px solid rgba(50,215,75,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <AlertCircle size={14} style={{ color: '#32D74B' }} />
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#32D74B' }}>Token created — copy it now, it won't be shown again.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <code style={{ flex: 1, fontSize: '11px', padding: '8px 10px', backgroundColor: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                  {revealedToken}
                </code>
                <button onClick={() => copyToken(revealedToken)} style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', color: '#32D74B' }}>
                  {copiedToken ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <button onClick={() => setRevealedToken(null)} style={{ fontSize: '11px', color: '#32D74B', background: 'none', border: 'none', cursor: 'pointer', marginTop: '8px', padding: 0 }}>
                I've saved my token, dismiss
              </button>
            </div>
          )}

          {loadingApiTokens ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}><Spinner /></div>
          ) : apiTokens.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No tokens yet. Create a token to use the API.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {apiTokens.map((token) => (
                <div key={token.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Key size={13} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{token.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', paddingLeft: '21px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span>Created {new Date(token.created_at).toLocaleDateString()}</span>
                      {token.last_used_at && <span>Last used {new Date(token.last_used_at).toLocaleDateString()}</span>}
                      {token.expires_at && (
                        <span style={{ color: new Date(token.expires_at) < new Date() ? '#FF453A' : 'var(--text-muted)' }}>
                          Expires {new Date(token.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteTokenMutation.mutate(token.id)} style={{ padding: '6px', borderRadius: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <ActionButton onClick={() => setShowNewTokenModal(true)}>
            <Plus size={14} /> New Token
          </ActionButton>
        </div>
      </SectionCard>

      <SectionCard title="Account" icon={User} subtitle="Your account details">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Email</span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{user?.email || '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Role</span>
            <SmallBadge color="#A78BFA">{user?.role || '—'}</SmallBadge>
          </div>
          <div style={{ paddingTop: '8px' }}>
            <ActionButton variant="danger" onClick={logout}>
              <LogOut size={14} /> Sign Out
            </ActionButton>
          </div>
        </div>
      </SectionCard>
    </div>
  );

  const renderNotifications = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionCard title="Standup Delivery" icon={Mail} subtitle="Configure where daily standups are delivered">
        {loadingDeliveryConfig ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}><Spinner /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: deliveryConfig?.email_enabled ? '12px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(96,165,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail size={14} style={{ color: '#60A5FA' }} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Email (via Resend)</span>
                </div>
                <ToggleSwitch active={!!deliveryConfig?.email_enabled} onToggle={() => saveDeliveryMutation.mutate({ email_enabled: !deliveryConfig?.email_enabled })} />
              </div>
              {deliveryConfig?.email_enabled && (
                <div style={{ paddingLeft: '42px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <InputField
                    label="Recipients (comma-separated)"
                    value={deliveryEmailRecipients || (deliveryConfig?.email_recipients?.join(', ') ?? '')}
                    onChange={setDeliveryEmailRecipients}
                    placeholder="team@example.com, lead@example.com"
                  />
                  <ActionButton onClick={() => {
                    const recipients = deliveryEmailRecipients.split(',').map(e => e.trim()).filter(Boolean);
                    saveDeliveryMutation.mutate({ email_recipients: recipients });
                  }} disabled={saveDeliveryMutation.isPending}>
                    <Save size={12} /> Save Recipients
                  </ActionButton>
                </div>
              )}
            </div>

            <div style={{ padding: '14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: deliveryConfig?.slack_enabled ? '12px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(251,191,36,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Hash size={14} style={{ color: '#FBBF24' }} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Slack Webhook</span>
                </div>
                <ToggleSwitch active={!!deliveryConfig?.slack_enabled} onToggle={() => saveDeliveryMutation.mutate({ slack_enabled: !deliveryConfig?.slack_enabled })} />
              </div>
              {deliveryConfig?.slack_enabled && (
                <div style={{ paddingLeft: '42px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <InputField
                    label="Webhook URL"
                    value={deliverySlackWebhook || (deliveryConfig?.slack_webhook_url ?? '')}
                    onChange={setDeliverySlackWebhook}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                  <ActionButton onClick={() => saveDeliveryMutation.mutate({ slack_webhook_url: deliverySlackWebhook })} disabled={!deliverySlackWebhook || saveDeliveryMutation.isPending}>
                    <Save size={12} /> Save Webhook
                  </ActionButton>
                </div>
              )}
            </div>

            <div style={{ padding: '14px', backgroundColor: 'var(--surface-elevated)', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={14} style={{ color: '#3b82f6' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Telegram</span>
                    {!telegramConfig && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>(Connect bot first)</span>}
                  </div>
                </div>
                <ToggleSwitch active={!!deliveryConfig?.telegram_enabled} onToggle={() => saveDeliveryMutation.mutate({ telegram_enabled: !deliveryConfig?.telegram_enabled })} disabled={!telegramConfig} />
              </div>
              {deliveryConfig?.telegram_enabled && (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', paddingLeft: '42px' }}>Standups will be sent to all linked Telegram chats.</p>
              )}
            </div>

            {deliverySaveSuccess && (
              <p style={{ fontSize: '12px', color: '#32D74B', fontWeight: 500 }}>Delivery settings saved successfully!</p>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );

  const handleDownload = async (type: 'node' | 'extension') => {
    try {
      const token = localStorage.getItem('squidjob_token');
      const resp = await fetch(`/api/v1/downloads/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'node' ? 'squidjob-node.zip' : 'squidjob-extension.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Download failed. Please try again.');
    }
  };

  const renderDownloads = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionCard title="SquidJob Node" icon={Monitor} subtitle="Run agents on any machine and sync with the Hub">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            The SquidJob Node is a Next.js dashboard that runs alongside OpenClaw on any machine. It provides agent monitoring, file browsing, cost tracking, session history, cron management, terminal access, and real-time sync with this Hub.
          </p>

          <ActionButton onClick={() => handleDownload('node')} variant="primary" fullWidth>
            <Download size={16} /> Download Node App (.zip)
          </ActionButton>

          <div style={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={14} style={{ color: 'var(--accent)' }} /> Quick Start
            </h4>
            <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                'Download and unzip the file',
                <>Run <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', backgroundColor: 'var(--surface)', padding: '2px 6px', borderRadius: '4px' }}>npm install</code></>,
                <>Copy <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', backgroundColor: 'var(--surface)', padding: '2px 6px', borderRadius: '4px' }}>.env.example</code> to <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', backgroundColor: 'var(--surface)', padding: '2px 6px', borderRadius: '4px' }}>.env</code> and fill in your Hub URL, API key, and Node ID (<a href="/fleet" style={{ color: 'var(--accent)', textDecoration: 'none' }}>register a node here</a>)</>,
                <>Run <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', backgroundColor: 'var(--surface)', padding: '2px 6px', borderRadius: '4px' }}>npm run dev</code> to start the dashboard</>,
              ].map((step, i) => (
                <li key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{step}</li>
              ))}
            </ol>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <SmallBadge color="#64D2FF">Node.js 18+</SmallBadge>
            <SmallBadge color="#64D2FF">npm</SmallBadge>
            <SmallBadge color="#30D158">Next.js</SmallBadge>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Chrome Extension" icon={Globe} subtitle="Monitor fleet status from your browser toolbar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            The SquidJob Fleet Monitor extension shows node statuses, agent counts, and system metrics right in your browser toolbar. Get notifications when nodes go offline or come back online.
          </p>

          <ActionButton onClick={() => handleDownload('extension')} variant="primary" fullWidth>
            <Download size={16} /> Download Chrome Extension (.zip)
          </ActionButton>

          <div style={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={14} style={{ color: 'var(--accent)' }} /> Quick Start
            </h4>
            <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                'Download and unzip the file',
                <>Open Chrome and go to <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', backgroundColor: 'var(--surface)', padding: '2px 6px', borderRadius: '4px' }}>chrome://extensions</code></>,
                'Enable "Developer mode" in the top right corner',
                'Click "Load unpacked" and select the unzipped folder',
                'Click the extension icon in your toolbar and configure your Hub URL and API key',
              ].map((step, i) => (
                <li key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{step}</li>
              ))}
            </ol>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <SmallBadge color="#64D2FF">Chrome</SmallBadge>
            <SmallBadge color="#64D2FF">Edge</SmallBadge>
            <SmallBadge color="#64D2FF">Brave</SmallBadge>
            <SmallBadge color="#30D158">Manifest V3</SmallBadge>
          </div>
        </div>
      </SectionCard>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Manage your workspace, integrations, and security</p>
      </div>

      <div className="mobile-scroll-x" style={{ display: 'flex', gap: '4px', marginBottom: '20px', padding: '4px', backgroundColor: 'var(--surface-elevated)', borderRadius: '10px', border: '1px solid var(--border)' }}>
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="settings-tab-btn"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                cursor: 'pointer', border: 'none', transition: 'all 150ms',
                backgroundColor: isActive ? 'var(--card)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              <TabIcon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'general' && renderGeneral()}
      {activeTab === 'integrations' && renderIntegrations()}
      {activeTab === 'security' && renderSecurity()}
      {activeTab === 'notifications' && renderNotifications()}
      {activeTab === 'downloads' && renderDownloads()}

      {showConnectModal && (
        <Modal title="Connect Provider" onClose={() => { setShowConnectModal(false); setConnectError(''); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Provider</label>
              <select
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
              >
                {Object.entries(PROVIDER_ICONS).map(([key, info]) => (
                  <option key={key} value={key}>{info.label}</option>
                ))}
              </select>
            </div>
            <InputField label="API Key" value={newApiKey} onChange={setNewApiKey} placeholder="sk-..." type="password" />
            {connectError && <p style={{ fontSize: '12px', color: '#FF453A' }}>{connectError}</p>}
            <ActionButton variant="primary" fullWidth onClick={() => connectMutation.mutate({ provider: newProvider, api_key: newApiKey })} disabled={!newApiKey || connectMutation.isPending}>
              {connectMutation.isPending ? <Spinner /> : <Key size={14} />} Connect
            </ActionButton>
          </div>
        </Modal>
      )}

      {showWebhookModal && (
        <Modal title="Add Webhook" onClose={() => { setShowWebhookModal(false); setWebhookError(''); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <InputField label="URL" value={webhookUrl} onChange={setWebhookUrl} placeholder="https://your-server.com/webhook" />
            <InputField label="Secret (optional)" value={webhookSecret} onChange={setWebhookSecret} placeholder="Optional signing secret" />
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>Events</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {WEBHOOK_EVENTS.map((ev) => {
                  const selected = webhookEvents.includes(ev);
                  return (
                    <button
                      key={ev}
                      onClick={() => setWebhookEvents(selected ? webhookEvents.filter(e => e !== ev) : [...webhookEvents, ev])}
                      style={{
                        padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                        border: '1px solid', transition: 'all 150ms',
                        backgroundColor: selected ? 'rgba(59,130,246,0.1)' : 'var(--surface-elevated)',
                        borderColor: selected ? 'rgba(59,130,246,0.3)' : 'var(--border)',
                        color: selected ? '#60A5FA' : 'var(--text-muted)',
                      }}
                    >
                      {ev}
                    </button>
                  );
                })}
              </div>
            </div>
            {webhookError && <p style={{ fontSize: '12px', color: '#FF453A' }}>{webhookError}</p>}
            <ActionButton variant="primary" fullWidth onClick={() => createWebhookMutation.mutate({ url: webhookUrl, events: webhookEvents, secret: webhookSecret || undefined })} disabled={!webhookUrl || webhookEvents.length === 0 || createWebhookMutation.isPending}>
              {createWebhookMutation.isPending ? <Spinner /> : <Webhook size={14} />} Create Webhook
            </ActionButton>
          </div>
        </Modal>
      )}

      {showTelegramModal && (
        <Modal title="Connect Telegram Bot" onClose={() => { setShowTelegramModal(false); setTelegramError(''); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              1. Message @BotFather on Telegram{'\n'}
              2. Create a new bot with /newbot{'\n'}
              3. Paste the bot token below
            </p>
            <InputField label="Bot Token" value={telegramBotToken} onChange={setTelegramBotToken} placeholder="123456:ABC-DEF..." />
            {telegramError && <p style={{ fontSize: '12px', color: '#FF453A' }}>{telegramError}</p>}
            <ActionButton variant="primary" fullWidth onClick={() => connectTelegramMutation.mutate({ bot_token: telegramBotToken })} disabled={!telegramBotToken || connectTelegramMutation.isPending}>
              {connectTelegramMutation.isPending ? <Spinner /> : <MessageCircle size={14} />} Connect
            </ActionButton>
          </div>
        </Modal>
      )}

      {showWhatsAppModal && (
        <Modal title="Connect WhatsApp (Twilio)" onClose={() => { setShowWhatsAppModal(false); setWaError(''); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <InputField label="Account SID" value={waAccountSid} onChange={setWaAccountSid} placeholder="ACxxxxxxxx" />
            <InputField label="Auth Token" value={waAuthToken} onChange={setWaAuthToken} placeholder="Your Twilio auth token" type="password" />
            <InputField label="WhatsApp Number" value={waNumber} onChange={setWaNumber} placeholder="+14155238886" />
            {waError && <p style={{ fontSize: '12px', color: '#FF453A' }}>{waError}</p>}
            <ActionButton variant="primary" fullWidth onClick={() => connectWhatsAppMutation.mutate({ account_sid: waAccountSid, auth_token: waAuthToken, whatsapp_number: waNumber })} disabled={!waAccountSid || !waAuthToken || !waNumber || connectWhatsAppMutation.isPending}>
              {connectWhatsAppMutation.isPending ? <Spinner /> : <MessageCircle size={14} />} Connect
            </ActionButton>
          </div>
        </Modal>
      )}

      {showNewTagModal && (
        <Modal title="New Tag" onClose={() => setShowNewTagModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <InputField label="Name" value={newTagName} onChange={setNewTagName} placeholder="e.g. urgent, design, backend" />
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>Color</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewTagColor(c)}
                    style={{
                      width: '28px', height: '28px', borderRadius: '8px', backgroundColor: c, border: newTagColor === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                      cursor: 'pointer', transition: 'border-color 150ms',
                    }}
                  />
                ))}
              </div>
            </div>
            <ActionButton variant="primary" fullWidth onClick={() => createTagMutation.mutate({ name: newTagName, color: newTagColor })} disabled={!newTagName || createTagMutation.isPending}>
              <Tag size={14} /> Create Tag
            </ActionButton>
          </div>
        </Modal>
      )}

      {showNewTokenModal && (
        <Modal title="New API Token" onClose={() => setShowNewTokenModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <InputField label="Name" value={newTokenName} onChange={setNewTokenName} placeholder="e.g. CI/CD, Automation Script" />
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Expires in (days, optional)</label>
              <input
                type="number"
                value={newTokenExpiry}
                onChange={(e) => setNewTokenExpiry(e.target.value)}
                placeholder="e.g. 90 (leave blank for no expiry)"
                style={{ width: '100%', padding: '9px 12px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
              />
            </div>
            <ActionButton variant="primary" fullWidth onClick={() => {
              const expiryDays = newTokenExpiry ? parseInt(newTokenExpiry, 10) : undefined;
              createTokenMutation.mutate({ name: newTokenName, expires_in_days: expiryDays });
            }} disabled={!newTokenName || createTokenMutation.isPending}>
              <Key size={14} /> Create Token
            </ActionButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
