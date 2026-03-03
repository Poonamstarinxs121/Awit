import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import {
  Activity as ActivityIcon, CheckSquare, MessageSquare, Heart,
  Clock, Terminal, ShieldCheck, Zap, ChevronDown
} from 'lucide-react';

interface ActivityEvent {
  id: string;
  actor_id: string;
  actor_name?: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ACTION_TYPES = [
  { value: '', label: 'All Events' },
  { value: 'task_created', label: 'Task Created' },
  { value: 'task_updated', label: 'Task Updated' },
  { value: 'task_status_changed', label: 'Status Changed' },
  { value: 'agent_message', label: 'Agent Message' },
  { value: 'heartbeat', label: 'Heartbeat' },
  { value: 'cron_run', label: 'Cron Run' },
  { value: 'ssh_exec', label: 'SSH Exec' },
  { value: 'comment_added', label: 'Comment' },
];

function eventIcon(action: string) {
  if (action.includes('task')) return <CheckSquare size={15} className="text-brand-accent" />;
  if (action.includes('message')) return <MessageSquare size={15} className="text-purple-accent" />;
  if (action.includes('heartbeat')) return <Heart size={15} className="text-pink-500" />;
  if (action.includes('cron')) return <Clock size={15} className="text-amber-500" />;
  if (action.includes('ssh') || action.includes('exec')) return <Terminal size={15} className="text-emerald-600" />;
  if (action.includes('approval')) return <ShieldCheck size={15} className="text-blue-600" />;
  if (action.includes('comment')) return <MessageSquare size={15} className="text-sky-500" />;
  return <Zap size={15} className="text-text-muted" />;
}

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

function actionLabel(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Activity() {
  const [activeFilter, setActiveFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [allActivities, setAllActivities] = useState<ActivityEvent[]>([]);
  const PAGE_SIZE = 50;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['activity-page', activeFilter, offset],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (activeFilter) params.set('type', activeFilter);
      const result = await apiGet<{ activities: ActivityEvent[] }>(`/v1/activity?${params}`);
      if (offset === 0) {
        setAllActivities(result.activities);
      } else {
        setAllActivities((prev) => [...prev, ...result.activities]);
      }
      return result;
    },
  });

  const handleFilterChange = (value: string) => {
    setActiveFilter(value);
    setOffset(0);
    setAllActivities([]);
  };

  const hasMore = (data?.activities.length ?? 0) === PAGE_SIZE;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-accent/10 flex items-center justify-center">
          <ActivityIcon size={20} className="text-brand-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary font-heading">Activity</h1>
          <p className="text-sm text-text-secondary">Full timeline of platform events</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ACTION_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => handleFilterChange(type.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeFilter === type.value
                ? 'bg-brand-accent text-white border-brand-accent'
                : 'bg-white text-text-secondary border-border-default hover:border-brand-accent hover:text-brand-accent'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {isLoading && offset === 0 ? (
        <div className="flex items-center justify-center h-48">
          <Spinner />
        </div>
      ) : allActivities.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-white border border-border-default rounded-xl text-center">
          <ActivityIcon size={40} className="text-text-muted mb-3" />
          <p className="font-medium text-text-primary">No activity yet</p>
          <p className="text-sm text-text-secondary mt-1">Events will appear here as agents work.</p>
        </div>
      ) : (
        <div className="bg-white border border-border-default rounded-xl overflow-hidden shadow-sm">
          <div className="divide-y divide-border-default">
            {allActivities.map((event, idx) => (
              <div key={event.id ?? idx} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                <div className="mt-0.5 w-7 h-7 rounded-lg bg-slate-50 border border-border-default flex items-center justify-center shrink-0">
                  {eventIcon(event.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {event.actor_name && (
                      <span className="text-sm font-medium text-text-primary">{event.actor_name}</span>
                    )}
                    <span className="text-sm text-text-secondary">{actionLabel(event.action)}</span>
                    {event.target_type && (
                      <span className="text-xs text-text-muted bg-slate-100 px-1.5 py-0.5 rounded">
                        {event.target_type}
                      </span>
                    )}
                  </div>
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <p className="text-xs text-text-muted mt-0.5 truncate max-w-md">
                      {Object.entries(event.metadata)
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <span className="text-xs text-text-muted whitespace-nowrap shrink-0">
                  {relativeTime(event.created_at)}
                </span>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="border-t border-border-default p-4 flex justify-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={isFetching}
              >
                {isFetching ? <Spinner size="sm" className="mr-2" /> : <ChevronDown size={15} className="mr-1.5" />}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
