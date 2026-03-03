import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, ChevronDown, ChevronRight, CheckCircle, Clock,
  AlertTriangle, Mail, MessageSquare, Send, Zap, BarChart3
} from 'lucide-react';
import { apiGet } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import type { Standup } from '../types';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

interface AgentSummary {
  agent_name?: string;
  completed?: string[];
  in_progress?: string[];
  blockers?: string[];
}

function StandupCard({ standup, isLatest }: { standup: Standup; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(isLatest);
  const agentSummaries = (standup.per_agent_summaries || []) as AgentSummary[];
  const completedCount = agentSummaries.reduce((sum, a) => sum + (a.completed?.length || 0), 0);
  const inProgressCount = agentSummaries.reduce((sum, a) => sum + (a.in_progress?.length || 0), 0);
  const blockerCount = agentSummaries.reduce((sum, a) => sum + (a.blockers?.length || 0), 0);

  return (
    <div style={{
      backgroundColor: 'var(--card)', borderRadius: '12px',
      border: `1px solid ${isLatest ? 'rgba(255,59,48,0.2)' : 'var(--border)'}`,
      overflow: 'hidden', transition: 'border-color 200ms',
    }}>
      <div style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: isLatest ? 'var(--accent-soft)' : 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={16} style={{ color: isLatest ? 'var(--accent)' : 'var(--text-muted)' }} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatDate(standup.date)}
              </h3>
              {isLatest && (
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Latest</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {completedCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#32D74B', fontWeight: 500 }}>
                <CheckCircle size={12} /> {completedCount}
              </span>
            )}
            {inProgressCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#60A5FA', fontWeight: 500 }}>
                <Clock size={12} /> {inProgressCount}
              </span>
            )}
            {blockerCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#FF453A', fontWeight: 500 }}>
                <AlertTriangle size={12} /> {blockerCount}
              </span>
            )}
          </div>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '10px' }}>
          {standup.summary}
        </p>

        {standup.delivered_to && standup.delivered_to.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <Send size={11} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: '2px' }}>Delivered:</span>
            {standup.delivered_to.map((channel: string) => {
              const cl = channel.toLowerCase();
              const isEmail = cl.includes('email');
              const isTelegram = cl.includes('telegram');
              const isSlack = cl.includes('slack');
              const bg = isEmail ? 'rgba(59,130,246,0.12)' : isTelegram ? 'rgba(10,132,255,0.12)' : isSlack ? 'rgba(224,30,90,0.1)' : 'rgba(100,100,100,0.1)';
              const color = isEmail ? '#60A5FA' : isTelegram ? '#0A84FF' : isSlack ? '#E01E5A' : 'var(--text-muted)';
              const ChannelIcon = isEmail ? Mail : MessageSquare;
              return (
                <span key={channel} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', backgroundColor: bg, color, fontSize: '10px', fontWeight: 600, border: `1px solid ${color}30` }}>
                  <ChannelIcon size={9} /> {channel}
                </span>
              );
            })}
          </div>
        )}

        {agentSummaries.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {agentSummaries.length} agent {agentSummaries.length === 1 ? 'report' : 'reports'}
          </button>
        )}
      </div>

      {expanded && agentSummaries.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {agentSummaries.map((as, idx) => (
            <div key={idx} style={{ backgroundColor: 'var(--surface-elevated)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>{as.agent_name || `Agent ${idx + 1}`}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {as.completed && as.completed.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#32D74B', fontWeight: 600, marginBottom: '4px' }}>
                      <CheckCircle size={11} /> Completed
                    </div>
                    <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {as.completed.map((item, i) => <li key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {as.in_progress && as.in_progress.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#60A5FA', fontWeight: 600, marginBottom: '4px' }}>
                      <Clock size={11} /> In Progress
                    </div>
                    <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {as.in_progress.map((item, i) => <li key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {as.blockers && as.blockers.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#FF453A', fontWeight: 600, marginBottom: '4px' }}>
                      <AlertTriangle size={11} /> Blockers
                    </div>
                    <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {as.blockers.map((item, i) => <li key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</li>)}
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
  const totalAgentReports = standups.reduce((sum, s) => sum + ((s.per_agent_summaries as AgentSummary[]) || []).length, 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Daily Standups</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Automated agent activity summaries delivered to your channels</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Standups', value: standups.length, icon: Calendar, color: '#FF9F0A' },
          { label: 'Agent Reports', value: totalAgentReports, icon: BarChart3, color: '#60A5FA' },
          { label: 'This Week', value: standups.filter(s => { const d = new Date(s.date); const now = new Date(); const weekAgo = new Date(now.getTime() - 7 * 86400000); return d >= weekAgo; }).length, icon: Zap, color: '#32D74B' },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <s.icon size={13} style={{ color: s.color }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</span>
            </div>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><Spinner /></div>
      )}

      {error && (
        <div style={{ padding: '14px 18px', borderRadius: '10px', backgroundColor: 'rgba(255,69,58,0.06)', border: '1px solid rgba(255,69,58,0.2)', fontSize: '13px', color: '#FF453A' }}>
          Failed to load standups: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && standups.length === 0 && (
        <div style={{ backgroundColor: 'var(--card)', border: '1px dashed var(--border)', borderRadius: '14px', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Calendar size={26} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          </div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>No standups generated yet</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto', lineHeight: 1.6 }}>
            Standups are automatically generated at the end of each business day, summarising what your agents accomplished, what they're working on, and any blockers they've encountered.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '20px' }}>
            {['Configure delivery channels in Settings', 'Agents generate reports automatically', 'Delivered to email, Slack, or Telegram'].map((tip, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--accent)', flexShrink: 0 }} />
                {tip}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && !error && standups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {standups.map((standup, i) => (
            <StandupCard key={standup.id} standup={standup} isLatest={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
