import { useState, useCallback, useEffect } from 'react';
import { Search, Brain, Activity, FileText, X, Globe, MessageSquare, Server, Loader2, CheckSquare, Square } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiGet, apiPost } from '../api/client';

interface MemoryNode {
  id: string;
  content: string;
  agent_id?: string;
  type?: string;
  created_at?: string;
  similarity?: number;
}

interface ActivityResult {
  id: string;
  action: string;
  details?: any;
  created_at: string;
}

interface FleetNode {
  id: string;
  name: string;
  status: string;
}

interface FleetResult {
  type: string;
  title: string;
  snippet: string;
  source: string;
  node_id: string | null;
  node_name: string;
  agent_id?: string;
  path?: string;
  created_at?: string;
  score?: number;
}

type TabType = 'memory' | 'activity' | 'fleet';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [memoryResults, setMemoryResults] = useState<MemoryNode[]>([]);
  const [activityResults, setActivityResults] = useState<ActivityResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('memory');

  const [fleetResults, setFleetResults] = useState<FleetResult[]>([]);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetSearched, setFleetSearched] = useState(false);
  const [nodes, setNodes] = useState<FleetNode[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [includeHub, setIncludeHub] = useState(true);
  const [nodeLoadingStates, setNodeLoadingStates] = useState<Record<string, 'loading' | 'done' | 'error'>>({});
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ nodes: FleetNode[] }>('/v1/nodes')
      .then(data => {
        const nodeList = data.nodes || [];
        setNodes(nodeList);
        setSelectedNodeIds(new Set(nodeList.map(n => n.id)));
      })
      .catch(() => {});
  }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const [memData, actData] = await Promise.all([
        apiGet<{ nodes: MemoryNode[] }>(`/v1/memory-graph/nodes?query=${encodeURIComponent(query)}&limit=10`).catch(() => ({ nodes: [] })),
        apiGet<{ activities: ActivityResult[] }>(`/v1/activity?limit=20`).catch(() => ({ activities: [] })),
      ]);
      setMemoryResults(memData.nodes || []);
      const filteredAct = (actData.activities || []).filter(a => {
        const q = query.toLowerCase();
        const desc = typeof a.details === 'string' ? a.details : JSON.stringify(a.details || '');
        return a.action?.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
      }).slice(0, 5);
      setActivityResults(filteredAct);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const searchFleet = useCallback(async () => {
    if (!query.trim()) return;
    setFleetLoading(true);
    setFleetSearched(true);
    setFleetResults([]);

    const loadingStates: Record<string, 'loading' | 'done' | 'error'> = {};
    if (includeHub) loadingStates['hub'] = 'loading';
    selectedNodeIds.forEach(id => { loadingStates[id] = 'loading'; });
    setNodeLoadingStates(loadingStates);

    try {
      const nodeIdsArray = Array.from(selectedNodeIds);
      const data = await apiPost<{ results: FleetResult[]; total: number }>('/v1/fleet/search', {
        query: query.trim(),
        node_ids: nodeIdsArray.length > 0 ? nodeIdsArray : undefined,
        include_hub: includeHub,
      });

      const results = data.results || [];
      setFleetResults(results);

      const doneStates: Record<string, 'loading' | 'done' | 'error'> = {};
      if (includeHub) doneStates['hub'] = results.some(r => r.source === 'hub') ? 'done' : 'done';
      selectedNodeIds.forEach(id => {
        doneStates[id] = 'done';
      });
      setNodeLoadingStates(doneStates);
    } catch (e) {
      console.error(e);
      const errorStates: Record<string, 'loading' | 'done' | 'error'> = {};
      if (includeHub) errorStates['hub'] = 'error';
      selectedNodeIds.forEach(id => { errorStates[id] = 'error'; });
      setNodeLoadingStates(errorStates);
    } finally {
      setFleetLoading(false);
    }
  }, [query, selectedNodeIds, includeHub]);

  const handleSearch = useCallback(() => {
    if (activeTab === 'fleet') {
      searchFleet();
    } else {
      search();
    }
  }, [activeTab, search, searchFleet]);

  const clear = () => {
    setQuery('');
    setMemoryResults([]);
    setActivityResults([]);
    setFleetResults([]);
    setSearched(false);
    setFleetSearched(false);
    setNodeLoadingStates({});
    setExpandedSession(null);
  };

  const toggleNode = (nodeId: string) => {
    setSelectedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const total = memoryResults.length + activityResults.length;

  const groupedFleetResults = fleetResults.reduce<Record<string, FleetResult[]>>((acc, r) => {
    const key = r.node_name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'memory': return <Brain size={14} style={{ color: 'var(--type-command)' }} />;
      case 'file': return <FileText size={14} style={{ color: 'var(--warning)' }} />;
      case 'session': return <MessageSquare size={14} style={{ color: 'var(--info)' }} />;
      default: return <FileText size={14} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const handleResultClick = (result: FleetResult) => {
    if (result.source === 'hub' && result.type === 'memory') {
      window.location.href = '/memory-graph';
    } else if (result.source === 'node' && result.type === 'file' && result.path) {
      const node = nodes.find(n => n.id === result.node_id);
      if (node) {
        window.open(`/fleet`, '_self');
      }
    } else if (result.type === 'session') {
      setExpandedSession(expandedSession === `${result.node_id}-${result.title}` ? null : `${result.node_id}-${result.title}`);
    }
  };

  const tabStyle = (tab: TabType) => ({
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 600 as const,
    fontFamily: 'var(--font-heading)',
    color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
    cursor: 'pointer' as const,
    transition: 'all 0.2s',
  });

  const isCurrentTabSearched = activeTab === 'fleet' ? fleetSearched : searched;
  const isCurrentTabLoading = activeTab === 'fleet' ? fleetLoading : loading;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Global Search</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Search across memory nodes, activity, and fleet</p>
      </div>

      <div className="mobile-scroll-x" style={{ display: 'flex', gap: '0px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        <button onClick={() => setActiveTab('memory')} style={tabStyle('memory')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Brain size={14} /> Memory
          </span>
        </button>
        <button onClick={() => setActiveTab('activity')} style={tabStyle('activity')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={14} /> Activity
          </span>
        </button>
        <button onClick={() => setActiveTab('fleet')} style={tabStyle('fleet')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={14} /> Fleet
          </span>
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder={activeTab === 'fleet' ? 'Search across all nodes and Hub...' : 'Search memory, activities, agents...'}
          style={{ width: '100%', paddingLeft: '48px', paddingRight: query ? '120px' : '16px', paddingTop: '14px', paddingBottom: '14px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '15px', outline: 'none', fontFamily: 'var(--font-body)' }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
        />
        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '8px' }}>
          {query && (
            <button onClick={clear} style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          )}
          <button onClick={handleSearch} disabled={!query.trim() || isCurrentTabLoading} style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--accent)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: !query.trim() ? 0.5 : 1 }}>
            {isCurrentTabLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {activeTab === 'fleet' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', padding: '12px 16px', backgroundColor: 'var(--surface-elevated)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-heading)', marginRight: '8px', display: 'flex', alignItems: 'center' }}>Sources:</span>
          <button
            onClick={() => setIncludeHub(!includeHub)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: includeHub ? 'var(--accent)' : 'transparent', color: includeHub ? 'white' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
          >
            {includeHub ? <CheckSquare size={12} /> : <Square size={12} />}
            Hub
          </button>
          {nodes.map(node => (
            <button
              key={node.id}
              onClick={() => toggleNode(node.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: selectedNodeIds.has(node.id) ? 'var(--accent)' : 'transparent', color: selectedNodeIds.has(node.id) ? 'white' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
            >
              {selectedNodeIds.has(node.id) ? <CheckSquare size={12} /> : <Square size={12} />}
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: node.status === 'online' ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0 }} />
              {node.name}
            </button>
          ))}
          {nodes.length === 0 && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No nodes registered</span>
          )}
        </div>
      )}

      {activeTab === 'fleet' && fleetLoading && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {Object.entries(nodeLoadingStates).map(([id, state]) => {
              const name = id === 'hub' ? 'Hub' : nodes.find(n => n.id === id)?.name || id;
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {state === 'loading' && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                  {state === 'done' && <span style={{ color: 'var(--success)' }}>✓</span>}
                  {state === 'error' && <span style={{ color: 'var(--danger)' }}>✗</span>}
                  {name}
                </div>
              );
            })}
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {activeTab === 'memory' && (
        <>
          {searched && !loading && (
            <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              {memoryResults.length > 0 ? `Found ${memoryResults.length} memory results for "${query}"` : `No memory results for "${query}"`}
            </div>
          )}
          {memoryResults.length > 0 && (
            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '16px' }}>
              <div className="flex items-center gap-3" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <Brain size={16} style={{ color: 'var(--type-command)' }} />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Memory Results ({memoryResults.length})</h3>
              </div>
              {memoryResults.map((node, i) => (
                <div key={node.id} style={{ padding: '14px 20px', borderBottom: i < memoryResults.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div className="line-clamp-2" style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '6px' }}>{node.content}</div>
                  <div className="flex gap-3">
                    {node.type && <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '3px', backgroundColor: 'var(--type-command-bg)', color: 'var(--type-command)', fontWeight: 600 }}>{node.type}</span>}
                    {node.created_at && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{formatDistanceToNow(new Date(node.created_at), { addSuffix: true })}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {searched && !loading && memoryResults.length === 0 && (
            <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Search size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--text-secondary)' }}>No memory results found</p>
              <p style={{ fontSize: '14px' }}>Try different keywords or check your memory graph</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'activity' && (
        <>
          {searched && !loading && (
            <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              {activityResults.length > 0 ? `Found ${activityResults.length} activity results for "${query}"` : `No activity results for "${query}"`}
            </div>
          )}
          {activityResults.length > 0 && (
            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div className="flex items-center gap-3" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <Activity size={16} style={{ color: 'var(--info)' }} />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Activity Results ({activityResults.length})</h3>
              </div>
              {activityResults.map((act, i) => (
                <div key={act.id} style={{ padding: '12px 20px', borderBottom: i < activityResults.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {typeof act.details === 'string' ? act.details : act.action}
                  </div>
                  <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '3px', backgroundColor: 'var(--info-soft)', color: 'var(--info)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{act.action}</span>
                </div>
              ))}
            </div>
          )}
          {searched && !loading && activityResults.length === 0 && (
            <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Search size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--text-secondary)' }}>No activity results found</p>
              <p style={{ fontSize: '14px' }}>Try different keywords</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'fleet' && (
        <>
          {fleetSearched && !fleetLoading && (
            <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              {fleetResults.length > 0 ? `Found ${fleetResults.length} fleet results for "${query}"` : `No fleet results for "${query}"`}
            </div>
          )}

          {fleetResults.length > 0 && Object.entries(groupedFleetResults).map(([nodeName, results]) => (
            <div key={nodeName} style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '16px' }}>
              <div className="flex items-center gap-3" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <Server size={14} style={{ color: 'var(--text-muted)' }} />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{nodeName}</h3>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', backgroundColor: nodeName === 'Hub' ? 'var(--accent)' : 'var(--info-soft)', color: nodeName === 'Hub' ? 'white' : 'var(--info)', fontWeight: 600 }}>
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </span>
              </div>
              {results.map((result, i) => {
                const sessionKey = `${result.node_id}-${result.title}`;
                const isExpanded = expandedSession === sessionKey && result.type === 'session';
                return (
                  <div key={i}>
                    <div
                      onClick={() => handleResultClick(result)}
                      style={{ padding: '12px 20px', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--surface-elevated)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ marginTop: '2px', flexShrink: 0 }}>
                          {getTypeIcon(result.type)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{result.title}</span>
                            <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '3px', backgroundColor: result.type === 'memory' ? 'var(--type-command-bg)' : result.type === 'file' ? 'var(--warning-soft, rgba(255,149,0,0.1))' : 'var(--info-soft)', color: result.type === 'memory' ? 'var(--type-command)' : result.type === 'file' ? 'var(--warning)' : 'var(--info)', fontWeight: 600, textTransform: 'uppercase' as const }}>{result.type}</span>
                          </div>
                          {result.snippet && (
                            <div className="line-clamp-2" style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{result.snippet}</div>
                          )}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                            {result.agent_id && (
                              <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>agent: {result.agent_id}</span>
                            )}
                            {result.path && (
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{result.path}</span>
                            )}
                            {result.created_at && (
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{formatDistanceToNow(new Date(result.created_at), { addSuffix: true })}</span>
                            )}
                          </div>
                        </div>
                        {result.score !== undefined && result.score > 0 && (
                          <div style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {Math.round(result.score * 100)}
                          </div>
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: '12px 20px 12px 46px', backgroundColor: 'var(--surface-elevated)', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <div style={{ marginBottom: '4px' }}><strong>Title:</strong> {result.title}</div>
                        {result.snippet && <div style={{ marginBottom: '4px' }}><strong>Content:</strong> {result.snippet}</div>}
                        {result.agent_id && <div style={{ marginBottom: '4px' }}><strong>Agent:</strong> {result.agent_id}</div>}
                        <div><strong>Source:</strong> {result.node_name} ({result.source})</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {fleetSearched && !fleetLoading && fleetResults.length === 0 && (
            <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Globe size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--text-secondary)' }}>No fleet results found</p>
              <p style={{ fontSize: '14px' }}>Try different keywords or check that nodes are online</p>
            </div>
          )}
        </>
      )}

      {!isCurrentTabSearched && !isCurrentTabLoading && (
        <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Search size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
            {activeTab === 'fleet' ? 'Search across your fleet' : 'Search your workspace'}
          </p>
          <p style={{ fontSize: '14px' }}>Type a query above and press Enter or click Search</p>
        </div>
      )}
    </div>
  );
}
