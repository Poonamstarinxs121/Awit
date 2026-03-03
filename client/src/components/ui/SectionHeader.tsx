import { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  rightAction?: ReactNode;
  subtitle?: string;
}

export function SectionHeader({ title, rightAction, subtitle }: SectionHeaderProps) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3">
        <div
          style={{
            width: '3px',
            height: '18px',
            backgroundColor: 'var(--accent)',
            borderRadius: '2px',
            flexShrink: 0,
          }}
        />
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.3px',
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {rightAction && (
        <div style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 500 }}>
          {rightAction}
        </div>
      )}
    </div>
  );
}
