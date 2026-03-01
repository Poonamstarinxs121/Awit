import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Users, ListTodo, CheckCircle, Activity } from 'lucide-react';
import { apiGet } from '../api/client';
import type { Agent, Activity as ActivityType, TaskStatus } from '../types';

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const statusBadgeVariant: Record<string, 'active' | 'idle' | 'error' | 'default'> = {
  active: 'active',
  idle: 'idle',
  error: 'error',
  disabled: 'idle',
};

const TASK_STATUSES: { key: TaskStatus; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'waiting_on_human', label: 'Waiting' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
  { key: 'archived', label: 'Archived' },
];

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiGet<{ agents: Agent[] }>('/v1/agents'),
  });

  const { data: taskStatsData } = useQuery({
    queryKey: ['taskStats'],
    queryFn: () => apiGet<{ stats: { status: TaskStatus; count: number }[] }>('/v1/tasks/stats'),
  });

  const { data: activityData } = useQuery({
    queryKey: ['recentActivity'],
    queryFn: () => apiGet<{ activities: ActivityType[] }>('/v1/activity?limit=10'),
  });

  const agents = agentsData?.agents ?? [];
  const taskStats = taskStatsData?.stats ?? [];
  const activities = activityData?.activities ?? [];

  const taskCountByStatus = taskStats.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = s.count;
    return acc;
  }, {});

  const totalAgents = agents.length;
  const activeTasks = taskStats.filter((s) => s.status !== 'done').reduce((sum, s) => sum + s.count, 0);
  const completedToday = taskCountByStatus['done'] ?? 0;
  const totalActivity = activities.length;

  const stats = [
    { label: 'Total Agents', value: totalAgents, icon: Users, color: 'text-blue-600' },
    { label: 'Active Tasks', value: activeTasks, icon: ListTodo, color: 'text-amber-600' },
    { label: 'Completed', value: completedToday, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Activity', value: totalActivity, icon: Activity, color: 'text-purple-600' },
  ];

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Welcome back, {user?.name || 'Commander'}
        </h1>
        <p className="text-text-secondary mt-1">
          {user?.tenantName && <span className="text-text-primary font-medium">{user.tenantName}</span>}
          {user?.tenantName && <span className="mx-2">·</span>}
          {today}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">{stat.label}</p>
                <p className="text-3xl font-bold text-text-primary mt-1">{stat.value}</p>
              </div>
              <stat.icon size={32} className={`${stat.color} opacity-60`} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Agent Status">
          {agents.length === 0 ? (
            <p className="text-text-muted text-sm">No agents configured</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => navigate(`/agents/${agent.id}`)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-surface-light/50 hover:bg-surface-light border border-border-default transition-colors text-left w-full"
                >
                  <div className="w-9 h-9 rounded-full bg-brand-accent/20 flex items-center justify-center shrink-0">
                    <span className="text-brand-accent font-semibold text-sm">
                      {agent.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{agent.name}</p>
                    <p className="text-xs text-text-secondary truncate">{agent.role}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={statusBadgeVariant[agent.status as string] || 'default'}>
                      {agent.status}
                    </Badge>
                    <span className="text-[10px] text-text-muted uppercase">{agent.level}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="Task Pipeline">
          <div className="space-y-4">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {TASK_STATUSES.map((ts) => (
                <div
                  key={ts.key}
                  className="text-center p-3 rounded-lg bg-surface-light border border-border-default"
                >
                  <p className="text-2xl font-bold text-text-primary">{taskCountByStatus[ts.key] ?? 0}</p>
                  <p className="text-[10px] text-text-secondary uppercase mt-1 leading-tight">{ts.label}</p>
                </div>
              ))}
            </div>
            {taskStats.length > 0 && (
              <div className="flex h-2 rounded-full overflow-hidden bg-surface-light">
                {TASK_STATUSES.map((ts) => {
                  const count = taskCountByStatus[ts.key] ?? 0;
                  const total = taskStats.reduce((s, st) => s + st.count, 0);
                  if (total === 0 || count === 0) return null;
                  const colors: Record<string, string> = {
                    inbox: 'bg-gray-400',
                    assigned: 'bg-blue-500',
                    in_progress: 'bg-amber-500',
                    waiting_on_human: 'bg-pink-500',
                    blocked: 'bg-red-500',
                    review: 'bg-purple-500',
                    done: 'bg-green-500',
                    archived: 'bg-gray-300',
                  };
                  return (
                    <div
                      key={ts.key}
                      className={`${colors[ts.key]} transition-all`}
                      style={{ width: `${(count / total) * 100}%` }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card title="Recent Activity">
        {activities.length === 0 ? (
          <p className="text-text-muted text-sm">No activity yet</p>
        ) : (
          <div className="space-y-0">
            {activities.map((activity, idx) => (
              <div
                key={activity.id}
                className={`flex items-start gap-3 py-3 ${
                  idx < activities.length - 1 ? 'border-b border-border-default' : ''
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-brand-accent mt-2 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-secondary">
                    <span className="font-medium text-text-primary">{activity.actor_name || 'System'}</span>
                    {' '}
                    <span>{formatAction(activity.action)}</span>
                    {activity.metadata && (activity.metadata as Record<string, string>).title && (
                      <>
                        {' '}
                        <span className="text-text-primary">"{String((activity.metadata as Record<string, string>).title)}"</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">{relativeTime(activity.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
