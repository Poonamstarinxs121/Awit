interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div className={`animate-spin rounded-full border-2 border-border-default border-t-brand-accent ${sizeClasses[size]} ${className}`} />
  );
}
