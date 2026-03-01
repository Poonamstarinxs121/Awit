import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PublicNav } from '../components/PublicNav';

export function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function fillDemoCredentials() {
    setEmail('admin@squidjob.com');
    setPassword('admin123');
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <PublicNav actionLabel="Member login" actionTo="/login" />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-text-primary">Admin Portal</h1>
            <p className="text-text-secondary mt-2">SaaS administration access</p>
          </div>

          <div className="bg-white border border-border-default rounded-xl p-8 shadow-sm">
            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Email</label>
                <input
                  type="email"
                  placeholder="admin@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-surface-light border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Password</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-surface-light border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-accent hover:bg-brand-accent-hover text-white font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div
              className="mt-6 bg-surface-light border border-border-default rounded-lg p-3 cursor-pointer hover:border-brand-accent transition text-left"
              onClick={fillDemoCredentials}
            >
              <p className="text-sm font-medium text-text-primary">Admin Demo</p>
              <p className="text-xs text-text-secondary mt-1">admin@squidjob.com / admin123</p>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Are you a member?{' '}
            <Link to="/login" className="text-purple-accent hover:underline font-medium">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
