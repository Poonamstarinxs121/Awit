import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronDown, ChevronRight, CheckCircle, Clock, AlertTriangle, Send } from 'lucide-react';
import { apiGet } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import type { Standup } from '../types';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface AgentSummary {
  agent_name?: string;
  completed?: string[];
  in_progress?: string[];
  blockers?: string[];
}

function StandupCard({ standup }: { standup: Standup }) {
  const [expanded, setExpanded] = useState(false);
  const agentSummaries = (standup.per_agent_summaries || []) as AgentSummary[];

  return (
    <div className="bg-surface rounded-xl border border-gray-800">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <Calendar size={18} className="text-blue-400" />
          <h3 className="text-white font-semibold text-lg">{formatDate(standup.date)}</h3>
        </div>
        <p className="text-gray-300 text-sm leading-relaxed">{standup.summary}</p>

        {standup.delivered_to && standup.delivered_to.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <Send size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">Delivered to: {standup.delivered_to.join(', ')}</span>
          </div>
        )}

        {agentSummaries.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 mt-4 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {agentSummaries.length} agent {agentSummaries.length === 1 ? 'summary' : 'summaries'}
          </button>
        )}
      </div>

      {expanded && agentSummaries.length > 0 && (
        <div className="border-t border-gray-800 px-6 py-4 space-y-4">
          {agentSummaries.map((as, idx) => (
            <div key={idx} className="bg-surface-light rounded-lg p-4 border border-gray-700">
              <h4 className="text-white font-medium mb-3">{as.agent_name || `Agent ${idx + 1}`}</h4>
              <div className="space-y-2">
                {as.completed && as.completed.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-teal-400 font-medium mb-1">
                      <CheckCircle size={12} /> Completed
                    </div>
                    <ul className="text-sm text-gray-300 space-y-0.5 pl-4">
                      {as.completed.map((item, i) => <li key={i}>• {item}</li>)}
                    </ul>
                  </div>
                )}
                {as.in_progress && as.in_progress.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-blue-400 font-medium mb-1">
                      <Clock size={12} /> In Progress
                    </div>
                    <ul className="text-sm text-gray-300 space-y-0.5 pl-4">
                      {as.in_progress.map((item, i) => <li key={i}>• {item}</li>)}
                    </ul>
                  </div>
                )}
                {as.blockers && as.blockers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium mb-1">
                      <AlertTriangle size={12} /> Blockers
                    </div>
                    <ul className="text-sm text-gray-300 space-y-0.5 pl-4">
                      {as.blockers.map((item, i) => <li key={i}>• {item}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Standups() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['standups'],
    queryFn: () => apiGet<{ standups: Standup[] }>('/v1/standups'),
  });

  const standups = data?.standups ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Daily Standups</h1>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
          Failed to load standups: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && standups.length === 0 && (
        <div className="bg-surface rounded-xl border border-gray-800 p-12 text-center">
          <Calendar className="mx-auto mb-4 text-gray-500" size={48} />
          <p className="text-gray-400 text-lg">No standups generated yet.</p>
          <p className="text-gray-500 mt-2">Standups are automatically generated at the end of each business day.</p>
        </div>
      )}

      {!isLoading && !error && standups.length > 0 && (
        <div className="space-y-4">
          {standups.map((standup) => (
            <StandupCard key={standup.id} standup={standup} />
          ))}
        </div>
      )}
    </div>
  );
}
