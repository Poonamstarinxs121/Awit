import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, BarChart3, AlertCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatsCard } from '../components/ui/StatsCard';
import { apiGet } from '../api/client';

const COLORS = ['#FF3B30', '#FF9500', '#FFD60A', '#32D74B', '#0A84FF', '#BF5AF2'];

interface UsageData {
  providers: Array<{
    provider: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost: number;
  }>;
  total_tokens: number;
  total_cost: number;
}

export function CostsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['usage'],
    queryFn: () => apiGet<UsageData>('/v1/config/usage'),
  });

  const providers = data?.providers || [];
  const totalTokens = data?.total_tokens || 0;
  const totalCost = data?.total_cost || 0;

  const pieData = providers.map(p => ({
    name: p.provider,
    value: p.total_tokens,
  })).filter(p => p.value > 0);

  const barData = providers.map(p => ({
    name: p.provider,
    input: p.input_tokens,
    output: p.output_tokens,
  })).filter(p => p.input + p.output > 0);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
          Costs & Usage
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Token usage and estimated costs across LLM providers</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatsCard title="Total Tokens" value={totalTokens > 1000000 ? `${(totalTokens / 1000000).toFixed(2)}M` : totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : totalTokens} icon={<TrendingUp size={18} />} iconColor="var(--info)" />
        <StatsCard title="Est. Total Cost" value={`$${totalCost.toFixed(4)}`} icon={<DollarSign size={18} />} iconColor="var(--positive)" />
        <StatsCard title="Providers Used" value={providers.filter(p => p.total_tokens > 0).length} icon={<BarChart3 size={18} />} iconColor="var(--accent)" />
      </div>

      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading usage data...</div>
      ) : providers.length === 0 ? (
        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '60px', textAlign: 'center' }}>
          <AlertCircle size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>No usage data yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Token usage will appear here after agents start processing messages.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <SectionHeader title="Tokens by Provider" />
            <div style={{ padding: '20px' }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} stroke="var(--border)" />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} stroke="var(--border)" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px' }} />
                  <Bar dataKey="input" name="Input" fill="var(--info)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="output" name="Output" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <SectionHeader title="Token Distribution" />
            <div style={{ padding: '20px' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} strokeWidth={0}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px' }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', color: 'var(--text-secondary)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {providers.length > 0 && (
        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <SectionHeader title="Provider Breakdown" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Provider', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Est. Cost'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.map((p, i) => (
                <tr key={p.provider} style={{ borderBottom: i < providers.length - 1 ? '1px solid var(--border)' : 'none' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{p.provider}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{p.input_tokens.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{p.output_tokens.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--info)', fontFamily: 'var(--font-mono)' }}>{p.total_tokens.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--positive)', fontFamily: 'var(--font-mono)' }}>${p.estimated_cost.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
