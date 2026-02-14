import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ title, children, className = '', padding = true }: CardProps) {
  return (
    <div className={`bg-surface rounded-xl border border-gray-800 ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">{title}</h3>
        </div>
      )}
      <div className={padding ? 'p-6' : ''}>{children}</div>
    </div>
  );
}
