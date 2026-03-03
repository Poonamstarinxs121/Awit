import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Store, ExternalLink, Download, Trash2, Package, ChevronUp, ChevronDown } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../api/client';

interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  risk: 'safe' | 'moderate' | 'high';
  pack_id: string;
  pack_name: string;
  pack_slug: string;
  source_url: string | null;
  installed_at: string | null;
}

const RISK_CONFIG = {
  safe:     { label: 'SAFE',     bg: 'rgba(50,215,75,0.12)',   text: '#32D74B', border: 'rgba(50,215,75,0.25)' },
  moderate: { label: 'MODERATE', bg: 'rgba(255,159,10,0.12)',  text: '#FF9F0A', border: 'rgba(255,159,10,0.25)' },
  high:     { label: 'HIGH',     bg: 'rgba(255,69,58,0.12)',   text: '#FF453A', border: 'rgba(255,69,58,0.25)' },
};

type SortKey = 'name' | 'pack_name' | 'category' | 'risk' | 'installed_at';
type SortDir = 'asc' | 'desc';

function RiskBadge({ risk }: { risk: 'safe' | 'moderate' | 'high' }) {
  const cfg = RISK_CONFIG[risk] || RISK_CONFIG.safe;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px',
      fontWeight: 700, letterSpacing: '0.05em', fontFamily: 'var(--font-mono)',
      backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  );
}

export function MarketplacePage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [risk, setRisk] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-skills'],
    queryFn: () => apiGet<{ skills: Skill[]; total: number }>('/v1/marketplace/skills'),
  });

  const installMutation = useMutation({
    mutationFn: (skillId: string) => apiPost(`/v1/marketplace/skills/${skillId}/install`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace-skills'] }),
  });

  const uninstallMutation = useMutation({
    mutationFn: (skillId: string) => apiDelete(`/v1/marketplace/skills/${skillId}/install`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace-skills'] }),
  });

  const allSkills = data?.skills ?? [];

  const categories = useMemo(() => {
    const cats = [...new Set(allSkills.map(s => s.category))].sort();
    return cats;
  }, [allSkills]);

  const filtered = useMemo(() => {
    let list = allSkills.filter(s => {
      const qLower = q.toLowerCase();
      if (q && !(
        s.name.toLowerCase().includes(qLower) ||
        (s.description || '').toLowerCase().includes(qLower) ||
        s.category.toLowerCase().includes(qLower) ||
        s.pack_name.toLowerCase().includes(qLower)
      )) return false;
      if (category !== 'all' && s.category !== category) return false;
      if (risk !== 'all' && s.risk !== risk) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      let av = a[sortKey] ?? '';
      let bv = b[sortKey] ?? '';
      if (sortKey === 'installed_at') {
        av = av ? '1' : '0';
        bv = bv ? '1' : '0';
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [allSkills, q, category, risk, sortKey, sortDir]);

  const installedCount = allSkills.filter(s => s.installed_at).length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span style={{ opacity: 0.3 }}><ChevronUp size={11} /></span>;
    return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            Skills Marketplace
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {isLoading ? 'Loading skills...' : `${allSkills.length} skills synced from packs. ${installedCount} installed.`}
          </p>
        </div>
        <Link
          to="/packs"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
            borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-elevated)',
            color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: 500,
          }}
        >
          <Package size={14} />
          Manage Packs
        </Link>
      </div>

      <div style={{
        display: 'flex', gap: '10px', marginBottom: '20px',
        padding: '12px 16px', backgroundColor: 'var(--card)',
        border: '1px solid var(--border)', borderRadius: '10px',
        alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by name, description, category, pack, source..."
            style={{
              width: '100%', paddingLeft: '36px', padding: '9px 12px 9px 36px',
              backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
              borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Category</span>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{
              padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)',
              fontSize: '13px', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="all">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Risk</span>
          <select
            value={risk}
            onChange={e => setRisk(e.target.value)}
            style={{
              padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)',
              backgroundColor: 'var(--surface-elevated)', color: 'var(--text-primary)',
              fontSize: '13px', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="all">All risks</option>
            <option value="safe">Safe</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-elevated)' }}>
              <th style={thStyle} onClick={() => toggleSort('name')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Skill <SortIcon col="name" /></span>
              </th>
              <th style={thStyle} onClick={() => toggleSort('pack_name')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Pack <SortIcon col="pack_name" /></span>
              </th>
              <th style={thStyle} onClick={() => toggleSort('category')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Category <SortIcon col="category" /></span>
              </th>
              <th style={thStyle} onClick={() => toggleSort('risk')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Risk <SortIcon col="risk" /></span>
              </th>
              <th style={thStyle}>Source</th>
              <th style={thStyle} onClick={() => toggleSort('installed_at')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Installed On <SortIcon col="installed_at" /></span>
              </th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Loading skills...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '48px', textAlign: 'center' }}>
                  <Store size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>No skills match your filters</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Try adjusting your search or filter criteria</p>
                </td>
              </tr>
            ) : (
              filtered.map((skill, i) => {
                const isInstalling = installMutation.isPending && installMutation.variables === skill.id;
                const isUninstalling = uninstallMutation.isPending && uninstallMutation.variables === skill.id;
                const isBusy = isInstalling || isUninstalling;

                return (
                  <tr
                    key={skill.id}
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                      transition: 'background-color 100ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '12px 14px', maxWidth: '280px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {skill.name}
                      </p>
                      {skill.description && (
                        <p style={{
                          fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {skill.description}
                        </p>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '5px', fontSize: '11px',
                        fontWeight: 500, backgroundColor: 'var(--accent-soft)', color: 'var(--accent)',
                        maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {skill.pack_name}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {skill.category}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <RiskBadge risk={skill.risk} />
                    </td>
                    <td style={{ padding: '12px 14px', maxWidth: '160px' }}>
                      {skill.source_url ? (
                        <a
                          href={skill.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--info)', textDecoration: 'none', overflow: 'hidden' }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {skill.source_url.replace(/^https?:\/\//, '')}
                          </span>
                          <ExternalLink size={10} style={{ flexShrink: 0 }} />
                        </a>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {skill.installed_at ? (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(skill.installed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {skill.installed_at ? (
                        <button
                          onClick={() => uninstallMutation.mutate(skill.id)}
                          disabled={isBusy}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                            border: '1px solid rgba(255,69,58,0.3)', backgroundColor: 'rgba(255,69,58,0.06)',
                            color: '#FF453A', cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1,
                          }}
                        >
                          <Trash2 size={11} />
                          {isUninstalling ? 'Removing...' : 'Uninstall'}
                        </button>
                      ) : (
                        <button
                          onClick={() => installMutation.mutate(skill.id)}
                          disabled={isBusy}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                            border: 'none', backgroundColor: 'var(--accent)', color: '#fff',
                            cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1,
                          }}
                        >
                          <Download size={11} />
                          {isInstalling ? 'Installing...' : 'Install'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {filtered.length > 0 && (
          <div style={{
            padding: '10px 14px', borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--surface-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Showing {filtered.length} of {allSkills.length} skills
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {installedCount} installed
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
