import { useState, useEffect, useMemo } from 'react';
import { Brain, Search, Database, FileText, User, Loader2, RefreshCw, Link2, Info, Sparkles, Clock } from 'lucide-react';
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

const typeConfig: Record<string, { icon: typeof Brain; color: string; bg: string; border: string; label: string }> = {
  agent: { icon: User, color: 'var(--accent)', bg: 'rgba(255,59,48,0.12)', border: 'rgba(255,59,48,0.25)', label: 'Agent' },
  long_term: { icon: Brain, color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)', label: 'Long-term' },
  working: { icon: Database, color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)', label: 'Working' },
  daily_note: { icon: Clock, color: '#34D399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.25)', label: 'Daily Note' },
  document: { icon: FileText, color: '#60A5FA', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.25)', label: 'Document' },
};

function getConfig(type: string) {
  return typeConfig[type] || { icon: Brain, color: 'var(--text-muted)', bg: 'var(--surface-elevated)', border: 'var(--border)', label: type };
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function MemoryGraph() {
  const [search, setSearch] = useState('');
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

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

  const nodeEdges = useMemo(() => {
    if (!data) return new Map<string, GraphEdge[]>();
    const map = new Map<string, GraphEdge[]>();
    for (const edge of data.edges) {
      if (!map.has(edge.source)) map.set(edge.source, []);
      if (!map.has(edge.target)) map.set(edge.target, []);
      map.get(edge.source)!.push(edge);
      map.get(edge.target)!.push(edge);
    }
    return map;
  }, [data]);

  const totalNodes = data?.nodes.length || 0;
  const totalEdges = data?.edges.length || 0;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '16px' }}>
        <p style={{ color: 'var(--negative)', fontSize: '14px' }}>{error}</p>
        <button onClick={fetchGraph} style={{ padding: '8px 16px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  const statsData = [
    { label: 'Nodes', value: totalNodes, icon: Sparkles, color: 'var(--accent)' },
    { label: 'Connections', value: totalEdges, icon: Link2, color: '#A78BFA' },
    { label: 'Clusters', value: clusterCount, icon: Database, color: '#34D399' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Memory</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Your squad's shared knowledge graph</p>
        </div>
        <button
          onClick={fetchGraph}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', transition: 'all 150ms' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {statsData.map((stat) => {
          const StatIcon = stat.icon;
          return (
            <div key={stat.label} style={{ padding: '16px 20px', backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <StatIcon size={18} style={{ color: stat.color }} />
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{stat.value}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 items-center flex-wrap" style={{ marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search memories, agents, documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px', paddingRight: '12px', paddingTop: '10px', paddingBottom: '10px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font-body)' }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedType(null)}
            style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: '1px solid', transition: 'all 150ms', backgroundColor: selectedType === null ? 'var(--accent-soft)' : 'var(--surface-elevated)', borderColor: selectedType === null ? 'var(--accent)' : 'var(--border)', color: selectedType === null ? 'var(--accent)' : 'var(--text-secondary)' }}
          >
            All
          </button>
          {nodeTypes.map((type) => {
            const cfg = getConfig(type);
            const isActive = selectedType === type;
            return (
              <button
                key={type}
                onClick={() => setSelectedType(isActive ? null : type)}
                style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: '1px solid', transition: 'all 150ms', backgroundColor: isActive ? cfg.bg : 'var(--surface-elevated)', borderColor: isActive ? cfg.border : 'var(--border)', color: isActive ? cfg.color : 'var(--text-secondary)' }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', height: 'calc(100vh - 380px)', display: 'flex', flexDirection: 'column' }}>
        {filteredNodes.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <Brain size={28} style={{ color: 'var(--text-muted)' }} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {totalNodes === 0 ? 'No Memories Yet' : 'No Results'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: 1.6 }}>
              {totalNodes === 0
                ? 'Memories are created as your agents interact, process tasks, and store insights. Start a session to build your knowledge graph.'
                : 'No nodes match your current search or filter. Try adjusting your criteria.'}
            </p>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {filteredNodes.map((node) => {
              const cfg = getConfig(node.type);
              const Icon = cfg.icon;
              const connections = connectionMap.get(node.id) || 0;
              const isExpanded = expandedNode === node.id;
              const edges = nodeEdges.get(node.id) || [];

              return (
                <div key={node.id} style={{ marginBottom: '4px' }}>
                  <div
                    onClick={() => setExpandedNode(isExpanded ? null : node.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '10px', border: '1px solid', borderColor: isExpanded ? cfg.border : 'transparent', backgroundColor: isExpanded ? cfg.bg : 'transparent', cursor: 'pointer', transition: 'all 150ms' }}
                    onMouseEnter={(e) => { if (!isExpanded) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-elevated)'; }}
                    onMouseLeave={(e) => { if (!isExpanded) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} style={{ color: cfg.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</span>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, flexShrink: 0 }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '3px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {node.agentName && <span>by {node.agentName}</span>}
                        {connections > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Link2 size={10} />
                            {connections}
                          </span>
                        )}
                        {node.createdAt && <span>{relativeTime(node.createdAt)}</span>}
                      </div>
                    </div>
                  </div>

                  {isExpanded && edges.length > 0 && (
                    <div style={{ marginLeft: '24px', paddingLeft: '24px', borderLeft: `2px solid ${cfg.border}`, marginTop: '4px', marginBottom: '8px', paddingTop: '4px', paddingBottom: '4px' }}>
                      {edges.map((edge, i) => {
                        const targetId = edge.source === node.id ? edge.target : edge.source;
                        const targetNode = data?.nodes.find(n => n.id === targetId);
                        const targetCfg = targetNode ? getConfig(targetNode.type) : getConfig('');
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', fontSize: '12px', borderRadius: '6px', marginBottom: '2px', transition: 'background-color 150ms' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-elevated)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                          >
                            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '80px' }}>{edge.relationship}</span>
                            <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
                            <span style={{ color: targetCfg.color, fontWeight: 500 }}>{targetNode?.label || targetId}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isExpanded && edges.length === 0 && (
                    <div style={{ marginLeft: '24px', paddingLeft: '24px', borderLeft: `2px solid ${cfg.border}`, marginTop: '4px', marginBottom: '8px', paddingTop: '8px', paddingBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No connections to other nodes</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 16px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <Info size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '1px' }} />
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          The Memory Graph shows how your agents store and connect knowledge. Each node is a memory entry (long-term insight, working context, daily note, or document) created by an agent during sessions. Connections represent relationships between memories, forming a knowledge network that agents use for context during conversations and task execution.
        </p>
      </div>
    </div>
  );
}
