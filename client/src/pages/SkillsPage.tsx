import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Puzzle, Search, Bot, Star } from 'lucide-react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatsCard } from '../components/ui/StatsCard';
import { apiGet } from '../api/client';

interface Agent {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  model?: string;
  provider?: string;
  capabilities?: string[];
  tools?: string[];
  soul_config?: any;
}

export function SkillsPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Agent | null>(null);

  const { data } = useQuery({
    queryKey: ['agents-skills'],
    queryFn: () => apiGet<{ agents: Agent[] }>('/v1/agents'),
    retry: false,
  });

  const agents = (data?.agents || []).filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
  );

  const getTools = (agent: Agent): string[] => {
    if (agent.tools && Array.isArray(agent.tools)) return agent.tools;
    if (agent.capabilities && Array.isArray(agent.capabilities)) return agent.capabilities;
    return [];
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Skills</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Agent capabilities and tools</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatsCard title="Total Agents" value={agents.length} icon={<Bot size={18} />} iconColor="var(--accent)" />
        <StatsCard title="Providers" value={new Set(agents.map(a => a.provider).filter(Boolean)).size} icon={<Star size={18} />} iconColor="var(--info)" />
        <StatsCard title="Skill Types" value={new Set(agents.flatMap(getTools)).size} icon={<Puzzle size={18} />} iconColor="var(--positive)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: '16px' }}>
        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <div style={{ width: '3px', height: '18px', backgroundColor: 'var(--accent)', borderRadius: '2px' }} />
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Agent Skills</h2>
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search agents..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '6px', paddingBottom: '6px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', width: '200px', outline: 'none' }}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', padding: '16px' }}>
            {agents.map(agent => {
              const tools = getTools(agent);
              return (
                <div
                  key={agent.id}
                  onClick={() => setSelected(selected?.id === agent.id ? null : agent)}
                  style={{ backgroundColor: 'var(--surface-elevated)', border: `1px solid ${selected?.id === agent.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '10px', padding: '14px', cursor: 'pointer', transition: 'all 150ms ease' }}
                  onMouseEnter={(e) => { if (selected?.id !== agent.id) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
                  onMouseLeave={(e) => { if (selected?.id !== agent.id) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                >
                  <div className="flex items-center gap-3" style={{ marginBottom: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: agent.color ? `${agent.color}22` : 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                      {agent.emoji || '🤖'}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{agent.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{agent.model || agent.provider || '–'}</div>
                    </div>
                  </div>
                  {tools.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {tools.slice(0, 4).map(t => (
                        <span key={t} style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 500, backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>
                          {t}
                        </span>
                      ))}
                      {tools.length > 4 && <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '10px', color: 'var(--text-muted)', backgroundColor: 'var(--surface-hover)' }}>+{tools.length - 4}</span>}
                    </div>
                  ) : (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No specific tools configured</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {selected && (
          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', alignSelf: 'start' }}>
            <SectionHeader title={`${selected.emoji || '🤖'} ${selected.name}`} rightAction={<button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>} />
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                {[
                  { label: 'Model', value: selected.model || '–' },
                  { label: 'Provider', value: selected.provider || '–' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: '10px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tools & Capabilities</div>
                {getTools(selected).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {getTools(selected).map(t => (
                      <span key={t} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No specific tools configured. Configure tools in Agent Settings.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
