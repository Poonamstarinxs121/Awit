import { GitBranch } from 'lucide-react';

export function GitPage() {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Git</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Git repository integration</p>
      </div>

      <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '80px', textAlign: 'center' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '12px', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <GitBranch size={28} style={{ color: 'var(--text-muted)' }} />
        </div>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Git integration not configured
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
          Git repository management is not available in this version of SquidJob. Agents can interact with Git repos via SSH machine commands from the Terminal page.
        </p>
      </div>
    </div>
  );
}
