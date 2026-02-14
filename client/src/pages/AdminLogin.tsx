import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

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
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            <span className="text-brand-accent">Squid</span>Job
          </h1>
          <p className="text-gray-500 mt-1">Admin Portal</p>
        </div>

        <div className="bg-surface border border-gray-800 rounded-xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">SaaS Admin Login</h2>

          {error && (
            <div className="mb-4 px-4 py-3 bg-danger/10 border border-danger/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="admin@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-accent hover:underline">
              Create one
            </Link>
          </p>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-surface text-gray-500">Demo Credentials</span>
              </div>
            </div>

            <div
              className="mt-4 bg-[#0F172A] border border-[#1E293B] rounded-lg p-3 cursor-pointer hover:border-blue-500 transition"
              onClick={fillDemoCredentials}
            >
              <p className="text-sm font-medium text-white">Admin Account</p>
              <p className="text-xs text-gray-400 mt-1">Email: admin@squidjob.com</p>
              <p className="text-xs text-gray-400">Password: admin123</p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Are you a member?{' '}
          <Link to="/login" className="text-brand-accent hover:underline">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
