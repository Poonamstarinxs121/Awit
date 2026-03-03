import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { apiGet } from '../api/client';

const COLORS = ['#FF3B30', '#FF9500', '#FFD60A', '#32D74B', '#0A84FF', '#BF5AF2', '#FF6482', '#14b8a6'];

const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'opus-4.6': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  'sonnet-4.5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'haiku-3.5': { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
  'gpt-4o': { input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 5 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cacheRead: 0.075, cacheWrite: 0.3 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4, cacheRead: 0.025, cacheWrite: 0.1 },
};

interface UsageRecord {
  date: string;
  tokens_in: number;
  tokens_out: number;
  api_calls: number;
  estimated_cost: number | string;
  provider?: string;
  model?: string;
}

interface AgentUsage {
  agent_id: string;
  agent_name: string | null;
  tokens_in: number;
  tokens_out: number;
  api_calls: number;
  estimated_cost: number | string;
}

type TimeRange = '7d' | '30d' | '90d';

export function CostsPage() {
  const [range, setRange] = useState<TimeRange>('30d');

  const { data: usageData, isLoading } = useQuery({
    queryKey: ['usage'],
    queryFn: () => apiGet<{ usage: UsageRecord[] }>('/v1/config/usage'),
  });

  const { data: agentUsageData } = useQuery({
    queryKey: ['usage-by-agent'],
    queryFn: () => apiGet<{ usage: AgentUsage[] }>('/v1/config/usage/by-agent'),
  });

  const usage = usageData?.usage ?? [];
  const agentUsage = agentUsageData?.usage ?? [];

  const filteredUsage = useMemo(() => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return usage
      .filter(r => new Date(r.date) >= cutoff)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [usage, range]);

  const dailyData = useMemo(() => {
    return filteredUsage.map(r => ({
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cost: Number(r.estimated_cost),
      tokens_in: r.tokens_in,
      tokens_out: r.tokens_out,
    }));
  }, [filteredUsage]);

  const totals = useMemo(() => {
    const totalCost = filteredUsage.reduce((s, r) => s + Number(r.estimated_cost), 0);
    const totalTokens = filteredUsage.reduce((s, r) => s + r.tokens_in + r.tokens_out, 0);

    const now = new Date();
    const todayCost = filteredUsage
      .filter(r => new Date(r.date).toDateString() === now.toDateString())
      .reduce((s, r) => s + Number(r.estimated_cost), 0);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayCost = filteredUsage
      .filter(r => new Date(r.date).toDateString() === yesterday.toDateString())
      .reduce((s, r) => s + Number(r.estimated_cost), 0);

    const currentMonth = now.getMonth();
    const monthCost = filteredUsage
      .filter(r => new Date(r.date).getMonth() === currentMonth)
      .reduce((s, r) => s + Number(r.estimated_cost), 0);

    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthCost = usage
      .filter(r => new Date(r.date).getMonth() === lastMonth.getMonth() && new Date(r.date).getFullYear() === lastMonth.getFullYear())
      .reduce((s, r) => s + Number(r.estimated_cost), 0);

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const projectedCost = dayOfMonth > 0 ? (monthCost / dayOfMonth) * daysInMonth : 0;

    const budget = 100;
    const budgetPct = budget > 0 ? (monthCost / budget) * 100 : 0;

    const todayPctChange = yesterdayCost > 0 ? ((todayCost - yesterdayCost) / yesterdayCost) * 100 : 0;
    const monthPctChange = lastMonthCost > 0 ? ((monthCost - lastMonthCost) / lastMonthCost) * 100 : 0;

    return {
      todayCost, yesterdayCost, monthCost, lastMonthCost, projectedCost,
      budget, budgetPct, todayPctChange, monthPctChange, totalCost, totalTokens,
    };
  }, [filteredUsage, usage]);

  const modelData = useMemo(() => {
    const byModel: Record<string, { tokens: number; cost: number }> = {};
    filteredUsage.forEach(r => {
      const model = r.model || r.provider || 'unknown';
      if (!byModel[model]) byModel[model] = { tokens: 0, cost: 0 };
      byModel[model].tokens += r.tokens_in + r.tokens_out;
      byModel[model].cost += Number(r.estimated_cost);
    });
    return Object.entries(byModel)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.cost - a.cost);
  }, [filteredUsage]);

  const agentChartData = useMemo(() => {
    return agentUsage
      .map(a => ({
        name: a.agent_name || 'Unknown',
        cost: Number(a.estimated_cost),
        tokens: a.tokens_in + a.tokens_out,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8);
  }, [agentUsage]);

  const tokenDailyData = useMemo(() => {
    return filteredUsage.map(r => ({
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      input: r.tokens_in,
      output: r.tokens_out,
    }));
  }, [filteredUsage]);

  const agentTotal = useMemo(() => agentUsage.reduce((s, a) => s + Number(a.estimated_cost), 0), [agentUsage]);

  const tooltipStyle = {
    backgroundColor: '#1A1A1A',
    border: '1px solid #2A2A2A',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '12px',
    padding: '8px 12px',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            Costs & Analytics
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Token usage and cost tracking across all agents</p>
        </div>

        <div style={{ display: 'flex', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {(['7d', '30d', '90d'] as TimeRange[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: range === r ? 600 : 400,
                color: range === r ? '#fff' : 'var(--text-muted)',
                backgroundColor: range === r ? 'var(--accent)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              {r === '7d' ? '7 days' : r === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Today" value={`$${totals.todayCost.toFixed(2)}`} sub={`vs $${totals.yesterdayCost.toFixed(2)} yesterday`} trend={totals.todayPctChange} />
        <StatCard label="This Month" value={`$${totals.monthCost.toFixed(2)}`} sub={`vs $${totals.lastMonthCost.toFixed(2)} last month`} trend={totals.monthPctChange} />
        <StatCard label="Projected (EOM)" value={`$${totals.projectedCost.toFixed(2)}`} sub="Based on current pace" />
        <BudgetCard pct={totals.budgetPct} current={totals.monthCost} budget={totals.budget} />
      </div>

      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading cost data...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <ChartCard title="Daily Cost Trend">
              {dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666' }} stroke="transparent" interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: '#666' }} stroke="transparent" tickFormatter={v => `$${v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Line type="monotone" dataKey="cost" name="Cost ($)" stroke="#14b8a6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Cost by Agent">
              {agentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={agentChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#666' }} stroke="transparent" tickFormatter={v => `$${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#999' }} stroke="transparent" width={80} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']} />
                    <Bar dataKey="cost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <ChartCard title="Cost by Model">
              {modelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={modelData} dataKey="cost" nameKey="name" cx="50%" cy="50%" outerRadius={75} strokeWidth={0}>
                      {modelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Token Usage (Daily)">
              {tokenDailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={tokenDailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666' }} stroke="transparent" interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: '#666' }} stroke="transparent" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="input" name="Input Tokens" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="output" name="Output Tokens" fill="#f97316" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>
          </div>

          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Model Pricing (per 1M tokens)</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Model', 'Input', 'Output', 'Cache Read', 'Cache Write'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: h === 'Model' ? 'left' : 'right', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(MODEL_PRICING).map(([model, pricing], i) => (
                  <tr key={model} style={{ borderBottom: i < Object.keys(MODEL_PRICING).length - 1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{model}</td>
                    <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>${pricing.input}</td>
                    <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>${pricing.output}</td>
                    <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>${pricing.cacheRead}</td>
                    <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>${pricing.cacheWrite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Detailed Breakdown by Agent</h3>
            </div>
            {agentUsage.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Agent', 'Tokens', 'Cost', '% of Total'].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: h === 'Agent' ? 'left' : 'right', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agentUsage.map((a, i) => {
                    const cost = Number(a.estimated_cost);
                    const pct = agentTotal > 0 ? (cost / agentTotal) * 100 : 0;
                    return (
                      <tr key={a.agent_id} style={{ borderBottom: i < agentUsage.length - 1 ? '1px solid var(--border)' : 'none' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '12px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length] }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{a.agent_name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{(a.tokens_in + a.tokens_out).toLocaleString()}</td>
                        <td style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 600, color: '#32D74B', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>${cost.toFixed(4)}</td>
                        <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            <div style={{ width: '60px', height: '4px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', backgroundColor: COLORS[i % COLORS.length], borderRadius: '2px' }} />
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: '40px' }}>{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No agent usage data available yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, trend }: { label: string; value: string; sub: string; trend?: number }) {
  return (
    <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
      <p style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-1px' }}>{value}</p>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</p>
    </div>
  );
}

function TrendBadge({ value }: { value: number }) {
  if (!isFinite(value) || isNaN(value) || value === 0) return null;
  const isUp = value > 0;
  const color = isUp ? '#FF453A' : '#32D74B';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '12px', fontWeight: 600, color }}>
      {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {`${value >= 0 ? '+' : ''}${value.toFixed(0)}%`}
    </span>
  );
}

function BudgetCard({ pct, current, budget }: { pct: number; current: number; budget: number }) {
  const displayPct = isFinite(pct) ? Math.round(pct) : 0;
  const barColor = displayPct < 50 ? '#32D74B' : displayPct < 80 ? '#FFD60A' : '#FF453A';
  return (
    <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Budget</span>
      <p style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, color: barColor, letterSpacing: '-1px', marginTop: '8px' }}>{displayPct}%</p>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>${current.toFixed(2)} / ${budget.toFixed(2)}</p>
      <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(displayPct, 100)}%`, height: '100%', backgroundColor: barColor, borderRadius: '2px', transition: 'width 300ms' }} />
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {children}
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <AlertCircle size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No data for this period</p>
      </div>
    </div>
  );
}
