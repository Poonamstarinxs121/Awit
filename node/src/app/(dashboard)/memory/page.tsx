'use client';

import { useEffect, useState, useCallback } from 'react';
import { Brain, Save, Eye, EyeOff, Plus, AlertTriangle, ChevronDown } from 'lucide-react';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface Agent {
  id: string;
  name: string;
  workspace: string;
  model?: string;
  status: string;
}

const MEMORY_FILES = [
  { key: 'SOUL', label: 'SOUL.md' },
  { key: 'AGENTS', label: 'AGENTS.md' },
  { key: 'TOOLS', label: 'TOOLS.md' },
  { key: 'MEMORY', label: 'MEMORY.md' },
  { key: 'HEARTBEAT', label: 'HEARTBEAT.md' },
  { key: 'IDENTITY', label: 'IDENTITY.md' },
];

export default function MemoryPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [activeTab, setActiveTab] = useState('SOUL');
  const [fileContents, setFileContents] = useState<Record<string, string | null>>({});
  const [editorContent, setEditorContent] = useState('');
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [fileExistence, setFileExistence] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => {
        const list = d.agents || [];
        setAgents(list);
        if (list.length > 0) setSelectedAgent(list[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadAgentFiles = useCallback(async (agent: Agent) => {
    const contents: Record<string, string | null> = {};
    const existence: Record<string, boolean> = {};

    await Promise.all(
      MEMORY_FILES.map(async (file) => {
        const filePath = `${agent.workspace}/${file.label}`;
        const relativePath = filePath.replace(/^.*\.openclaw\//, '');
        try {
          const res = await fetch(`/api/files/read?path=${encodeURIComponent(relativePath)}`);
          if (res.ok) {
            const data = await res.json();
            contents[file.key] = data.content;
            existence[file.key] = true;
          } else {
            contents[file.key] = null;
            existence[file.key] = false;
          }
        } catch {
          contents[file.key] = null;
          existence[file.key] = false;
        }
      })
    );

    setFileContents(contents);
    setFileExistence(existence);
    const current = contents[activeTab];
    setEditorContent(current || '');
    setOriginalContent(current);
  }, [activeTab]);

  useEffect(() => {
    if (selectedAgent) {
      loadAgentFiles(selectedAgent);
    }
  }, [selectedAgent, loadAgentFiles]);

  useEffect(() => {
    const current = fileContents[activeTab];
    setEditorContent(current || '');
    setOriginalContent(current);
    setShowPreview(false);
  }, [activeTab, fileContents]);

  const hasUnsavedChanges = editorContent !== (originalContent || '');

  const getFilePath = () => {
    if (!selectedAgent) return '';
    const file = MEMORY_FILES.find(f => f.key === activeTab);
    if (!file) return '';
    const fullPath = `${selectedAgent.workspace}/${file.label}`;
    return fullPath.replace(/^.*\.openclaw\//, '');
  };

  const handleSave = async () => {
    setShowConfirm(true);
  };

  const confirmSave = async () => {
    setShowConfirm(false);
    setSaving(true);
    try {
      const filePath = getFilePath();
      const res = await fetch('/api/files/write', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: editorContent }),
      });
      if (res.ok) {
        setOriginalContent(editorContent);
        setFileContents(prev => ({ ...prev, [activeTab]: editorContent }));
        setFileExistence(prev => ({ ...prev, [activeTab]: true }));
      }
    } catch {}
    setSaving(false);
  };

  const handleCreate = async () => {
    setEditorContent(`# ${activeTab}\n\n`);
    setOriginalContent(null);
    setFileExistence(prev => ({ ...prev, [activeTab]: false }));
  };

  const renderMarkdownPreview = (content: string) => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    lines.forEach((line, i) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${i}`} style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 12,
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              overflowX: 'auto',
              marginBottom: 12,
            }}>{codeLines.join('\n')}</pre>
          );
          codeLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        return;
      }

      if (line.startsWith('### ')) {
        elements.push(<h3 key={i} style={{ fontSize: 16, fontWeight: 600, margin: '16px 0 8px', fontFamily: 'var(--font-heading)' }}>{line.slice(4)}</h3>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={i} style={{ fontSize: 18, fontWeight: 600, margin: '20px 0 10px', fontFamily: 'var(--font-heading)' }}>{line.slice(3)}</h2>);
      } else if (line.startsWith('# ')) {
        elements.push(<h1 key={i} style={{ fontSize: 22, fontWeight: 700, margin: '24px 0 12px', fontFamily: 'var(--font-heading)' }}>{line.slice(2)}</h1>);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(<li key={i} style={{ marginLeft: 20, marginBottom: 4, fontSize: 13, lineHeight: 1.6 }}>{line.slice(2)}</li>);
      } else if (line.startsWith('> ')) {
        elements.push(
          <blockquote key={i} style={{
            borderLeft: '3px solid var(--accent)',
            paddingLeft: 12,
            color: 'var(--text-secondary)',
            margin: '8px 0',
            fontSize: 13,
            fontStyle: 'italic',
          }}>{line.slice(2)}</blockquote>
        );
      } else if (line.trim() === '') {
        elements.push(<div key={i} style={{ height: 8 }} />);
      } else {
        elements.push(<p key={i} style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 6, color: 'var(--text-secondary)' }}>{line}</p>);
      }
    });

    return elements;
  };

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading agents...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Brain size={22} />
          Memory Browser
        </h1>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 16px',
            color: 'var(--text-primary)',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 220,
          }}
        >
          {selectedAgent ? (
            <>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: selectedAgent.status === 'active' ? 'var(--positive)' : 'var(--text-muted)',
              }} />
              {selectedAgent.name}
              {selectedAgent.model && (
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  ({selectedAgent.model})
                </span>
              )}
            </>
          ) : 'Select Agent'}
          <ChevronDown size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
        </button>

        {dropdownOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 4,
            minWidth: 220,
            zIndex: 50,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {agents.length === 0 ? (
              <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>No agents found</div>
            ) : agents.map(agent => (
              <div
                key={agent.id}
                onClick={() => { setSelectedAgent(agent); setDropdownOpen(false); }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: selectedAgent?.id === agent.id ? 'var(--accent-soft)' : 'transparent',
                  color: selectedAgent?.id === agent.id ? 'var(--accent)' : 'var(--text-primary)',
                  fontSize: 13,
                }}
              >
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: agent.status === 'active' ? 'var(--positive)' : 'var(--text-muted)',
                }} />
                {agent.name}
                {agent.model && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {agent.model}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!selectedAgent ? (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 60,
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}>
          <Brain size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 500 }}>Select an agent to browse memory files</div>
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            overflowX: 'auto',
          }}>
            {MEMORY_FILES.map(file => {
              const isActive = activeTab === file.key;
              const exists = fileExistence[file.key];
              return (
                <button
                  key={file.key}
                  onClick={() => setActiveTab(file.key)}
                  style={{
                    background: isActive ? 'var(--surface-elevated)' : 'transparent',
                    border: 'none',
                    borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    padding: '10px 16px',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {file.label}
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: exists ? 'var(--positive)' : 'var(--text-muted)',
                    opacity: exists ? 1 : 0.4,
                  }} />
                  {isActive && hasUnsavedChanges && (
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--warning)',
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--background)',
          }}>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {selectedAgent.name} / {MEMORY_FILES.find(f => f.key === activeTab)?.label}
              {hasUnsavedChanges && <span style={{ color: 'var(--warning)', marginLeft: 8 }}>● unsaved</span>}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowPreview(!showPreview)}
                style={{
                  background: showPreview ? 'var(--accent-soft)' : 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  color: showPreview ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
                {showPreview ? 'Editor' : 'Preview'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                style={{
                  background: hasUnsavedChanges ? 'var(--accent)' : 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '4px 12px',
                  color: hasUnsavedChanges ? '#fff' : 'var(--text-muted)',
                  fontSize: 12,
                  cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: 500,
                  opacity: hasUnsavedChanges ? 1 : 0.5,
                }}
              >
                <Save size={12} />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {fileExistence[activeTab] === false && originalContent === null && editorContent === '' ? (
            <div style={{
              padding: 60,
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}>
              <Brain size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontSize: 14, marginBottom: 4 }}>
                This agent has no {MEMORY_FILES.find(f => f.key === activeTab)?.label} yet
              </div>
              <div style={{ fontSize: 12, marginBottom: 16, color: 'var(--text-muted)' }}>
                Create one to define this aspect of the agent&apos;s behavior
              </div>
              <button
                onClick={handleCreate}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 20px',
                  color: '#fff',
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 500,
                }}
              >
                <Plus size={14} />
                Create {MEMORY_FILES.find(f => f.key === activeTab)?.label}
              </button>
            </div>
          ) : showPreview ? (
            <div style={{
              padding: 24,
              minHeight: 400,
              maxHeight: 'calc(100vh - 320px)',
              overflowY: 'auto',
            }}>
              {renderMarkdownPreview(editorContent)}
            </div>
          ) : (
            <div style={{ height: 'calc(100vh - 320px)', minHeight: 400 }}>
              <MonacoEditor
                height="100%"
                language="markdown"
                theme="vs-dark"
                value={editorContent}
                onChange={(value) => setEditorContent(value || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  renderLineHighlight: 'gutter',
                  cursorBlinking: 'smooth',
                  automaticLayout: true,
                }}
                onMount={(editor) => {
                  editor.addCommand(
                    2048 | 49,
                    () => { handleSave(); }
                  );
                }}
              />
            </div>
          )}
        </div>
      )}

      {showConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 24,
            maxWidth: 400,
            width: '90%',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={20} style={{ color: 'var(--warning)' }} />
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600 }}>Confirm Save</h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              This will change agent behavior — are you sure? Modifying{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {MEMORY_FILES.find(f => f.key === activeTab)?.label}
              </strong>{' '}
              for agent{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{selectedAgent?.name}</strong>.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 16px',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSave}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  color: '#fff',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
