import { ReactNode } from 'react';

interface MetricCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  color?: string;
}

export function MetricCard({ icon, value, label, color = 'var(--accent)' }: MetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: '20px',
            fontWeight: 700,
            fontFamily: 'var(--font-heading)',
            color: 'var(--text-primary)',
            letterSpacing: '-0.5px',
            lineHeight: 1.2,
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {label}
        </div>
      </div>
    </div>
  );
}
