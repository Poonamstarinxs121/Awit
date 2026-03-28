'use client';

import { useEffect, useState, useCallback } from 'react';
import { Puzzle, ChevronDown, ChevronRight, Bot } from 'lucide-react';
import HelpBanner from '@/components/HelpBanner';

interface Agent {
  id: string;
  name: string;
  model?: string;
  status: string;
  workspace: string;
}

interface AgentDetail {
  agent: Agent;
  files: {
    soul?: string;
    agents?: string;
    tools?: string;
    memory?: string;
    heartbeat?: string;
    identity?: string;
  };
}

export default function SkillsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentDetails, setAgentDetails] = useState<Record<string, AgentDetail>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filterAgent, setFilterAgent] = useState('');

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => {
        const list: Agent[] = d.agents || [];
        setAgents(list);
        setLoading(false);
        if (list.length > 0) {
          setExpanded({ [list[0].id]: true });
          loadAgentDetail(list[0].id);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const loadAgentDetail = useCallback(async (agentId: string) => {
    if (agentDetails[agentId]) return;
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      const data = await res.json();
      setAgentDetails(prev => ({ ...prev, [agentId]: data }));
    } catch {}
  }, [agentDetails]);

  function toggleAgent(agentId: string) {
    const next = !expanded[agentId];
    setExpanded(prev => ({ ...prev, [agentId]: next }));
    if (next) loadAgentDetail(agentId);
  }

  const filtered = filterAgent ? agents.filter(a => a.id === filterAgent) : agents;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>
          Skills
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
          Tools and capabilities available to your agents
        </p>
      </div>

      <HelpBanner
        pageKey="skills"
        title="Agent Skills"
        description="Skills are defined in each agent's TOOLS.md file inside their workspace directory. OpenClaw reads these automatically to know what tools the agent can use."
        tips={[
          'Each agent has its own TOOLS.md listing available tools and functions',
          'Edit skills via the Memory page to add or remove tools from an agent',
          'Tools take effect on the next agent conversation',
        ]}
      />

      {agents.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <select
            value={filterAgent}
            onChange={e => setFilterAgent(e.target.value)}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
              minWidth: 200,
            }}
          >
            <option value="">All Agents</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }}>
          Loading agents...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: 32,
          textAlign: 'center',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
        }}>
          <Puzzle size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            No agents discovered
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>
            Make sure OpenClaw is installed and your <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>openclaw.json</code> is configured at{' '}
            <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>~/.openclaw/openclaw.json</code>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(agent => {
            const isOpen = !!expanded[agent.id];
            const detail = agentDetails[agent.id];
            const tools = detail?.files?.tools;
            return (
              <div
                key={agent.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => toggleAgent(agent.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(139,92,246,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Bot size={16} style={{ color: '#8B5CF6' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{agent.name}</div>
                    {agent.model && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {agent.model}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {detail && (
                      <span style={{
                        fontSize: 11,
                        color: tools ? '#8B5CF6' : 'var(--text-muted)',
                        background: tools ? 'rgba(139,92,246,0.1)' : 'var(--border)',
                        padding: '2px 8px',
                        borderRadius: 12,
                      }}>
                        {tools ? 'Has TOOLS.md' : 'No TOOLS.md'}
                      </span>
                    )}
                    {isOpen
                      ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                      : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                    }
                  </div>
                </button>

                {isOpen && (
                  <div style={{
                    borderTop: '1px solid var(--border)',
                    padding: 16,
                    background: 'var(--background)',
                  }}>
                    {!detail ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading skills...</div>
                    ) : !tools ? (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        No <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>TOOLS.md</code> found in this agent's workspace.
                        <br />
                        Create one at: <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>{agent.workspace}/TOOLS.md</code>
                      </div>
                    ) : (
                      <pre style={{
                        margin: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: 400,
                        overflowY: 'auto',
                      }}>
                        {tools}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
