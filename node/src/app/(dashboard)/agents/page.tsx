'use client';

import { useEffect, useState } from 'react';
import { Bot, FolderOpen, Cpu } from 'lucide-react';
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
  files: Record<string, string>;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => { setAgents(d.agents || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const loadAgent = async (id: string) => {
    try {
      const res = await fetch(`/api/agents/${id}`);
      const data = await res.json();
      setSelected(data);
    } catch {}
  };

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Discovering agents...</div>;
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, marginBottom: 16 }}>
        Agents
        <span style={{
          marginLeft: 10,
          fontSize: 12,
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          padding: '2px 10px',
          borderRadius: 12,
          fontWeight: 500,
        }}>{agents.length}</span>
      </h1>

      <HelpBanner
        pageKey="agents"
        title="OpenClaw Agent Discovery"
        description="Agents are discovered from your openclaw.json file at ~/.openclaw/openclaw.json. If no agents appear, the node will automatically detect the 'main' workspace at ~/.openclaw/workspace."
        tips={[
          'The main agent workspace is ~/.openclaw/workspace by default',
          'Additional agents are found in workspace-* sibling directories',
          'Click an agent card to view its full configuration files',
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {agents.length === 0 ? (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 40,
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}>
              <Bot size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontSize: 14 }}>No agents discovered</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Configure agents in your openclaw.json</div>
            </div>
          ) : agents.map(agent => (
            <div
              key={agent.id}
              onClick={() => loadAgent(agent.id)}
              style={{
                background: selected?.agent.id === agent.id ? 'var(--surface-elevated)' : 'var(--surface)',
                border: `1px solid ${selected?.agent.id === agent.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12,
                padding: 16,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: agent.status === 'active' ? 'var(--positive)' : 'var(--text-muted)',
                  boxShadow: agent.status === 'active' ? '0 0 6px var(--positive)' : 'none',
                }} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>{agent.name}</span>
              </div>
              {agent.model && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Cpu size={12} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {agent.model}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FolderOpen size={12} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {agent.workspace}
                </span>
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            maxHeight: 'calc(100vh - 160px)',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600 }}>
                {selected.agent.name}
              </h2>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>

            {Object.entries(selected.files).length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>
                No bootstrap files found in workspace
              </div>
            ) : (
              Object.entries(selected.files).map(([key, content]) => (
                <div key={key} style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent)',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}>
                    {key}.md
                  </div>
                  <pre style={{
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: 'var(--text-secondary)',
                    maxHeight: 300,
                    overflowY: 'auto',
                  }}>
                    {content}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
