import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Clock, Target } from 'lucide-react';
import { StatsCard } from '../components/ui/StatsCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ActivityLineChart } from '../components/charts/ActivityLineChart';
import { ActivityPieChart } from '../components/charts/ActivityPieChart';
import { HourlyHeatmap } from '../components/charts/HourlyHeatmap';
import { SuccessRateGauge } from '../components/charts/SuccessRateGauge';
import { apiGet } from '../api/client';

interface AnalyticsData {
  total: number;
  today: number;
  successRate: number;
  byType: { type: string; count: number }[];
  byDay: { date: string; count: number }[];
  byHour: { hour: number; day: number; count: number }[];
}

export function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => apiGet<AnalyticsData>('/v1/activity/stats'),
    refetchInterval: 60000,
  });

  const avgPerDay = data && data.byDay.length > 0
    ? Math.round(data.byDay.reduce((s, d) => s + d.count, 0) / data.byDay.length)
    : 0;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Analytics</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Activity patterns and performance metrics</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatsCard title="Total Events" value={(data?.total || 0).toLocaleString()} icon={<BarChart3 size={18} />} iconColor="var(--info)" />
        <StatsCard title="Today" value={(data?.today || 0).toLocaleString()} icon={<TrendingUp size={18} />} iconColor="var(--accent)" />
        <StatsCard title="Avg / Day" value={avgPerDay} icon={<Clock size={18} />} iconColor="var(--positive)" />
        <StatsCard title="Success Rate" value={`${data?.successRate || 0}%`} icon={<Target size={18} />} iconColor={data && data.successRate >= 80 ? 'var(--positive)' : 'var(--warning)'} />
      </div>

      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading analytics...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <SectionHeader title="Activity Over Time (30 days)" />
              <div style={{ padding: '20px' }}>
                <ActivityLineChart data={data?.byDay || []} />
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <SectionHeader title="Activity by Type" />
              <div style={{ padding: '20px' }}>
                <ActivityPieChart data={data?.byType || []} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <SectionHeader title="Hourly Activity Heatmap" subtitle="Activity density by hour of day and day of week" />
              <div style={{ padding: '20px' }}>
                <HourlyHeatmap data={data?.byHour || []} />
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <SectionHeader title="Success Rate" />
              <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
                <SuccessRateGauge value={data?.successRate || 0} />
              </div>
              <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(data?.byType || []).slice(0, 5).map(t => (
                  <div key={t.type} className="flex items-center justify-between">
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{t.type}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{t.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
