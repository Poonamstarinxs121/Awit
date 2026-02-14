import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';
import { Users, ListChecks, CheckCircle2, Activity } from 'lucide-react';

const stats = [
  { label: 'Total Agents', value: '0', icon: Users, color: 'text-brand-accent' },
  { label: 'Active Tasks', value: '0', icon: ListChecks, color: 'text-warning' },
  { label: 'Completed Today', value: '0', icon: CheckCircle2, color: 'text-success' },
  { label: 'Activity', value: '0', icon: Activity, color: 'text-purple-400' },
];

export function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.name || 'Commander'}
        </h1>
        <p className="text-gray-500 mt-1">Here's your mission overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <stat.icon size={32} className={`${stat.color} opacity-50`} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Recent Activity">
          <p className="text-gray-500 text-sm">No recent activity</p>
        </Card>
        <Card title="Agent Status">
          <p className="text-gray-500 text-sm">No agents configured</p>
        </Card>
      </div>
    </div>
  );
}
