import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Plus } from 'lucide-react';
import { apiGet } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import type { Agent } from '../types';

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-teal-500', 'bg-purple-500', 'bg-amber-500',
  'bg-rose-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-orange-500',
];

const statusConfig: Record<string, { variant: 'active' | 'idle' | 'error' | 'default'; dot: string; label: string }> = {
  active: { variant: 'active', dot: 'bg-teal-400', label: 'Active' },
  idle: { variant: 'idle', dot: 'bg-gray-400', label: 'Idle' },
  error: { variant: 'error', dot: 'bg-red-400', label: 'Error' },
  disabled: { variant: 'default', dot: 'bg-gray-500', label: 'Disabled' },
};

const levelConfig: Record<string, { variant: 'warning' | 'info' | 'default'; label: string }> = {
  lead: { variant: 'warning', label: 'Lead' },
  specialist: { variant: 'info', label: 'Specialist' },
  intern: { variant: 'default', label: 'Intern' },
};

export function Agents() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiGet<{ agents: Agent[] }>('/v1/agents'),
  });

  const agents = data?.agents ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Roster</h1>
          <p className="text-gray-400 mt-1">Your AI squad members</p>
        </div>
        <Button onClick={() => navigate('/agents/new')}>
          <Plus size={18} className="mr-2" />
          Create Agent
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
          Failed to load agents: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && agents.length === 0 && (
        <div className="bg-surface rounded-xl border border-gray-800 p-12 text-center">
          <Users className="mx-auto mb-4 text-gray-500" size={48} />
          <p className="text-gray-400 text-lg">No agents in the squad yet.</p>
          <p className="text-gray-500 mt-1">Create your first agent to get started.</p>
        </div>
      )}

      {!isLoading && !error && agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent, index) => {
            const status = statusConfig[agent.status] || statusConfig.idle;
            const level = levelConfig[agent.level] || levelConfig.intern;
            const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];

            return (
              <div
                key={agent.id}
                onClick={() => navigate(`/agents/${agent.id}`)}
                className="bg-surface rounded-xl border border-gray-800 p-5 cursor-pointer hover:border-gray-600 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className={`${avatarColor} w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0`}>
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-white font-semibold text-lg group-hover:text-blue-400 transition-colors ${agent.status === 'disabled' ? 'line-through opacity-60' : ''}`}>
                        {agent.name}
                      </h3>
                      {agent.is_default && (
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">Default</span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mt-0.5 truncate">{agent.role}</p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Badge variant={status.variant}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot} mr-1.5`} />
                        {status.label}
                      </Badge>
                      <Badge variant={level.variant}>{level.label}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
