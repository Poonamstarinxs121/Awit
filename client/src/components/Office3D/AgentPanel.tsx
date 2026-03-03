import { X } from 'lucide-react';
import type { OfficeAgent } from './types';

interface AgentPanelProps {
  agent: OfficeAgent;
  onClose: () => void;
}

export default function AgentPanel({ agent, onClose }: AgentPanelProps) {
  const getStatusColor = (): string => {
    switch (agent.status) {
      case 'working':
      case 'active':
        return '#22c55e';
      case 'thinking':
        return '#3b82f6';
      case 'error':
        return '#ef4444';
      case 'idle':
      default:
        return '#6b7280';
    }
  };

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, height: '100%', width: '380px',
      background: 'rgba(12,12,12,0.95)', backdropFilter: 'blur(12px)',
      color: '#F5F5F5', padding: '24px',
      borderLeft: '1px solid #2A2A2A', zIndex: 40,
      overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {agent.emoji && <span style={{ fontSize: '28px' }}>{agent.emoji}</span>}
            {agent.name}
          </h2>
          {agent.role && <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>{agent.role}</p>}
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px',
        }}>
          <X size={20} />
        </button>
      </div>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '6px 14px', borderRadius: '20px', marginBottom: '24px',
        background: `${getStatusColor()}22`,
      }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: getStatusColor(),
          animation: agent.status === 'thinking' ? 'pulse 2s infinite' : 'none',
        }} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: getStatusColor() }}>
          {agent.status.toUpperCase()}
        </span>
      </div>

      {agent.currentTask && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>Current Task</h3>
          <p style={{ fontSize: '14px' }}>{agent.currentTask}</p>
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#888', marginBottom: '12px', textTransform: 'uppercase' }}>Stats</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { label: 'Model', value: agent.model || 'N/A' },
            { label: 'Tokens/hr', value: agent.tokensPerHour?.toLocaleString() || '0' },
            { label: 'Queue', value: `${agent.tasksInQueue || 0} tasks` },
            { label: 'Uptime', value: agent.uptime ? `${agent.uptime}d` : 'N/A' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: '#1A1A1A', border: '1px solid #2A2A2A',
              padding: '12px', borderRadius: '8px',
            }}>
              <p style={{ fontSize: '10px', color: '#888', marginBottom: '4px', textTransform: 'uppercase' }}>{stat.label}</p>
              <p style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono, JetBrains Mono, monospace)' }}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #2A2A2A' }}>
        <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#888', marginBottom: '12px', textTransform: 'uppercase' }}>Quick Actions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {['Send Message', 'View History', 'Change Model', 'Kill Task'].map(action => (
            <button key={action} style={{
              padding: '8px 12px', borderRadius: '8px', fontSize: '12px',
              background: action === 'Kill Task' ? 'rgba(239,68,68,0.15)' : '#1A1A1A',
              color: action === 'Kill Task' ? '#ef4444' : '#F5F5F5',
              border: '1px solid #2A2A2A', cursor: 'pointer',
            }}>
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
