import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ title, children, className = '', padding = true }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-border-default shadow-sm ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-border-default">
          <h3 className="text-text-primary font-semibold">{title}</h3>
        </div>
      )}
      <div className={padding ? 'p-6' : ''}>{children}</div>
    </div>
  );
}
