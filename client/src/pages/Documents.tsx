import { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client';
import {
  Search, Plus, FileText, ClipboardList, Microscope, ScrollText, CheckSquare,
  StickyNote, File, Pencil, Trash2, ArrowLeft, X
} from 'lucide-react';

type DocType = 'deliverable' | 'brief' | 'research' | 'protocol' | 'checklist' | 'note';
type FilterType = 'all' | DocType;

interface Document {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  type: DocType;
  task_id: string | null;
  agent_id: string | null;
  agent_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const DOC_TYPES: { key: FilterType; label: string; icon: typeof FileText; color: string }[] = [
  { key: 'all', label: 'All', icon: File, color: 'text-text-secondary' },
  { key: 'deliverable', label: 'Deliverable', icon: FileText, color: 'text-blue-600' },
  { key: 'brief', label: 'Brief', icon: ClipboardList, color: 'text-purple-600' },
  { key: 'research', label: 'Research', icon: Microscope, color: 'text-green-600' },
  { key: 'protocol', label: 'Protocol', icon: ScrollText, color: 'text-amber-600' },
  { key: 'checklist', label: 'Checklist', icon: CheckSquare, color: 'text-teal-600' },
  { key: 'note', label: 'Note', icon: StickyNote, color: 'text-gray-600' },
];

function getDocIcon(type: DocType) {
  const dt = DOC_TYPES.find(d => d.key === type);
  if (!dt) return { Icon: FileText, color: 'text-text-secondary' };
  return { Icon: dt.icon, color: dt.color };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Documents() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<DocType>('note');
  const [formContent, setFormContent] = useState('');
  const [formTaskId, setFormTaskId] = useState('');

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('type', filter);
      if (search.trim()) params.set('search', search.trim());
      const qs = params.toString();
      const data = await apiGet<{ documents: Document[] }>(`/v1/documents${qs ? `?${qs}` : ''}`);
      setDocuments(data.documents);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDocuments();
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchDocuments, search]);

  const resetForm = () => {
    setFormTitle('');
    setFormType('note');
    setFormContent('');
    setFormTaskId('');
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) return;
    try {
      setCreating(true);
      await apiPost('/v1/documents', {
        title: formTitle.trim(),
        type: formType,
        content: formContent,
        task_id: formTaskId.trim() || null,
      });
      setShowCreate(false);
      resetForm();
      fetchDocuments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = () => {
    if (!selectedDoc) return;
    setFormTitle(selectedDoc.title);
    setFormType(selectedDoc.type);
    setFormContent(selectedDoc.content);
    setFormTaskId(selectedDoc.task_id || '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!selectedDoc || !formTitle.trim()) return;
    try {
      setSaving(true);
      const data = await apiPatch<{ document: Document }>(`/v1/documents/${selectedDoc.id}`, {
        title: formTitle.trim(),
        type: formType,
        content: formContent,
        task_id: formTaskId.trim() || null,
      });
      setSelectedDoc(data.document);
      setEditing(false);
      fetchDocuments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update document');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      await apiDelete(`/v1/documents/${id}`);
      setDeleteConfirm(null);
      if (selectedDoc?.id === id) setSelectedDoc(null);
      fetchDocuments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  if (selectedDoc && !editing) {
    const { Icon, color } = getDocIcon(selectedDoc.type);
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedDoc(null)}
          className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Documents
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Icon size={24} className={color} />
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{selectedDoc.title}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-text-secondary">
                <span className="capitalize">{selectedDoc.type}</span>
                <span>·</span>
                <span>{formatDate(selectedDoc.updated_at)}</span>
                {selectedDoc.agent_name && (
                  <>
                    <span>·</span>
                    <span>{selectedDoc.agent_name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openEdit}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-lg transition-colors"
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              onClick={() => setDeleteConfirm(selectedDoc.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 border border-red-200 rounded-lg transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>

        <Card>
          <div className="p-6 whitespace-pre-wrap text-text-primary text-sm leading-relaxed min-h-[200px]">
            {selectedDoc.content || <span className="text-text-muted italic">No content</span>}
          </div>
        </Card>

        {deleteConfirm && (
          <Modal open={true} onClose={() => setDeleteConfirm(null)} title="Delete Document">
            <p className="text-text-secondary text-sm mb-4">
              Are you sure you want to delete "{selectedDoc.title}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-text-secondary border border-border-default rounded-lg hover:bg-surface-light transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  if (selectedDoc && editing) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setEditing(false)}
          className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary text-sm transition-colors"
        >
          <X size={16} />
          Cancel editing
        </button>

        <h1 className="text-2xl font-bold text-text-primary">Edit Document</h1>

        <Card>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as DocType)}
                className="w-full px-3 py-2 bg-white border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
              >
                {DOC_TYPES.filter(d => d.key !== 'all').map(dt => (
                  <option key={dt.key} value={dt.key}>{dt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Content</label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 bg-white border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Task ID (optional)</label>
              <input
                type="text"
                value={formTaskId}
                onChange={(e) => setFormTaskId(e.target.value)}
                placeholder="Link to a task by ID"
                className="w-full px-3 py-2 bg-white border border-border-default rounded-lg text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm text-text-secondary border border-border-default rounded-lg hover:bg-surface-light transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formTitle.trim()}
                className="px-4 py-2 text-sm text-white bg-brand-accent hover:bg-brand-accent-hover rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Documents</h1>
          <p className="text-text-secondary mt-1">Your squad's shared knowledge base</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-brand-accent hover:bg-brand-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText size={48} className="text-text-muted mb-4" />
            <h3 className="text-lg font-medium text-text-primary">No documents yet</h3>
            <p className="text-text-secondary text-sm mt-1 max-w-md">
              Documents are your squad's shared brain. Create documents to share knowledge, templates, and guidelines across all your agents.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 bg-brand-accent hover:bg-brand-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Create your first document
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const { Icon, color } = getDocIcon(doc.type);
            return (
              <Card key={doc.id}>
                <button
                  onClick={() => setSelectedDoc(doc)}
                  className="w-full text-left p-4 hover:bg-surface-light transition-colors rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <Icon size={20} className={`${color} mt-0.5 flex-shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-text-primary truncate">{doc.title}</h3>
                      <p className="text-xs text-text-secondary mt-1 capitalize">{doc.type}</p>
                      <p className="text-xs text-text-muted mt-1 line-clamp-2">
                        {doc.content || 'No content'}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-text-muted">
                        <span>{formatDate(doc.updated_at)}</span>
                        {doc.agent_name && (
                          <>
                            <span>·</span>
                            <span>{doc.agent_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Document">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Title</label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Document title"
              className="w-full px-3 py-2 bg-white border border-border-default rounded-lg text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Type</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as DocType)}
              className="w-full px-3 py-2 bg-white border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              {DOC_TYPES.filter(d => d.key !== 'all').map(dt => (
                <option key={dt.key} value={dt.key}>{dt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Content</label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={8}
              placeholder="Write your document content..."
              className="w-full px-3 py-2 bg-white border border-border-default rounded-lg text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Task ID (optional)</label>
            <input
              type="text"
              value={formTaskId}
              onChange={(e) => setFormTaskId(e.target.value)}
              placeholder="Link to a task by ID"
              className="w-full px-3 py-2 bg-white border border-border-default rounded-lg text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-text-secondary border border-border-default rounded-lg hover:bg-surface-light transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !formTitle.trim()}
              className="px-4 py-2 text-sm text-white bg-brand-accent hover:bg-brand-accent-hover rounded-lg transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Document'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
