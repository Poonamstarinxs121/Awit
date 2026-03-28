'use client';

import { useEffect, useState, useCallback } from 'react';
import { DollarSign, Coins, Zap, TrendingUp, Calendar } from 'lucide-react';
import HelpBanner from '@/components/HelpBanner';

interface CostSummary {
  total_cost: number;
  total_tokens_in: number;
  total_tokens_out: number;
  by_agent: { agent_id: string; agent_name: string; total_cost: number; total_tokens_in: number; total_tokens_out: number; record_count: number }[];
  by_model: { model: string; total_cost: number; total_tokens_in: number; total_tokens_out: number; record_count: number }[];
}

interface DailyRecord {
  date: string;
  total_cost: number;
  total_tokens_in: number;
  total_tokens_out: number;
  record_count: number;
}

type TimeRange = '7' | '30' | '90' | 'all';

const RANGES: { value: TimeRange; label: string }[] = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: 'all', label: 'All' },
];

function formatCost(v: number): string {
  return `$${v.toFixed(4)}`;
}

function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function Sparkline({ data, width = 280, height = 40 }: { data: number[]; width?: number; height?: number }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 0.0001);
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((v, i) => `${i * stepX},${height - (v / max) * (height - 4)}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HorizontalBar({ label, value, maxValue, color, subtitle }: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  subtitle?: string;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          {formatCost(value)}
          {subtitle && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{subtitle}</span>}
        </span>
      </div>
      <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 3,
          background: color,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

const STAT_CARDS = [
  { key: 'total', label: 'Total Cost', icon: DollarSign, color: '#8B5CF6' },
  { key: 'today', label: "Today's Cost", icon: Calendar, color: '#22C55E' },
  { key: 'tokens', label: 'Tokens Used', icon: Zap, color: '#F59E0B' },
  { key: 'avg', label: 'Avg Cost/Session', icon: TrendingUp, color: '#3B82F6' },
];

const AGENT_COLORS = ['#3B82F6', '#8B5CF6', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#F97316'];
const MODEL_COLORS = ['#8B5CF6', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#06B6D4'];

export default function CostsPage() {
  const [range, setRange] = useState<TimeRange>('30');
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [todaySummary, setTodaySummary] = useState<CostSummary | null>(null);
  const [daily, setDaily] = useState<DailyRecord[]>([]);
  const [sessionCount, setSessionCount] = useState(0);

  const fetchData = useCallback(() => {
    const rangeParam = range === 'all' ? '' : `?from=${daysAgo(parseInt(range))}`;
    fetch(`/api/costs${rangeParam}`).then(r => r.json()).then(setSummary).catch(() => {});

    const today = new Date().toISOString().split('T')[0];
    fetch(`/api/costs?from=${today}`).then(r => r.json()).then(setTodaySummary).catch(() => {});

    const dailyRange = range === 'all' ? '365' : range;
    fetch(`/api/costs/daily?range=${dailyRange}`).then(r => r.json()).then(d => setDaily(d.daily || [])).catch(() => {});

    fetch('/api/sessions?limit=1').then(r => r.json()).then(d => setSessionCount(d.total || 0)).catch(() => {});
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalCost = summary?.total_cost ?? 0;
  const todayCost = todaySummary?.total_cost ?? 0;
  const totalTokens = (summary?.total_tokens_in ?? 0) + (summary?.total_tokens_out ?? 0);
  const avgCostPerSession = sessionCount > 0 ? totalCost / sessionCount : 0;

  const stats: Record<string, string> = {
    total: formatCost(totalCost),
    today: formatCost(todayCost),
    tokens: formatTokens(totalTokens),
    avg: formatCost(avgCostPerSession),
  };

  const maxAgentCost = Math.max(...(summary?.by_agent?.map(a => a.total_cost) ?? [0]), 0.0001);
  const maxModelCost = Math.max(...(summary?.by_model?.map(m => m.total_cost) ?? [0]), 0.0001);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600 }}>
          Costs
        </h1>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: range === r.value ? 'var(--accent)' : 'transparent',
                color: range === r.value ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <HelpBanner
        pageKey="costs"
        title="Cost Tracking"
        description="Estimated API costs per session, calculated from token usage × model pricing. Data is stored locally and synced to Hub every 5 minutes."
        tips={[
          'Costs are estimates based on standard provider pricing',
          'Use the time range selector to view 7d, 30d, 90d, or all-time costs',
          'Per-agent and per-model breakdowns help identify expensive workflows',
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {STAT_CARDS.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.key} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${card.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon size={20} style={{ color: card.color }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{card.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {stats[card.key]}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, fontFamily: 'var(--font-heading)' }}>
            Cost by Agent
          </h2>
          {(!summary?.by_agent || summary.by_agent.length === 0) ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>No agent cost data yet</div>
          ) : (
            summary.by_agent.map((agent, i) => (
              <HorizontalBar
                key={agent.agent_id}
                label={agent.agent_name || agent.agent_id}
                value={agent.total_cost}
                maxValue={maxAgentCost}
                color={AGENT_COLORS[i % AGENT_COLORS.length]}
                subtitle={`${agent.record_count} records`}
              />
            ))
          )}
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, fontFamily: 'var(--font-heading)' }}>
            Cost by Model
          </h2>
          {(!summary?.by_model || summary.by_model.length === 0) ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>No model cost data yet</div>
          ) : (
            summary.by_model.map((model, i) => (
              <HorizontalBar
                key={model.model}
                label={model.model}
                value={model.total_cost}
                maxValue={maxModelCost}
                color={MODEL_COLORS[i % MODEL_COLORS.length]}
                subtitle={`${formatTokens(model.total_tokens_in + model.total_tokens_out)} tokens`}
              />
            ))
          )}
        </div>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
            Daily Cost Trend
          </h2>
          {daily.length > 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
              {daily.length} days
            </div>
          )}
        </div>

        {daily.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Sparkline data={daily.map(d => d.total_cost)} width={600} height={60} />
          </div>
        )}

        {daily.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>No daily cost data yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11 }}>Date</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11 }}>Cost</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11 }}>Tokens In</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11 }}>Tokens Out</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11 }}>Records</th>
                </tr>
              </thead>
              <tbody>
                {[...daily].reverse().map(row => (
                  <tr key={row.date} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{row.date}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatCost(row.total_cost)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{formatTokens(row.total_tokens_in)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{formatTokens(row.total_tokens_out)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>{row.record_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
