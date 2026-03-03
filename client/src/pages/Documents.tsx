import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client';
import {
  Search, Plus, FileText, ClipboardList, Microscope, ScrollText, CheckSquare,
  StickyNote, File, Pencil, Trash2, ArrowLeft, X, Info, Clock
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

const DOC_TYPES: { key: FilterType; label: string; icon: typeof FileText; color: string; bg: string }[] = [
  { key: 'all', label: 'All', icon: File, color: 'var(--text-secondary)', bg: 'transparent' },
  { key: 'deliverable', label: 'Deliverable', icon: FileText, color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
  { key: 'brief', label: 'Brief', icon: ClipboardList, color: '#BF5AF2', bg: 'rgba(191,90,242,0.1)' },
  { key: 'research', label: 'Research', icon: Microscope, color: '#32D74B', bg: 'rgba(50,215,75,0.1)' },
  { key: 'protocol', label: 'Protocol', icon: ScrollText, color: '#FF9F0A', bg: 'rgba(255,159,10,0.1)' },
  { key: 'checklist', label: 'Checklist', icon: CheckSquare, color: '#64D2FF', bg: 'rgba(100,210,255,0.1)' },
  { key: 'note', label: 'Note', icon: StickyNote, color: 'var(--text-muted)', bg: 'rgba(150,150,150,0.08)' },
];

function getDocConfig(type: DocType) {
  const dt = DOC_TYPES.find(d => d.key === type);
  if (!dt) return { Icon: FileText, color: 'var(--text-secondary)', bg: 'transparent' };
  return { Icon: dt.icon, color: dt.color, bg: dt.bg };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)',
  marginBottom: '5px', letterSpacing: '0.02em',
};

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
    const timer = setTimeout(() => { fetchDocuments(); }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchDocuments, search]);

  const resetForm = () => { setFormTitle(''); setFormType('note'); setFormContent(''); setFormTaskId(''); };
  const openCreate = () => { resetForm(); setShowCreate(true); };

  const handleCreate = async () => {
    if (!formTitle.trim()) return;
    try {
      setCreating(true);
      await apiPost('/v1/documents', { title: formTitle.trim(), type: formType, content: formContent, task_id: formTaskId.trim() || null });
      setShowCreate(false);
      resetForm();
      fetchDocuments();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to create document'); }
    finally { setCreating(false); }
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
      const data = await apiPatch<{ document: Document }>(`/v1/documents/${selectedDoc.id}`, { title: formTitle.trim(), type: formType, content: formContent, task_id: formTaskId.trim() || null });
      setSelectedDoc(data.document);
      setEditing(false);
      fetchDocuments();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to update document'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      await apiDelete(`/v1/documents/${id}`);
      setDeleteConfirm(null);
      if (selectedDoc?.id === id) setSelectedDoc(null);
      fetchDocuments();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to delete document'); }
    finally { setDeleting(false); }
  };

  if (selectedDoc && !editing) {
    const { Icon, color } = getDocConfig(selectedDoc.type);
    return (
      <div>
        <button
          onClick={() => setSelectedDoc(null)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', padding: '6px 0' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <ArrowLeft size={15} /> Back to Documents
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: getDocConfig(selectedDoc.type).bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>{selectedDoc.title}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span style={{ textTransform: 'capitalize', color, fontWeight: 600 }}>{selectedDoc.type}</span>
                <span style={{ opacity: 0.4 }}>|</span>
                <span>{formatDate(selectedDoc.updated_at)}</span>
                {selectedDoc.agent_name && (<><span style={{ opacity: 0.4 }}>|</span><span>{selectedDoc.agent_name}</span></>)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={openEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '7px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
              <Pencil size={13} /> Edit
            </button>
            <button onClick={() => setDeleteConfirm(selectedDoc.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '7px', border: '1px solid rgba(255,69,58,0.3)', backgroundColor: 'rgba(255,69,58,0.06)', color: '#FF453A', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: 1.7, color: 'var(--text-primary)', minHeight: '200px' }}>
          {selectedDoc.content || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No content</span>}
        </div>

        {deleteConfirm && (
          <Modal open={true} onClose={() => setDeleteConfirm(null)} title="Delete Document">
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Are you sure you want to delete "<strong>{selectedDoc.title}</strong>"? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting} style={{ padding: '8px 16px', borderRadius: '7px', border: 'none', backgroundColor: '#FF453A', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}>
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
      <div>
        <button onClick={() => setEditing(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', padding: '6px 0' }}>
          <X size={15} /> Cancel editing
        </button>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' }}>Edit Document</h1>
        <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} style={inputStyle} onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value as DocType)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {DOC_TYPES.filter(d => d.key !== 'all').map(dt => <option key={dt.key} value={dt.key}>{dt.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Content</label>
            <textarea value={formContent} onChange={e => setFormContent(e.target.value)} rows={14} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }} onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Task ID (optional)</label>
            <input type="text" value={formTaskId} onChange={e => setFormTaskId(e.target.value)} placeholder="Link to a task by ID" style={inputStyle} onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button onClick={() => setEditing(false)} style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !formTitle.trim()} style={{ padding: '8px 16px', borderRadius: '7px', border: 'none', backgroundColor: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: saving || !formTitle.trim() ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const typeCounts = DOC_TYPES.filter(d => d.key !== 'all').map(dt => ({
    ...dt,
    count: documents.filter(d => d.type === dt.key).length,
  }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Documents</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Your squad's shared knowledge base</p>
        </div>
        <button onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} /> New Document
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            backgroundColor: filter === 'all' ? 'var(--accent-soft)' : 'var(--card)',
            border: `1px solid ${filter === 'all' ? 'rgba(255,59,48,0.2)' : 'var(--border)'}`,
            borderRadius: '10px', padding: '12px 14px', cursor: 'pointer',
            transition: 'all 150ms', textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <File size={13} style={{ color: filter === 'all' ? 'var(--accent)' : 'var(--text-muted)' }} />
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>All</span>
          </div>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: filter === 'all' ? 'var(--accent)' : 'var(--text-primary)' }}>
            {documents.length}
          </span>
        </button>
        {typeCounts.map(dt => (
          <button
            key={dt.key}
            onClick={() => setFilter(dt.key === filter ? 'all' : dt.key as FilterType)}
            style={{
              backgroundColor: filter === dt.key ? `${dt.bg}` : 'var(--card)',
              border: `1px solid ${filter === dt.key ? `${dt.color}33` : 'var(--border)'}`,
              borderRadius: '10px', padding: '12px 14px', cursor: 'pointer',
              transition: 'all 150ms', textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <dt.icon size={13} style={{ color: dt.color }} />
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{dt.label}</span>
            </div>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: filter === dt.key ? dt.color : 'var(--text-primary)' }}>
              {dt.count}
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '8px', marginBottom: '16px' }}>
        <Info size={14} style={{ color: '#60A5FA', flexShrink: 0 }} />
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 600, color: '#60A5FA' }}>Tip:</span> Task file attachments are accessible via the task detail panel on the{' '}
          <a href="/kanban" style={{ color: '#60A5FA', textDecoration: 'none', fontWeight: 500 }}>Board</a>.
          This page is for shared knowledge base documents, protocols, and notes.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', padding: '12px 16px', backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents by title or content..."
            style={{ width: '100%', paddingLeft: '36px', padding: '9px 12px 9px 36px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '7px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>
            <X size={12} /> Clear filter
          </button>
        )}
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(255,69,58,0.06)', border: '1px solid rgba(255,69,58,0.2)', marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', color: '#FF453A', flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#FF453A', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}>Dismiss</button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><Spinner /></div>
      ) : documents.length === 0 ? (
        <div style={{ backgroundColor: 'var(--card)', border: '1px dashed var(--border)', borderRadius: '14px', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <FileText size={26} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          </div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            {filter !== 'all' ? `No ${filter} documents` : 'No documents yet'}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '380px', margin: '0 auto 20px', lineHeight: 1.5 }}>
            Documents are your squad's shared brain. Create documents to share knowledge, templates, and guidelines across all your agents.
          </p>
          <button onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Create your first document
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
          {documents.map(doc => {
            const { Icon, color, bg } = getDocConfig(doc.type);
            return (
              <button
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                style={{
                  width: '100%', textAlign: 'left', padding: '16px 18px',
                  backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: '12px', cursor: 'pointer', transition: 'all 150ms',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = `${color}44`;
                  e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.backgroundColor = 'var(--card)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</h3>
                    <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color, padding: '1px 6px', borderRadius: '4px', backgroundColor: bg, marginBottom: '6px', letterSpacing: '0.03em' }}>{doc.type}</span>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                      {doc.content || 'No content'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Clock size={10} /> {formatRelative(doc.updated_at)}</span>
                      {doc.agent_name && (<><span style={{ opacity: 0.3 }}>|</span><span>{doc.agent_name}</span></>)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Document">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Title *</label>
              <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Document title" style={inputStyle} onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value as DocType)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {DOC_TYPES.filter(d => d.key !== 'all').map(dt => <option key={dt.key} value={dt.key}>{dt.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Content</label>
            <textarea value={formContent} onChange={e => setFormContent(e.target.value)} rows={10} placeholder="Write your document content..." style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
          </div>
          <div>
            <label style={labelStyle}>Task ID (optional)</label>
            <input type="text" value={formTaskId} onChange={e => setFormTaskId(e.target.value)} placeholder="Link to a task by ID" style={inputStyle} onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
            <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleCreate} disabled={creating || !formTitle.trim()} style={{ padding: '8px 16px', borderRadius: '7px', border: 'none', backgroundColor: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: creating || !formTitle.trim() ? 0.6 : 1 }}>
              {creating ? 'Creating...' : 'Create Document'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
