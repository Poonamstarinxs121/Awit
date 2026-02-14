import { useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Agent Configuration</h1>
      <Card>
        <p className="text-gray-500">Coming soon — Configuration for agent {id}.</p>
      </Card>
    </div>
  );
}
