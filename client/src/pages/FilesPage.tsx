import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, FileText, Download, Search } from 'lucide-react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatsCard } from '../components/ui/StatsCard';
import { apiGet } from '../api/client';

interface Document {
  id: string;
  title: string;
  content?: string;
  created_at: string;
  updated_at?: string;
}

interface Deliverable {
  id: string;
  filename: string;
  file_type?: string;
  file_size?: number;
  created_at: string;
  task_id?: string;
}

export function FilesPage() {
  const [tab, setTab] = useState<'documents' | 'deliverables'>('documents');
  const [search, setSearch] = useState('');

  const { data: docsData } = useQuery({
    queryKey: ['documents-files'],
    queryFn: () => apiGet<{ documents: Document[] }>('/v1/documents'),
    retry: false,
  });

  const documents = (docsData?.documents || []).filter(d =>
    !search || d.title.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (s: string) => {
    try { return new Date(s).toLocaleDateString(); } catch { return s; }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Files</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Documents and deliverables</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatsCard title="Documents" value={docsData?.documents?.length || 0} icon={<FileText size={18} />} iconColor="var(--info)" />
        <StatsCard title="Deliverables" value="–" icon={<FolderOpen size={18} />} iconColor="var(--type-file)" />
      </div>

      <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex gap-1">
            {(['documents', 'deliverables'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{ padding: '5px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer', border: 'none', backgroundColor: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? 'white' : 'var(--text-muted)' }}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '6px', paddingBottom: '6px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', width: '200px', outline: 'none' }}
            />
          </div>
        </div>

        {tab === 'documents' && (
          <div>
            {documents.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p>No documents found</p>
              </div>
            ) : (
              documents.map((doc, i) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-4"
                  style={{ padding: '14px 20px', borderBottom: i < documents.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background-color 150ms' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--info-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={16} style={{ color: 'var(--info)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{doc.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {doc.content ? `${doc.content.slice(0, 80)}...` : 'No preview'} · {formatDate(doc.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'deliverables' && (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FolderOpen size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p>Browse task deliverables by visiting individual tasks</p>
          </div>
        )}
      </div>
    </div>
  );
}
