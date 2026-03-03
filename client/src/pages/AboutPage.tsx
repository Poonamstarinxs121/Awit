import { useQuery } from '@tanstack/react-query';
import { Zap, Brain, MessageSquare, FileText, Timer, Puzzle, Activity, CheckCircle } from 'lucide-react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatsCard } from '../components/ui/StatsCard';
import { apiGet } from '../api/client';

const integrations = [
  { name: 'OpenAI', icon: '🤖', color: '#10a37f' },
  { name: 'Anthropic', icon: '🧠', color: '#d97706' },
  { name: 'Google Gemini', icon: '✨', color: '#4285f4' },
  { name: 'Mistral', icon: '🌊', color: '#7c3aed' },
  { name: 'Groq', icon: '⚡', color: '#ff6b35' },
  { name: 'Ollama', icon: '🦙', color: '#059669' },
  { name: 'Telegram', icon: '📨', color: '#0088cc' },
  { name: 'WhatsApp', icon: '💬', color: '#25d366' },
  { name: 'Stripe', icon: '💳', color: '#635bff' },
  { name: 'PostgreSQL', icon: '🐘', color: '#336791' },
];

const features = [
  { name: 'Multi-tenant Auth', icon: CheckCircle, color: 'var(--positive)' },
  { name: 'BYOK API Keys', icon: Zap, color: 'var(--info)' },
  { name: 'Agent Orchestration', icon: Brain, color: 'var(--type-command)' },
  { name: 'Memory Search (pgvector)', icon: Brain, color: 'var(--info)' },
  { name: 'Cron Scheduler', icon: Timer, color: 'var(--type-cron)' },
  { name: 'Webhook System', icon: Activity, color: 'var(--accent)' },
  { name: 'Telegram Integration', icon: MessageSquare, color: '#0088cc' },
  { name: 'SSH Machine Registry', icon: FileText, color: 'var(--type-file)' },
  { name: 'Stripe Billing', icon: Puzzle, color: '#635bff' },
  { name: 'SaaS Admin Console', icon: CheckCircle, color: 'var(--positive)' },
];

export function AboutPage() {
  const { data: statsData } = useQuery({
    queryKey: ['about-stats'],
    queryFn: async () => {
      const [actStats, agents] = await Promise.all([
        apiGet<any>('/v1/activity/stats').catch(() => ({ total: 0 })),
        apiGet<{ agents: any[] }>('/v1/agents').catch(() => ({ agents: [] })),
      ]);
      return { total: actStats.total || 0, agentCount: agents.agents?.length || 0 };
    },
    retry: false,
  });

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>About SquidJob</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Multi-tenant AI Agent Orchestration Platform</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <StatsCard title="Total Events" value={(statsData?.total || 0).toLocaleString()} icon={<Activity size={18} />} iconColor="var(--info)" />
        <StatsCard title="Agents" value={statsData?.agentCount || 0} icon={<Brain size={18} />} iconColor="var(--accent)" />
        <StatsCard title="Version" value="v1.0" icon={<Zap size={18} />} iconColor="var(--positive)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <SectionHeader title="Platform Features" />
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {features.map(f => (
              <div key={f.name} className="flex items-center gap-3" style={{ padding: '8px 12px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <f.icon size={15} style={{ color: f.color, flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{f.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <SectionHeader title="Integrations" />
          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {integrations.map(i => (
              <div key={i.name} className="flex items-center gap-3" style={{ padding: '10px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '20px' }}>{i.icon}</span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{i.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <div className="flex items-center gap-4" style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '40px' }}>🦑</span>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>SquidJob Mission Control</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Built for teams that move fast with AI agents</p>
          </div>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: '600px' }}>
          SquidJob is a multi-tenant SaaS platform designed to orchestrate independent AI agents into cohesive, coordinated teams. 
          It enables customers to bring their own API keys (BYOK) for various LLM providers and offers a comprehensive platform 
          including an orchestration layer, a Mission Control UI, a shared database, and robust agent management capabilities.
        </p>
      </div>
    </div>
  );
}
