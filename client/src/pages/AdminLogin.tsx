import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const colors = {
  purple: '#7C3AED',
  purpleDark: '#6D28D9',
  offwhite: '#FFF8F0',
  white: '#FFFFFF',
  textDark: '#1F1218',
  textMuted: '#6B5B6E',
  border: 'rgba(124, 58, 237, 0.15)',
  inputBg: 'rgba(124, 58, 237, 0.04)',
  red: '#FF3B30',
};

const fonts = {
  heading: "'Sora', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
};

export function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 16px',
    backgroundColor: colors.inputBg,
    border: `1px solid ${colors.border}`,
    borderRadius: '10px',
    color: colors.textDark,
    fontSize: '14px',
    outline: 'none',
    fontFamily: fonts.body,
    boxSizing: 'border-box',
    transition: 'border-color 200ms, box-shadow 200ms',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.offwhite, fontFamily: fonts.body, display: 'flex', flexDirection: 'column' }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        backgroundColor: 'rgba(255, 248, 240, 0.92)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${colors.border}`,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <span style={{ fontSize: 28 }}>🦑</span>
            <span style={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: 20, color: colors.purpleDark, letterSpacing: '-0.02em' }}>SquidJob</span>
          </Link>
          <Link to="/login" style={{ padding: '8px 20px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: 'transparent', color: colors.purpleDark, textDecoration: 'none', fontSize: '14px', fontWeight: 600, fontFamily: fonts.body }}>
            Member Login
          </Link>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: 'rgba(124, 58, 237, 0.08)', border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '28px' }}>
              🛡️
            </div>
            <h1 style={{ fontFamily: fonts.heading, fontSize: '26px', fontWeight: 800, color: colors.textDark, marginBottom: '8px', letterSpacing: '-0.02em' }}>
              Admin Console
            </h1>
            <p style={{ color: colors.textMuted, fontSize: '15px' }}>SaaS platform administration</p>
          </div>

          <div style={{ backgroundColor: colors.white, border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '32px', boxShadow: '0 4px 24px rgba(124, 58, 237, 0.06)' }}>
            {error && (
              <div style={{ marginBottom: '18px', padding: '12px 14px', backgroundColor: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: '10px', color: colors.red, fontSize: '13px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: colors.textMuted, marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Admin Email
                </label>
                <input
                  type="email"
                  placeholder="admin@squidjob.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = colors.purple; e.target.style.boxShadow = `0 0 0 3px rgba(124,58,237,0.1)`; }}
                  onBlur={(e) => { e.target.style.borderColor = colors.border; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: colors.textMuted, marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = colors.purple; e.target.style.boxShadow = `0 0 0 3px rgba(124,58,237,0.1)`; }}
                  onBlur={(e) => { e.target.style.borderColor = colors.border; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '13px', backgroundColor: colors.purple, border: 'none', borderRadius: '10px',
                  color: colors.white, fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1, fontFamily: fonts.body, transition: 'opacity 150ms, transform 100ms',
                  marginTop: '4px',
                }}
                onMouseDown={(e) => { if (!loading) (e.currentTarget.style.transform = 'scale(0.98)'); }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: `1px solid ${colors.border}`, textAlign: 'center' }}>
              <button
                onClick={() => setShowDemo(!showDemo)}
                style={{ fontSize: '12px', color: colors.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: fonts.body, transition: 'color 150ms' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = colors.purple; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = colors.textMuted; }}
              >
                {showDemo ? 'Hide demo credentials' : 'Show demo credentials'}
              </button>
              {showDemo && (
                <div
                  onClick={() => { setEmail('admin@squidjob.com'); setPassword('admin123'); }}
                  style={{
                    marginTop: '10px', backgroundColor: colors.inputBg, border: `1px solid ${colors.border}`,
                    borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 200ms',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = colors.purple; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = colors.border; }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textDark, marginBottom: '3px' }}>Super Admin</div>
                  <div style={{ fontSize: '11px', color: colors.textMuted, fontFamily: fonts.mono }}>admin@squidjob.com / admin123</div>
                </div>
              )}
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: colors.textMuted }}>
            <Link to="/login" style={{ color: colors.textMuted, textDecoration: 'none', transition: 'color 150ms' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = colors.purple; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = colors.textMuted; }}>
              ← Back to Member Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
