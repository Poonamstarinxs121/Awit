import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Server, Cpu, Coins } from 'lucide-react';
import { StatsCard } from '../components/ui/StatsCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { apiGet } from '../api/client';

interface FleetCostsData {
  total_cost: number;
  hub_cost: number;
  node_cost: number;
  total_tokens_in: number;
  total_tokens_out: number;
  by_model: { model: string; cost: string; tokens: string }[];
  by_agent: { agent_id: string; agent_name: string; cost: string; tokens: string }[];
  by_node: { node_id: string; node_name: string; cost: string; tokens_in: string; tokens_out: string }[];
  daily_trend: { date: string; cost: string; tokens: string }[];
  range: number;
}

const RANGE_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

const NODE_COLORS = [
  '#FF3B30', '#007AFF', '#30D158', '#FF9F0A', '#BF5AF2',
  '#64D2FF', '#FFD60A', '#FF6482', '#AC8E68', '#30B0C7',
];

function formatCost(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toFixed(4)}`;
  return '$0.00';
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function DailyTrendChart({ data }: { data: { date: string; cost: string }[] }) {
  if (!data || data.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No daily data available</div>;
  }

  const values = data.map(d => parseFloat(d.cost || '0'));
  const maxVal = Math.max(...values, 0.01);
  const width = 600;
  const height = 200;
  const padX = 40;
  const padY = 20;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const points = values.map((v, i) => {
    const x = padX + (i / Math.max(values.length - 1, 1)) * chartW;
    const y = padY + chartH - (v / maxVal) * chartH;
    return `${x},${y}`;
  });

  const areaPoints = [
    `${padX},${padY + chartH}`,
    ...points,
    `${padX + chartW},${padY + chartH}`,
  ].join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = padY + chartH - frac * chartH;
        return (
          <g key={frac}>
            <line x1={padX} y1={y} x2={padX + chartW} y2={y} stroke="var(--border)" strokeWidth="0.5" />
            <text x={padX - 6} y={y + 3} textAnchor="end" fill="var(--text-muted)" fontSize="8" fontFamily="var(--font-mono)">
              {formatCost(maxVal * frac)}
            </text>
          </g>
        );
      })}
      <polygon points={areaPoints} fill="var(--accent)" opacity="0.08" />
      <polyline points={points.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => {
        const x = padX + (i / Math.max(values.length - 1, 1)) * chartW;
        const y = padY + chartH - (v / maxVal) * chartH;
        return <circle key={i} cx={x} cy={y} r="2.5" fill="var(--accent)" />;
      })}
      {data.length > 1 && (
        <>
          <text x={padX} y={height - 2} textAnchor="start" fill="var(--text-muted)" fontSize="8" fontFamily="var(--font-mono)">
            {data[0].date.slice(5)}
          </text>
          <text x={padX + chartW} y={height - 2} textAnchor="end" fill="var(--text-muted)" fontSize="8" fontFamily="var(--font-mono)">
            {data[data.length - 1].date.slice(5)}
          </text>
        </>
      )}
    </svg>
  );
}

function CostByModelPie({ data }: { data: { model: string; cost: string }[] }) {
  if (!data || data.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No model data</div>;
  }

  const total = data.reduce((s, d) => s + parseFloat(d.cost || '0'), 0);
  if (total === 0) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No costs recorded</div>;
  }

  const colors = ['#FF3B30', '#007AFF', '#30D158', '#FF9F0A', '#BF5AF2', '#64D2FF', '#FFD60A'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden' }}>
        {data.map((d, i) => {
          const pct = (parseFloat(d.cost || '0') / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div key={d.model} style={{
              width: `${pct}%`,
              backgroundColor: colors[i % colors.length],
              transition: 'width 300ms',
            }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {data.map((d, i) => {
          const cost = parseFloat(d.cost || '0');
          const pct = ((cost / total) * 100).toFixed(1);
          return (
            <div key={d.model} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: colors[i % colors.length], flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{d.model || 'unknown'}</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatCost(cost)}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FleetAnalyticsPage() {
  const [range, setRange] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ['fleet-analytics-costs', range],
    queryFn: () => apiGet<FleetCostsData>(`/v1/fleet/analytics/costs?range=${range}`),
    refetchInterval: 60000,
  });

  const totalTokens = (data?.total_tokens_in || 0) + (data?.total_tokens_out || 0);

  const maxNodeCost = data?.by_node
    ? Math.max(...data.by_node.map(n => parseFloat(n.cost || '0')), 0.01)
    : 1;

  const RangeSelector = (
    <div style={{ display: 'flex', gap: '4px' }}>
      {RANGE_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => setRange(opt.value)}
          style={{
            padding: '4px 12px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: range === opt.value ? 600 : 400,
            backgroundColor: range === opt.value ? 'var(--accent-soft)' : 'transparent',
            color: range === opt.value ? 'var(--accent)' : 'var(--text-muted)',
            transition: 'all 150ms',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Fleet Analytics</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Aggregated cost and usage across all nodes</p>
        </div>
        {RangeSelector}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatsCard title="Fleet Total Cost" value={formatCost(data?.total_cost || 0)} icon={<DollarSign size={18} />} iconColor="var(--accent)" />
        <StatsCard title="Hub Cost" value={formatCost(data?.hub_cost || 0)} icon={<Server size={18} />} iconColor="var(--info)" />
        <StatsCard title="Node Cost" value={formatCost(data?.node_cost || 0)} icon={<Cpu size={18} />} iconColor="var(--positive)" />
        <StatsCard title="Total Tokens" value={formatTokens(totalTokens)} icon={<Coins size={18} />} iconColor="var(--warning)" />
      </div>

      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading fleet analytics...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <SectionHeader title="Cost by Node" />
              <div style={{ padding: '20px' }}>
                {(!data?.by_node || data.by_node.length === 0) ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No nodes registered</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {data.by_node.map((node, i) => {
                      const cost = parseFloat(node.cost || '0');
                      const pct = (cost / maxNodeCost) * 100;
                      const color = NODE_COLORS[i % NODE_COLORS.length];
                      return (
                        <div key={node.node_id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{node.node_name || 'Unknown Node'}</span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatCost(cost)}</span>
                          </div>
                          <div style={{ height: '8px', backgroundColor: 'var(--surface-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.max(pct, 1)}%`, backgroundColor: color, borderRadius: '4px', transition: 'width 300ms' }} />
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {formatTokens(parseInt(node.tokens_in || '0') + parseInt(node.tokens_out || '0'))} tokens
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <SectionHeader title="Cost by Model" />
              <div style={{ padding: '20px' }}>
                <CostByModelPie data={data?.by_model || []} />
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <SectionHeader title={`Daily Cost Trend (${range} days)`} />
            <div style={{ padding: '20px' }}>
              <DailyTrendChart data={data?.daily_trend || []} />
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <SectionHeader title="Top Agents by Cost" subtitle="Cross-node agent cost breakdown" />
            <div style={{ padding: '0' }}>
              {(!data?.by_agent || data.by_agent.length === 0) ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No agent cost data</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agent</th>
                      <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cost</th>
                      <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tokens</th>
                      <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_agent.slice(0, 15).map((agent) => {
                      const cost = parseFloat(agent.cost || '0');
                      const share = data.total_cost > 0 ? ((cost / data.total_cost) * 100).toFixed(1) : '0';
                      return (
                        <tr key={agent.agent_id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)', flexShrink: 0 }} />
                              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{agent.agent_name || 'Unknown Agent'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatCost(cost)}</td>
                          <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{formatTokens(parseInt(agent.tokens || '0'))}</td>
                          <td style={{ padding: '10px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                              <div style={{ width: '60px', height: '6px', backgroundColor: 'var(--surface-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${share}%`, backgroundColor: 'var(--accent)', borderRadius: '3px' }} />
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: '36px', textAlign: 'right' }}>{share}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
