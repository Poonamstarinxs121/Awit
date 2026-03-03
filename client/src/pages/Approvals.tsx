import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ShieldCheck, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

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

const ACTION_TYPE_LABELS: Record<string, string> = {
  ssh_exec: 'SSH Exec',
  task_action: 'Task Action',
  agent_action: 'Agent Action',
  custom: 'Custom',
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function expiresIn(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = then - now;
  if (diff <= 0) return 'expired';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

const TABS = ['pending', 'approved', 'rejected'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected / Expired',
};

function ApprovalCard({ approval, onDecision }: { approval: Approval; onDecision?: (id: string, decision: 'approved' | 'rejected') => void }) {
  const isPending = approval.status === 'pending';
  const isExpired = approval.status === 'expired';

  return (
    <div className="bg-white border border-border-default rounded-xl p-5 space-y-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary font-heading">{approval.title}</h3>
          {approval.description && (
            <p className="text-sm text-text-secondary">{approval.description}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
            {ACTION_TYPE_LABELS[approval.action_type] ?? approval.action_type}
          </span>
          {isExpired && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-text-muted text-xs font-medium">
              Expired
            </span>
          )}
        </div>
      </div>

      {approval.payload && (
        <div className="bg-slate-50 rounded-lg border border-border-default p-3">
          <pre className="text-xs text-text-secondary overflow-auto max-h-24 whitespace-pre-wrap">
            {JSON.stringify(approval.payload, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs text-text-muted">
          {approval.requested_by_agent_name && (
            <span className="flex items-center gap-1">
              <ShieldCheck size={12} />
              {approval.requested_by_agent_name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {relativeTime(approval.created_at)}
          </span>
          {isPending && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle size={12} />
              Expires in {expiresIn(approval.expires_at)}
            </span>
          )}
        </div>

        {isPending && onDecision && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="text-danger border-red-200 hover:bg-red-50"
              onClick={() => onDecision(approval.id, 'rejected')}
            >
              <XCircle size={14} className="mr-1" />
              Reject
            </Button>
            <Button
              size="sm"
              onClick={() => onDecision(approval.id, 'approved')}
            >
              <CheckCircle size={14} className="mr-1" />
              Approve
            </Button>
          </div>
        )}

        {!isPending && (
          <Badge variant={approval.status === 'approved' ? 'active' : 'error'}>
            {approval.status === 'approved' ? 'Approved' : approval.status === 'rejected' ? 'Rejected' : 'Expired'}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function Approvals() {
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const queryClient = useQueryClient();

  const statusParam = activeTab === 'rejected' ? undefined : activeTab;

  const { data, isLoading } = useQuery({
    queryKey: ['approvals', activeTab],
    queryFn: () => apiGet<{ approvals: Approval[] }>(
      `/v1/approvals${statusParam ? `?status=${statusParam}` : ''}`
    ),
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

  const approvals = data?.approvals ?? [];
  const displayApprovals = activeTab === 'rejected'
    ? approvals.filter(a => a.status === 'rejected' || a.status === 'expired')
    : approvals;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-accent/10 flex items-center justify-center">
          <ShieldCheck size={20} className="text-brand-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary font-heading">Approvals</h1>
          <p className="text-sm text-text-secondary">Review and approve agent-initiated actions</p>
        </div>
      </div>

      <div className="flex gap-1 bg-surface-light p-1 rounded-lg w-fit border border-border-default">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-white text-text-primary shadow-sm border border-border-default'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner />
        </div>
      ) : displayApprovals.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center bg-white border border-border-default rounded-xl">
          <ShieldCheck size={40} className="text-text-muted mb-3" />
          <p className="font-medium text-text-primary">No {TAB_LABELS[activeTab].toLowerCase()} approvals</p>
          <p className="text-sm text-text-secondary mt-1">
            {activeTab === 'pending'
              ? 'All clear — no actions waiting for review.'
              : `Nothing here yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayApprovals.map((approval) => (
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
