import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Search, Plus, FileText, ClipboardList, Microscope, ScrollText, CheckSquare, StickyNote, File } from 'lucide-react';

type DocType = 'all' | 'deliverable' | 'brief' | 'research' | 'protocol' | 'checklist' | 'note';

const DOC_TYPES: { key: DocType; label: string; icon: typeof FileText; color: string }[] = [
  { key: 'all', label: 'All', icon: File, color: 'text-text-secondary' },
  { key: 'deliverable', label: 'Deliverable', icon: FileText, color: 'text-blue-600' },
  { key: 'brief', label: 'Brief', icon: ClipboardList, color: 'text-purple-600' },
  { key: 'research', label: 'Research', icon: Microscope, color: 'text-green-600' },
  { key: 'protocol', label: 'Protocol', icon: ScrollText, color: 'text-amber-600' },
  { key: 'checklist', label: 'Checklist', icon: CheckSquare, color: 'text-teal-600' },
  { key: 'note', label: 'Note', icon: StickyNote, color: 'text-gray-600' },
];

export function Documents() {
  const [filter, setFilter] = useState<DocType>('all');
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Documents</h1>
          <p className="text-text-secondary mt-1">Your squad's shared knowledge base</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-brand-accent hover:bg-brand-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />
          New Document
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent text-sm"
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          {DOC_TYPES.map((dt) => (
            <button
              key={dt.key}
              onClick={() => setFilter(dt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === dt.key
                  ? 'bg-brand-accent text-white'
                  : 'bg-surface-light text-text-secondary hover:text-text-primary'
              }`}
            >
              {dt.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText size={48} className="text-text-muted mb-4" />
          <h3 className="text-lg font-medium text-text-primary">No documents yet</h3>
          <p className="text-text-secondary text-sm mt-1 max-w-md">
            Documents are your squad's shared brain. Create documents to share knowledge, templates, and guidelines across all your agents.
          </p>
          <button className="mt-4 inline-flex items-center gap-2 bg-brand-accent hover:bg-brand-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} />
            Create your first document
          </button>
        </div>
      </Card>
    </div>
  );
}
