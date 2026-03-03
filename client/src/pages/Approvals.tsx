import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import {
  ShieldCheck, Clock, CheckCircle, XCircle, AlertTriangle,
  Hourglass, Check, X
} from 'lucide-react';

interface Approval {
  id: string;
  title: string;
  description: string | null;
  action_type: string;
  payload: Record<string, unknown> | null;
  requested_by_agent_id: string | null;
  requested_by_agent_name?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewed_by: string | null;
  reviewed_at: string | null;
  expires_at: string;
  created_at: string;
}

const ACTION_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  ssh_exec: { label: 'SSH Exec', color: '#FF9F0A', bg: 'rgba(255,159,10,0.1)' },
  task_action: { label: 'Task Action', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
  agent_action: { label: 'Agent Action', color: '#BF5AF2', bg: 'rgba(191,90,242,0.1)' },
  custom: { label: 'Custom', color: 'var(--text-muted)', bg: 'var(--surface-elevated)' },
};

function relativeTime(dateStr: string): string {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function expiresIn(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

const TABS = [
  { key: 'pending' as const, label: 'Pending', icon: Hourglass, color: '#FF9F0A' },
  { key: 'approved' as const, label: 'Approved', icon: CheckCircle, color: '#32D74B' },
  { key: 'rejected' as const, label: 'Rejected / Expired', icon: XCircle, color: '#FF453A' },
];
type Tab = typeof TABS[number]['key'];

function ApprovalCard({ approval, onDecision }: { approval: Approval; onDecision?: (id: string, decision: 'approved' | 'rejected') => void }) {
  const isPending = approval.status === 'pending';
  const isExpired = approval.status === 'expired';
  const actionConfig = ACTION_TYPE_LABELS[approval.action_type] || ACTION_TYPE_LABELS.custom;

  return (
    <div style={{
      backgroundColor: 'var(--card)', border: `1px solid ${isPending ? 'rgba(255,159,10,0.15)' : 'var(--border)'}`,
      borderRadius: '12px', padding: '18px 20px', transition: 'all 150ms',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
        e.currentTarget.style.borderColor = isPending ? 'rgba(255,159,10,0.3)' : 'var(--border)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'var(--card)';
        e.currentTarget.style.borderColor = isPending ? 'rgba(255,159,10,0.15)' : 'var(--border)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
            {approval.title}
          </h3>
          {approval.description && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{approval.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '3px 8px',
            borderRadius: '5px', fontSize: '10px', fontWeight: 600,
            backgroundColor: actionConfig.bg, color: actionConfig.color,
            border: `1px solid ${actionConfig.color}25`, letterSpacing: '0.02em',
          }}>
            {actionConfig.label}
          </span>
          {isExpired && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', padding: '3px 8px',
              borderRadius: '5px', fontSize: '10px', fontWeight: 600,
              backgroundColor: 'var(--surface-elevated)', color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}>
              Expired
            </span>
          )}
        </div>
      </div>

      {approval.payload && Object.keys(approval.payload).length > 0 && (
        <div style={{
          backgroundColor: 'var(--surface-elevated)', borderRadius: '8px',
          border: '1px solid var(--border)', padding: '10px 12px', marginBottom: '12px',
        }}>
          <pre style={{
            fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
            overflow: 'auto', maxHeight: '80px', whiteSpace: 'pre-wrap', margin: 0,
          }}>
            {JSON.stringify(approval.payload, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
          {approval.requested_by_agent_name && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={11} /> {approval.requested_by_agent_name}
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={11} /> {relativeTime(approval.created_at)}
          </span>
          {isPending && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#FF9F0A', fontWeight: 500 }}>
              <AlertTriangle size={11} /> Expires in {expiresIn(approval.expires_at)}
            </span>
          )}
        </div>

        {isPending && onDecision && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => onDecision(approval.id, 'rejected')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '6px 12px', borderRadius: '7px',
                border: '1px solid rgba(255,69,58,0.3)', backgroundColor: 'rgba(255,69,58,0.06)',
                color: '#FF453A', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <X size={12} /> Reject
            </button>
            <button
              onClick={() => onDecision(approval.id, 'approved')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '6px 12px', borderRadius: '7px',
                border: 'none', backgroundColor: '#32D74B',
                color: '#000', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Check size={12} /> Approve
            </button>
          </div>
        )}

        {!isPending && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
            backgroundColor: approval.status === 'approved' ? 'rgba(50,215,75,0.1)' : 'rgba(255,69,58,0.1)',
            color: approval.status === 'approved' ? '#32D74B' : '#FF453A',
            border: `1px solid ${approval.status === 'approved' ? 'rgba(50,215,75,0.2)' : 'rgba(255,69,58,0.2)'}`,
          }}>
            {approval.status === 'approved' ? <CheckCircle size={11} /> : <XCircle size={11} />}
            {approval.status === 'approved' ? 'Approved' : approval.status === 'rejected' ? 'Rejected' : 'Expired'}
          </span>
        )}
      </div>
    </div>
  );
}

export function Approvals() {
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const queryClient = useQueryClient();

  const { data: allData } = useQuery({
    queryKey: ['approvals', 'all'],
    queryFn: () => apiGet<{ approvals: Approval[] }>('/v1/approvals'),
    refetchInterval: 30000,
  });

  const statusParam = activeTab === 'rejected' ? undefined : activeTab;

  const { data, isLoading } = useQuery({
    queryKey: ['approvals', activeTab],
    queryFn: () => apiGet<{ approvals: Approval[] }>(`/v1/approvals${statusParam ? `?status=${statusParam}` : ''}`),
    refetchInterval: activeTab === 'pending' ? 15000 : false,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) =>
      apiPatch(`/v1/approvals/${id}`, { decision }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
    },
  });

  const allApprovals = allData?.approvals ?? [];
  const tabCounts = {
    pending: allApprovals.filter(a => a.status === 'pending').length,
    approved: allApprovals.filter(a => a.status === 'approved').length,
    rejected: allApprovals.filter(a => a.status === 'rejected' || a.status === 'expired').length,
  };

  const approvals = data?.approvals ?? [];
  const displayApprovals = activeTab === 'rejected'
    ? approvals.filter(a => a.status === 'rejected' || a.status === 'expired')
    : approvals;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Approvals</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Review and approve agent-initiated actions</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        {TABS.map(tab => {
          const count = tabCounts[tab.key];
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                backgroundColor: isActive ? `${tab.color}08` : 'var(--card)',
                border: `1px solid ${isActive ? `${tab.color}30` : 'var(--border)'}`,
                borderRadius: '12px', padding: '16px 20px', cursor: 'pointer',
                transition: 'all 150ms', textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <tab.icon size={13} style={{ color: tab.color }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{tab.label}</span>
              </div>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, color: isActive ? tab.color : 'var(--text-primary)' }}>
                {count}
              </p>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><Spinner /></div>
      ) : displayApprovals.length === 0 ? (
        <div style={{ backgroundColor: 'var(--card)', border: '1px dashed var(--border)', borderRadius: '14px', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ShieldCheck size={26} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          </div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            {activeTab === 'pending' ? 'No pending approvals' : `No ${activeTab} approvals`}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '380px', margin: '0 auto', lineHeight: 1.6 }}>
            {activeTab === 'pending'
              ? 'All clear — no actions waiting for your review. Agents will request approval when they need to perform sensitive operations.'
              : `No approvals have been ${activeTab} yet.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayApprovals.map(approval => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onDecision={activeTab === 'pending'
                ? (id, decision) => reviewMutation.mutate({ id, decision })
                : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
