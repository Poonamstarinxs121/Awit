import { Card } from '../components/ui/Card';

export function Kanban() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Mission Queue</h1>
      <Card>
        <p className="text-gray-500">Coming soon — Kanban board with Inbox, Assigned, In Progress, Review, and Done columns.</p>
      </Card>
    </div>
  );
}
