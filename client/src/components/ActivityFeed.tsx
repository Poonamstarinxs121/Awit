import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Search, MessageSquare, Terminal, CheckCircle, XCircle, Clock, Zap, Shield, Hammer, Brain, Activity } from 'lucide-react';
import { apiGet } from '../api/client';

interface ActivityItem {
  id: string;
  created_at: string;
  action: string;
  agent_id?: string;
  actor_id?: string;
  details?: any;
  metadata?: any;
}

interface Props {
  limit?: number;
}

const typeConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
  file: { icon: FileText, color: 'var(--type-file)', bgColor: 'var(--type-file-bg)' },
  search: { icon: Search, color: 'var(--type-search)', bgColor: 'var(--type-search-bg)' },
  message: { icon: MessageSquare, color: 'var(--type-message)', bgColor: 'var(--type-message-bg)' },
  command: { icon: Terminal, color: 'var(--type-command)', bgColor: 'var(--type-command-bg)' },
  ssh: { icon: Terminal, color: 'var(--type-ssh)', bgColor: 'var(--type-ssh-bg)' },
  cron: { icon: Clock, color: 'var(--type-cron)', bgColor: 'var(--type-cron-bg)' },
  heartbeat: { icon: Zap, color: 'var(--type-heartbeat)', bgColor: 'var(--type-heartbeat-bg)' },
  security: { icon: Shield, color: 'var(--type-security)', bgColor: 'var(--type-security-bg)' },
  build: { icon: Hammer, color: 'var(--type-build)', bgColor: 'var(--type-build-bg)' },
  memory: { icon: Brain, color: 'var(--info)', bgColor: 'var(--info-soft)' },
  success: { icon: CheckCircle, color: 'var(--positive)', bgColor: 'var(--positive-soft)' },
  error: { icon: XCircle, color: 'var(--negative)', bgColor: 'var(--negative-soft)' },
  default: { icon: Activity, color: 'var(--text-muted)', bgColor: 'var(--surface-hover)' },
};

function getConfig(action: string) {
  const lower = action?.toLowerCase() || '';
  for (const key of Object.keys(typeConfig)) {
    if (lower.includes(key)) return typeConfig[key];
  }
  return typeConfig.default;
}

function getDescription(item: ActivityItem): string {
  const d = item.details ?? item.metadata;
  if (typeof d === 'string') return d;
  if (typeof d === 'object' && d) {
    return d.description || d.message || d.action || item.action;
  }
  return item.action;
}

export function ActivityFeed({ limit = 10 }: Props) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ activities: ActivityItem[] }>(`/v1/activity?limit=${limit}`)
      .then(data => { setItems(data.activities || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [limit]);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        Loading activity...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No activity yet
      </div>
    );
  }

  return (
    <div>
      {items.map((item) => {
        const config = getConfig(item.action);
        const Icon = config.icon;
        const desc = getDescription(item);
        const timeAgo = (() => {
          try {
            return formatDistanceToNow(new Date(item.created_at), { addSuffix: true });
          } catch {
            return 'recently';
          }
        })();

        return (
          <div
            key={item.id}
            className="flex items-start gap-3"
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border)',
              transition: 'background-color 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: config.bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px',
              }}
            >
              <Icon style={{ width: '14px', height: '14px', color: config.color }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                className="line-clamp-2"
                style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.4 }}
              >
                {desc}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: config.color,
                    backgroundColor: config.bgColor,
                    padding: '1px 6px',
                    borderRadius: '3px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {item.action || 'event'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {timeAgo}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
