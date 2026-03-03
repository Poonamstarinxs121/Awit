import { useState, useCallback } from 'react';
import { Search, Brain, Activity, FileText, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiGet } from '../api/client';

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

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [memoryResults, setMemoryResults] = useState<MemoryNode[]>([]);
  const [activityResults, setActivityResults] = useState<ActivityResult[]>([]);
  const [searched, setSearched] = useState(false);

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

  const clear = () => { setQuery(''); setMemoryResults([]); setActivityResults([]); setSearched(false); };

  const total = memoryResults.length + activityResults.length;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Global Search</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Search across memory nodes and activity</p>
      </div>

      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search memory, activities, agents..."
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
          <button onClick={search} disabled={!query.trim() || loading} style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--accent)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: !query.trim() ? 0.5 : 1 }}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {searched && !loading && (
        <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
          {total > 0 ? `Found ${total} results for "${query}"` : `No results for "${query}"`}
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

      {searched && !loading && total === 0 && (
        <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Search size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--text-secondary)' }}>No results found</p>
          <p style={{ fontSize: '14px' }}>Try different keywords or check your memory graph</p>
        </div>
      )}

      {!searched && (
        <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Search size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--text-secondary)' }}>Search your workspace</p>
          <p style={{ fontSize: '14px' }}>Type a query above and press Enter or click Search</p>
        </div>
      )}
    </div>
  );
}
