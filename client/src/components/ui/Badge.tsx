import type { ReactNode } from 'react';

interface BadgeProps {
  variant?: 'active' | 'idle' | 'error' | 'warning' | 'info' | 'default';
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<string, string> = {
  active: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  idle: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  default: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
