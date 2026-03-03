import type { ReactNode } from 'react';

interface BadgeProps {
  variant?: 'active' | 'idle' | 'error' | 'warning' | 'info' | 'default' | 'success' | 'danger' | 'purple';
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<string, React.CSSProperties> = {
  active: { backgroundColor: 'var(--positive-soft)', color: 'var(--positive)' },
  success: { backgroundColor: 'var(--positive-soft)', color: 'var(--positive)' },
  idle: { backgroundColor: 'var(--surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
  default: { backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
  error: { backgroundColor: 'var(--negative-soft)', color: 'var(--negative)' },
  danger: { backgroundColor: 'var(--negative-soft)', color: 'var(--negative)' },
  warning: { backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' },
  info: { backgroundColor: 'var(--info-soft)', color: 'var(--info)' },
  purple: { backgroundColor: 'rgba(191, 90, 242, 0.15)', color: '#BF5AF2' },
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${className}`}
      style={variantStyles[variant]}
    >
      {children}
    </span>
  );
}
