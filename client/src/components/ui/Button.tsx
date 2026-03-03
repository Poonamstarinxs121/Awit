import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyle: Record<string, React.CSSProperties> = {
    primary: { backgroundColor: 'var(--accent)', color: 'white' },
    secondary: { backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
    danger: { backgroundColor: 'var(--negative)', color: 'white' },
    ghost: { backgroundColor: 'transparent', color: 'var(--text-secondary)' },
  };

  const sizeClasses: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  return (
    <button
      className={`${base} ${sizeClasses[size]} ${className}`}
      style={variantStyle[variant]}
      onMouseEnter={(e) => {
        if (variant === 'primary') e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
        if (variant === 'secondary') e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
        if (variant === 'ghost') e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (variantStyle[variant]) {
          Object.assign(e.currentTarget.style, variantStyle[variant]);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}
