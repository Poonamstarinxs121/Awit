import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';
import { Card } from './ui/Card';
import { Spinner } from './ui/Spinner';
import { BarChart3, TrendingUp, AlertTriangle, Zap, DollarSign, CheckCircle } from 'lucide-react';

interface AgentMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  totalTokensUsed: number;
  totalCost: number;
  errorCount: number;
  errorRate: number;
  avgTokensPerTask: number;
  recentActivity: Array<{ date: string; tasks: number; tokens: number; cost: number; errors: number }>;
}

export function AgentAnalytics({ agentId }: { agentId: string }) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['agent-analytics', agentId],
    queryFn: () => apiGet<AgentMetrics>(`/v1/agents/${agentId}/analytics`),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;
  if (!metrics) return <div className="text-gray-400 text-center py-8">No analytics data available</div>;

  const statCards = [
    { label: 'Tasks Completed', value: `${metrics.completedTasks}/${metrics.totalTasks}`, icon: CheckCircle, color: 'text-green-400' },
    { label: 'Completion Rate', value: `${metrics.completionRate}%`, icon: TrendingUp, color: 'text-blue-400' },
    { label: 'Total Tokens', value: metrics.totalTokensUsed.toLocaleString(), icon: Zap, color: 'text-yellow-400' },
    { label: 'Total Cost', value: `$${metrics.totalCost.toFixed(4)}`, icon: DollarSign, color: 'text-emerald-400' },
    { label: 'Error Rate', value: `${metrics.errorRate}%`, icon: AlertTriangle, color: metrics.errorRate > 10 ? 'text-red-400' : 'text-gray-400' },
    { label: 'Tokens/Task', value: metrics.avgTokensPerTask.toLocaleString(), icon: BarChart3, color: 'text-purple-400' },
  ];

  const maxTokens = Math.max(...metrics.recentActivity.map(d => d.tokens), 1);
  const maxCost = Math.max(...metrics.recentActivity.map(d => d.cost), 0.001);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map(stat => (
          <Card key={stat.label} className="!p-4" padding={false}>
            <div className="flex items-center gap-3 p-4">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <div>
                <p className="text-xs text-gray-400">{stat.label}</p>
                <p className="text-lg font-semibold text-white">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {metrics.recentActivity.length > 0 && (
        <Card padding={false}>
          <div className="p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Daily Token Usage (Last 30 Days)
            </h3>
            <div className="flex items-end gap-1 h-32">
              {metrics.recentActivity.slice(-30).map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full bg-brand-500 rounded-t opacity-80 hover:opacity-100 transition-opacity min-h-[2px]"
                    style={{ height: `${Math.max(2, (day.tokens / maxTokens) * 100)}%` }}
                  />
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-xs text-white px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                    {day.date}: {day.tokens.toLocaleString()} tokens, ${day.cost.toFixed(4)}
                    {day.errors > 0 && `, ${day.errors} errors`}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>{metrics.recentActivity[0]?.date || ''}</span>
              <span>{metrics.recentActivity[metrics.recentActivity.length - 1]?.date || ''}</span>
            </div>
          </div>
        </Card>
      )}

      {metrics.recentActivity.length > 0 && (
        <Card padding={false}>
          <div className="p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Daily Cost Trend
            </h3>
            <div className="flex items-end gap-1 h-24">
              {metrics.recentActivity.slice(-30).map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center group relative">
                  <div
                    className="w-full bg-emerald-500 rounded-t opacity-80 hover:opacity-100 transition-opacity min-h-[2px]"
                    style={{ height: `${Math.max(2, (day.cost / maxCost) * 100)}%` }}
                  />
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-xs text-white px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                    {day.date}: ${day.cost.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
