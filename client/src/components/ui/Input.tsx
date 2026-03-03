import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block' }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none ${className}`}
        style={{
          backgroundColor: 'var(--surface-elevated)',
          border: `1px solid ${error ? 'var(--negative)' : 'var(--border)'}`,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-body)',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
        onBlur={(e) => { e.target.style.borderColor = error ? 'var(--negative)' : 'var(--border)'; }}
        {...props}
      />
      {error && (
        <p style={{ fontSize: '12px', color: 'var(--negative)' }}>{error}</p>
      )}
    </div>
  );
}
