'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Lock, Unlock, FolderOpen, ChevronRight, Info } from 'lucide-react';
import dynamic from 'next/dynamic';
import FileTree from '@/components/FileTree';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    md: 'markdown',
    json: 'json',
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    yaml: 'yaml',
    yml: 'yaml',
    html: 'html',
    css: 'css',
    xml: 'xml',
    sh: 'shell',
    bash: 'shell',
    sql: 'sql',
    toml: 'ini',
    cfg: 'ini',
    env: 'ini',
    rs: 'rust',
    go: 'go',
    rb: 'ruby',
    txt: 'plaintext',
    log: 'plaintext',
  };
  return map[ext] || 'plaintext';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

interface FileInfo {
  name: string;
  path: string;
  size: number;
  modified: string;
  created: string;
  type: string;
}

export default function FilesPage() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const editorRef = useRef<any>(null);

  const hasUnsavedChanges = content !== originalContent;

  const loadFile = useCallback(async (path: string) => {
    setLoading(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load file');
      }
      const data = await res.json();
      setContent(data.content);
      setOriginalContent(data.content);
      setFileInfo(data.info);
      setSelectedPath(path);
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message}`);
    }
    setLoading(false);
  }, []);

  const saveFile = useCallback(async () => {
    if (!selectedPath || readOnly) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/files/write', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedPath, content }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      setOriginalContent(content);
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message}`);
    }
    setSaving(false);
  }, [selectedPath, content, readOnly]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveFile]);

  const breadcrumbs = selectedPath ? selectedPath.split('/') : [];

  return (
    <div style={{ height: 'calc(100vh - 80px - 48px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
          <FolderOpen size={22} style={{ color: 'var(--accent)' }} />
          File Browser
        </h1>
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <FileTree onFileSelect={loadFile} selectedPath={selectedPath} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedPath ? (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                minHeight: 40,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden' }}>
                  {breadcrumbs.map((part, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {i > 0 && <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        color: i === breadcrumbs.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                      }}>
                        {part}
                      </span>
                    </span>
                  ))}
                  {hasUnsavedChanges && (
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--warning)',
                      marginLeft: 8,
                      flexShrink: 0,
                    }} title="Unsaved changes" />
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {saveMessage && (
                    <span style={{
                      fontSize: 11,
                      color: saveMessage.startsWith('Error') ? 'var(--negative)' : 'var(--positive)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {saveMessage}
                    </span>
                  )}
                  <button
                    onClick={() => setReadOnly(!readOnly)}
                    title={readOnly ? 'Switch to edit mode' : 'Switch to read-only'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      background: readOnly ? 'rgba(245,158,11,0.1)' : 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      color: readOnly ? 'var(--warning)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {readOnly ? <Lock size={12} /> : <Unlock size={12} />}
                    {readOnly ? 'Read-only' : 'Editable'}
                  </button>
                  <button
                    onClick={saveFile}
                    disabled={saving || readOnly || !hasUnsavedChanges}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 12px',
                      background: hasUnsavedChanges && !readOnly ? 'var(--accent)' : 'var(--surface-elevated)',
                      border: 'none',
                      borderRadius: 6,
                      color: hasUnsavedChanges && !readOnly ? '#fff' : 'var(--text-muted)',
                      cursor: hasUnsavedChanges && !readOnly ? 'pointer' : 'default',
                      fontSize: 11,
                      fontWeight: 500,
                      fontFamily: 'var(--font-mono)',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    <Save size={12} />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                {loading ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                  }}>
                    Loading file...
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    language={getLanguage(selectedPath)}
                    value={content}
                    onChange={(value) => setContent(value || '')}
                    onMount={(editor) => { editorRef.current = editor; }}
                    theme="vs-dark"
                    options={{
                      readOnly,
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      lineNumbers: 'on',
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      padding: { top: 8 },
                      renderLineHighlight: 'line',
                      cursorBlinking: 'smooth',
                      smoothScrolling: true,
                      bracketPairColorization: { enabled: true },
                    }}
                  />
                )}
              </div>

              {fileInfo && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '6px 16px',
                  borderTop: '1px solid var(--border)',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--surface)',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Info size={10} />
                    {formatBytes(fileInfo.size)}
                  </span>
                  <span>Modified: {new Date(fileInfo.modified).toLocaleString()}</span>
                  <span>{getLanguage(selectedPath).toUpperCase()}</span>
                </div>
              )}
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              gap: 12,
            }}>
              <FolderOpen size={48} style={{ opacity: 0.2 }} />
              <div style={{ fontSize: 14 }}>Select a file to open</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Browse the directory tree on the left
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
