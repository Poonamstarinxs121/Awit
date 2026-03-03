import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronDown, ChevronRight, CheckCircle, Clock, AlertTriangle, Mail, MessageSquare, Send } from 'lucide-react';
import { apiGet } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import type { Standup } from '../types';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface AgentSummary {
  agent_name?: string;
  completed?: string[];
  in_progress?: string[];
  blockers?: string[];
}

function StandupCard({ standup }: { standup: Standup }) {
  const [expanded, setExpanded] = useState(false);
  const agentSummaries = (standup.per_agent_summaries || []) as AgentSummary[];

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)]">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <Calendar size={18} className="text-brand-accent" />
          <h3 className="text-text-primary font-semibold text-lg">{formatDate(standup.date)}</h3>
        </div>
        <p className="text-text-secondary text-sm leading-relaxed">{standup.summary}</p>

        {standup.delivered_to && standup.delivered_to.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Send size={13} className="text-text-muted flex-shrink-0" />
            <span className="text-xs text-text-muted mr-1">Delivered to:</span>
            {standup.delivered_to.map((channel: string) => {
              const channelLower = channel.toLowerCase();
              const isEmail = channelLower.includes('email');
              const isTelegram = channelLower.includes('telegram');
              const isSlack = channelLower.includes('slack');
              const bg = isEmail ? 'rgba(59,130,246,0.12)' : isTelegram ? 'rgba(10,132,255,0.12)' : isSlack ? 'rgba(74,21,75,0.15)' : 'rgba(100,100,100,0.12)';
              const color = isEmail ? '#60A5FA' : isTelegram ? '#0A84FF' : isSlack ? '#E01E5A' : 'var(--text-muted)';
              const ChannelIcon = isEmail ? Mail : MessageSquare;
              return (
                <span
                  key={channel}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', backgroundColor: bg, color, fontSize: '11px', fontWeight: 600, border: `1px solid ${color}30` }}
                >
                  <ChannelIcon size={10} />
                  {channel}
                </span>
              );
            })}
          </div>
        )}

        {agentSummaries.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 mt-4 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {agentSummaries.length} agent {agentSummaries.length === 1 ? 'summary' : 'summaries'}
          </button>
        )}
      </div>

      {expanded && agentSummaries.length > 0 && (
        <div className="border-t border-[var(--border)] px-6 py-4 space-y-4">
          {agentSummaries.map((as, idx) => (
            <div key={idx} className="bg-[var(--surface-elevated)] rounded-lg p-4 border border-[var(--border)]">
              <h4 className="text-text-primary font-medium mb-3">{as.agent_name || `Agent ${idx + 1}`}</h4>
              <div className="space-y-2">
                {as.completed && as.completed.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-teal-400 font-medium mb-1">
                      <CheckCircle size={12} /> Completed
                    </div>
                    <ul className="text-sm text-text-secondary space-y-0.5 pl-4">
                      {as.completed.map((item, i) => <li key={i}>• {item}</li>)}
                    </ul>
                  </div>
                )}
                {as.in_progress && as.in_progress.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-blue-400 font-medium mb-1">
                      <Clock size={12} /> In Progress
                    </div>
                    <ul className="text-sm text-text-secondary space-y-0.5 pl-4">
                      {as.in_progress.map((item, i) => <li key={i}>• {item}</li>)}
                    </ul>
                  </div>
                )}
                {as.blockers && as.blockers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium mb-1">
                      <AlertTriangle size={12} /> Blockers
                    </div>
                    <ul className="text-sm text-text-secondary space-y-0.5 pl-4">
                      {as.blockers.map((item, i) => <li key={i}>• {item}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Standups() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['standups'],
    queryFn: () => apiGet<{ standups: Standup[] }>('/v1/standups'),
  });

  const standups = data?.standups ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Daily Standups</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Automated agent activity summaries delivered to your channels</p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <div className="bg-[rgba(255,59,48,0.1)]0/10 border border-red-500/30 rounded-xl p-6 text-red-400">
          Failed to load standups: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && standups.length === 0 && (
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-12 text-center">
          <Calendar className="mx-auto mb-4 text-text-muted" size={48} />
          <p className="text-text-secondary text-lg">No standups generated yet.</p>
          <p className="text-text-muted mt-2">Standups are automatically generated at the end of each business day.</p>
        </div>
      )}

      {!isLoading && !error && standups.length > 0 && (
        <div className="space-y-4">
          {standups.map((standup) => (
            <StandupCard key={standup.id} standup={standup} />
          ))}
        </div>
      )}
    </div>
  );
}
