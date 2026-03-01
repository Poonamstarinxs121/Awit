import { useState, useEffect, useMemo } from 'react';
import { Brain, Search, ZoomIn, ZoomOut, Maximize2, Database, FileText, User, Loader2, RefreshCw } from 'lucide-react';
import { apiGet } from '../api/client';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  agentName: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string | null;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const typeColors: Record<string, string> = {
  agent: 'bg-purple-100 text-purple-700 border-purple-200',
  long_term: 'bg-blue-100 text-blue-700 border-blue-200',
  working: 'bg-amber-100 text-amber-700 border-amber-200',
  daily_note: 'bg-green-100 text-green-700 border-green-200',
  document: 'bg-rose-100 text-rose-700 border-rose-200',
};

const typeIcons: Record<string, typeof Brain> = {
  agent: User,
  long_term: Brain,
  working: Database,
  daily_note: FileText,
  document: FileText,
};

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    agent: 'Agent',
    long_term: 'Long-term Memory',
    working: 'Working Memory',
    daily_note: 'Daily Note',
    document: 'Document',
  };
  return labels[type] || type;
}

export function MemoryGraph() {
  const [search, setSearch] = useState('');
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const fetchGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<GraphData>('/v1/memory-graph');
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load memory graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  const filteredNodes = useMemo(() => {
    if (!data) return [];
    let nodes = data.nodes;
    if (selectedType) {
      nodes = nodes.filter((n) => n.type === selectedType);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      nodes = nodes.filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.type.toLowerCase().includes(q) ||
          (n.agentName && n.agentName.toLowerCase().includes(q))
      );
    }
    return nodes;
  }, [data, search, selectedType]);

  const clusterCount = useMemo(() => {
    if (!data) return 0;
    const agentNodes = data.nodes.filter((n) => n.type === 'agent');
    const connectedAgents = new Set<string>();
    for (const edge of data.edges) {
      const agentId = agentNodes.find((a) => a.id === edge.source || a.id === edge.target)?.id;
      if (agentId) connectedAgents.add(agentId);
    }
    return Math.max(connectedAgents.size, agentNodes.length > 0 ? 1 : 0);
  }, [data]);

  const nodeTypes = useMemo(() => {
    if (!data) return [];
    const types = new Set(data.nodes.map((n) => n.type));
    return Array.from(types).sort();
  }, [data]);

  const connectionMap = useMemo(() => {
    if (!data) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const edge of data.edges) {
      map.set(edge.source, (map.get(edge.source) || 0) + 1);
      map.set(edge.target, (map.get(edge.target) || 0) + 1);
    }
    return map;
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-accent" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500">{error}</p>
        <button onClick={fetchGraph} className="px-4 py-2 bg-brand-accent text-white rounded-lg text-sm">
          Retry
        </button>
      </div>
    );
  }

  const totalNodes = data?.nodes.length || 0;
  const totalEdges = data?.edges.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Memory Graph</h1>
          <p className="text-text-secondary mt-1">Your squad's shared memory visualized</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchGraph}
            className="p-2 bg-white border border-border-default rounded-lg text-text-secondary hover:text-text-primary transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-md">
        <div className="p-3 bg-white border border-border-default rounded-lg text-center">
          <p className="text-2xl font-bold text-text-primary">{totalNodes}</p>
          <p className="text-xs text-text-muted mt-1">Nodes</p>
        </div>
        <div className="p-3 bg-white border border-border-default rounded-lg text-center">
          <p className="text-2xl font-bold text-text-primary">{totalEdges}</p>
          <p className="text-xs text-text-muted mt-1">Connections</p>
        </div>
        <div className="p-3 bg-white border border-border-default rounded-lg text-center">
          <p className="text-2xl font-bold text-text-primary">{clusterCount}</p>
          <p className="text-xs text-text-muted mt-1">Clusters</p>
        </div>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search memories and documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent text-sm"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setSelectedType(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selectedType === null
                ? 'bg-brand-accent text-white border-brand-accent'
                : 'bg-white text-text-secondary border-border-default hover:border-brand-accent'
            }`}
          >
            All
          </button>
          {nodeTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(selectedType === type ? null : type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                selectedType === type
                  ? 'bg-brand-accent text-white border-brand-accent'
                  : 'bg-white text-text-secondary border-border-default hover:border-brand-accent'
              }`}
            >
              {getTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-border-default rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 22rem)' }}>
        {filteredNodes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 rounded-full bg-surface-light flex items-center justify-center mb-6">
              <Brain size={36} className="text-text-muted" />
            </div>
            <h3 className="text-xl font-medium text-text-primary">
              {totalNodes === 0 ? 'No Memories Yet' : 'No Results'}
            </h3>
            <p className="text-text-secondary text-sm mt-2 max-w-lg">
              {totalNodes === 0
                ? 'Start working with your squad to build the memory graph. It grows as agents interact and create memories.'
                : 'No nodes match your current search or filter. Try adjusting your criteria.'}
            </p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4 space-y-2">
            {filteredNodes.map((node) => {
              const Icon = typeIcons[node.type] || Brain;
              const colorClass = typeColors[node.type] || 'bg-gray-100 text-gray-700 border-gray-200';
              const connections = connectionMap.get(node.id) || 0;
              return (
                <div
                  key={node.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border-default hover:border-brand-accent/30 hover:bg-surface-light/50 transition-colors"
                >
                  <div className={`p-2 rounded-lg border ${colorClass} flex-shrink-0`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary truncate">{node.label}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${colorClass}`}>
                        {getTypeLabel(node.type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                      {node.agentName && <span>by {node.agentName}</span>}
                      {connections > 0 && <span>{connections} connection{connections !== 1 ? 's' : ''}</span>}
                      {node.createdAt && (
                        <span>{new Date(node.createdAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
