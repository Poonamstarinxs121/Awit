import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart, Clock, RefreshCw } from 'lucide-react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatsCard } from '../components/ui/StatsCard';
import { apiGet } from '../api/client';

interface Standup {
  id: string;
  content: string;
  date: string;
  agent_id?: string;
  delivered_at?: string;
  delivery_channels?: string[];
}

export function ReportsPage() {
  const [selected, setSelected] = useState<Standup | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['standups-reports'],
    queryFn: () => apiGet<{ standups: Standup[] }>('/v1/standups'),
    retry: false,
  });

  const standups = data?.standups || [];

  const formatDate = (s: string) => {
    try { return new Date(s).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); } catch { return s; }
  };

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Reports</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Daily standups and agent reports</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>
          <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatsCard title="Total Reports" value={standups.length} icon={<FileBarChart size={18} />} iconColor="var(--info)" />
        <StatsCard title="Latest Report" value={standups[0] ? formatDate(standups[0].date).split(',')[0] : '–'} icon={<Clock size={18} />} iconColor="var(--positive)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: '16px' }}>
        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <SectionHeader title="Daily Standups" />
          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : standups.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <FileBarChart size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p>No standups generated yet</p>
            </div>
          ) : (
            standups.map((standup, i) => (
              <div
                key={standup.id}
                onClick={() => setSelected(selected?.id === standup.id ? null : standup)}
                style={{ padding: '14px 20px', borderBottom: i < standups.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background-color 150ms', backgroundColor: selected?.id === standup.id ? 'var(--surface-hover)' : 'transparent' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = selected?.id === standup.id ? 'var(--surface-hover)' : 'transparent'; }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{formatDate(standup.date)}</div>
                <div className="line-clamp-2" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{standup.content?.slice(0, 120)}...</div>
                {standup.delivery_channels && standup.delivery_channels.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {standup.delivery_channels.map(ch => (
                      <span key={ch} style={{ padding: '1px 6px', borderRadius: '3px', fontSize: '10px', backgroundColor: 'var(--info-soft)', color: 'var(--info)', fontWeight: 500 }}>{ch}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {selected && (
          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', alignSelf: 'start', maxHeight: '600px', overflowY: 'auto' }}>
            <SectionHeader title={formatDate(selected.date)} rightAction={<button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>×</button>} />
            <div style={{ padding: '20px' }}>
              <pre style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selected.content}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
