import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package, Plus, RefreshCw, Trash2, ExternalLink, X, AlertTriangle, Store, Clock } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../api/client';

interface Pack {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  source_url: string | null;
  is_builtin: boolean;
  last_synced_at: string | null;
  created_at: string;
  skill_count: number;
  installed_count: number;
}

export function PacksPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', source_url: '', description: '' });
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-packs'],
    queryFn: () => apiGet<{ packs: Pack[] }>('/v1/marketplace/packs'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; source_url: string; description: string }) =>
      apiPost('/v1/marketplace/packs', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-packs'] });
      setAddOpen(false);
      setForm({ name: '', source_url: '', description: '' });
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(err?.message || 'Failed to create pack');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/v1/marketplace/packs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-packs'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-skills'] });
      setConfirmDeleteId(null);
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/v1/marketplace/packs/${id}/sync`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace-packs'] }),
  });

  const packs = data?.packs ?? [];
  const totalSkills = packs.reduce((sum, p) => sum + p.skill_count, 0);

  function handleCreate() {
    if (!form.name.trim()) { setFormError('Pack name is required'); return; }
    setFormError('');
    createMutation.mutate(form);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            Skill Packs
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Manage skill pack sources. Browse the <Link to="/marketplace" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Marketplace</Link> to install individual skills.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px',
            borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent)',
            color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          Add Pack
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Packs', value: packs.length, color: '#60A5FA' },
          { label: 'Total Skills', value: totalSkills, color: '#32D74B' },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '6px' }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {addOpen && (
        <div style={{
          backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px',
          padding: '20px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Add Custom Pack
            </h3>
            <button onClick={() => { setAddOpen(false); setFormError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: '5px' }}>Pack Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. My Custom Pack"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '8px',
                  backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: '5px' }}>Source URL (optional)</label>
              <input
                value={form.source_url}
                onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))}
                placeholder="https://github.com/..."
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '8px',
                  backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: '5px' }}>Description</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What does this pack provide?"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '8px',
                backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {formError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '7px', backgroundColor: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)', marginBottom: '12px' }}>
              <AlertTriangle size={13} style={{ color: '#FF453A', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#FF453A' }}>{formError}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              style={{
                padding: '8px 16px', borderRadius: '7px', border: 'none',
                backgroundColor: 'var(--accent)', color: '#fff', fontSize: '13px',
                fontWeight: 600, cursor: 'pointer', opacity: createMutation.isPending ? 0.7 : 1,
              }}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Pack'}
            </button>
            <button
              onClick={() => { setAddOpen(false); setFormError(''); }}
              style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading packs...</div>
        ) : packs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <Package size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No packs found</p>
          </div>
        ) : packs.map(pack => {
          const isSyncing = syncMutation.isPending && syncMutation.variables === pack.id;
          const isDeleting = deleteMutation.isPending && deleteMutation.variables === pack.id;
          const isConfirming = confirmDeleteId === pack.id;

          return (
            <div
              key={pack.id}
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '7px', backgroundColor: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Package size={15} style={{ color: 'var(--accent)' }} />
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {pack.name}
                    </h3>
                    {pack.is_builtin && (
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', backgroundColor: 'rgba(100,210,255,0.1)', color: '#64D2FF', border: '1px solid rgba(100,210,255,0.2)' }}>
                        BUILT-IN
                      </span>
                    )}
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '5px', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      {pack.skill_count} skill{pack.skill_count !== 1 ? 's' : ''}
                    </span>
                    {pack.installed_count > 0 && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '5px', backgroundColor: 'rgba(50,215,75,0.08)', color: '#32D74B', border: '1px solid rgba(50,215,75,0.2)' }}>
                        {pack.installed_count} installed
                      </span>
                    )}
                  </div>

                  {pack.description && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '40px', marginBottom: '4px', lineHeight: 1.5 }}>
                      {pack.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '40px', marginTop: '6px' }}>
                    {pack.source_url ? (
                      <a href={pack.source_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--info)', textDecoration: 'none' }}>
                        <ExternalLink size={10} />
                        {pack.source_url.replace(/^https?:\/\//, '').substring(0, 50)}
                      </a>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{pack.slug}</span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <Clock size={10} />
                      {pack.last_synced_at ? `Synced ${new Date(pack.last_synced_at).toLocaleDateString()}` : 'Never synced'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <Link
                    to={`/marketplace?pack_id=${pack.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px',
                      borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-elevated)',
                      color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '11px', fontWeight: 500,
                    }}
                  >
                    <Store size={11} />
                    Browse
                  </Link>

                  <button
                    onClick={() => syncMutation.mutate(pack.id)}
                    disabled={isSyncing}
                    title="Sync pack"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px',
                      borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-elevated)',
                      color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500,
                      cursor: isSyncing ? 'not-allowed' : 'pointer', opacity: isSyncing ? 0.6 : 1,
                    }}
                  >
                    <RefreshCw size={11} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
                    {isSyncing ? 'Syncing...' : 'Sync'}
                  </button>

                  {!pack.is_builtin && (
                    isConfirming ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#FF453A', fontWeight: 500 }}>Delete?</span>
                        <button
                          onClick={() => deleteMutation.mutate(pack.id)}
                          disabled={isDeleting}
                          style={{ padding: '4px 10px', borderRadius: '5px', border: 'none', backgroundColor: '#FF453A', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          {isDeleting ? '...' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer' }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(pack.id)}
                        title="Delete pack"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px',
                          borderRadius: '6px', border: '1px solid rgba(255,69,58,0.25)',
                          backgroundColor: 'rgba(255,69,58,0.06)', color: '#FF453A',
                          fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={11} />
                        Delete
                      </button>
                    )
                  )}

                  {pack.is_builtin && (
                    <span title="Built-in packs cannot be deleted" style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '6px 10px' }}>
                      Protected
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
