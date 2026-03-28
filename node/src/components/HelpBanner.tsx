'use client';

import { useState, useEffect } from 'react';
import { Info, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface HelpBannerProps {
  pageKey: string;
  title: string;
  description: string;
  tips?: string[];
}

export default function HelpBanner({ pageKey, title, description, tips }: HelpBannerProps) {
  const storageKey = `squidjob-help-collapsed-${pageKey}`;
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'true') setCollapsed(true);
    } catch {}
  }, [storageKey]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {}
  }

  if (!mounted) return null;

  if (collapsed) {
    return (
      <button
        onClick={toggle}
        title={`Show help: ${title}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 20,
          color: 'var(--text-muted)',
          fontSize: 12,
          cursor: 'pointer',
          marginBottom: 16,
        }}
      >
        <HelpCircle size={13} />
        <span>Show help</span>
      </button>
    );
  }

  return (
    <div style={{
      background: 'rgba(59, 130, 246, 0.06)',
      border: '1px solid rgba(59, 130, 246, 0.2)',
      borderRadius: 10,
      padding: '14px 16px',
      marginBottom: 20,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Info size={16} style={{ color: '#3B82F6', flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {description}
          </div>
          {tips && tips.length > 0 && (
            <ul style={{
              margin: '8px 0 0',
              paddingLeft: 16,
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
            }}>
              {tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={toggle}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
          title="Collapse help"
        >
          <ChevronUp size={14} />
        </button>
      </div>
    </div>
  );
}
