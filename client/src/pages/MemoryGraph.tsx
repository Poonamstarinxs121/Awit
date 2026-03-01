import { useState } from 'react';
import { Brain, Search, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export function MemoryGraph() {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Memory Graph</h1>
          <p className="text-text-secondary mt-1">Your squad's shared memory visualized</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 bg-white border border-border-default rounded-lg text-text-secondary hover:text-text-primary transition-colors">
            <ZoomIn size={16} />
          </button>
          <button className="p-2 bg-white border border-border-default rounded-lg text-text-secondary hover:text-text-primary transition-colors">
            <ZoomOut size={16} />
          </button>
          <button className="p-2 bg-white border border-border-default rounded-lg text-text-secondary hover:text-text-primary transition-colors">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Search memories and documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent text-sm"
        />
      </div>

      <div className="bg-white border border-border-default rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 16rem)' }}>
        <div className="h-full flex flex-col items-center justify-center text-center p-8">
          <div className="w-20 h-20 rounded-full bg-surface-light flex items-center justify-center mb-6">
            <Brain size={36} className="text-text-muted" />
          </div>
          <h3 className="text-xl font-medium text-text-primary">Memory Graph</h3>
          <p className="text-text-secondary text-sm mt-2 max-w-lg">
            The Memory Graph is a visual map of everything your squad knows. It shows documents, memory entries, relationships between concepts, and context that agents share.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-4 text-center max-w-sm">
            <div className="p-3 bg-surface-light rounded-lg">
              <p className="text-2xl font-bold text-text-primary">0</p>
              <p className="text-xs text-text-muted mt-1">Nodes</p>
            </div>
            <div className="p-3 bg-surface-light rounded-lg">
              <p className="text-2xl font-bold text-text-primary">0</p>
              <p className="text-xs text-text-muted mt-1">Connections</p>
            </div>
            <div className="p-3 bg-surface-light rounded-lg">
              <p className="text-2xl font-bold text-text-primary">0</p>
              <p className="text-xs text-text-muted mt-1">Clusters</p>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-4">
            Start working with your squad to build the memory graph. It grows as you interact.
          </p>
        </div>
      </div>
    </div>
  );
}
