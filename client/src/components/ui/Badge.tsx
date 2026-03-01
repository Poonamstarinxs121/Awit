import type { ReactNode } from 'react';

interface BadgeProps {
  variant?: 'active' | 'idle' | 'error' | 'warning' | 'info' | 'default';
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  idle: 'bg-gray-50 text-gray-600 border-gray-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  default: 'bg-gray-50 text-gray-600 border-gray-200',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
