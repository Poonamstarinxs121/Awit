import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatsCard({ title, value, icon, iconColor = 'var(--info)', trend }: StatsCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          {title}
        </span>
        <div style={{ color: iconColor }}>
          {icon}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <span
          style={{
            fontSize: '28px',
            fontWeight: 700,
            fontFamily: 'var(--font-heading)',
            color: 'var(--text-primary)',
            letterSpacing: '-1px',
            lineHeight: 1,
          }}
        >
          {value}
        </span>

        {trend && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: trend.isPositive ? 'var(--positive)' : 'var(--negative)',
              backgroundColor: trend.isPositive ? 'var(--positive-soft)' : 'var(--negative-soft)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}
