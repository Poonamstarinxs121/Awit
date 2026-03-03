'use client';

import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, FileCode, FileJson, File, Image } from 'lucide-react';

interface DirEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  children?: TreeNode[];
  expanded?: boolean;
  loaded?: boolean;
}

interface FileTreeProps {
  onFileSelect: (path: string) => void;
  selectedPath: string | null;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'rs':
    case 'go':
    case 'rb':
    case 'sh':
      return FileCode;
    case 'json':
      return FileJson;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return Image;
    case 'md':
    case 'txt':
    case 'log':
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'cfg':
    case 'env':
      return FileText;
    default:
      return File;
  }
}

function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return '#3178C6';
    case 'js':
    case 'jsx':
      return '#F7DF1E';
    case 'py':
      return '#3776AB';
    case 'json':
      return '#F5A623';
    case 'md':
      return '#519ABA';
    case 'yaml':
    case 'yml':
      return '#CB171E';
    default:
      return 'var(--text-muted)';
  }
}

function TreeItem({
  node,
  depth,
  onToggle,
  onSelect,
  selectedPath,
}: {
  node: TreeNode;
  depth: number;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  selectedPath: string | null;
}) {
  const isSelected = selectedPath === node.path;
  const isDir = node.type === 'directory';

  const handleClick = () => {
    if (isDir) {
      onToggle(node.path);
    } else {
      onSelect(node.path);
    }
  };

  const Icon = isDir
    ? (node.expanded ? FolderOpen : Folder)
    : getFileIcon(node.name);

  const iconColor = isDir ? '#F59E0B' : getFileColor(node.name);

  return (
    <>
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          paddingLeft: depth * 16 + 8,
          cursor: 'pointer',
          background: isSelected ? 'var(--accent-soft)' : 'transparent',
          borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
          fontSize: 13,
          fontFamily: 'var(--font-body)',
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          transition: 'background 0.1s ease',
          userSelect: 'none',
        }}
        onMouseEnter={e => {
          if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-elevated)';
        }}
        onMouseLeave={e => {
          if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
        }}
      >
        {isDir && (
          node.expanded
            ? <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            : <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        )}
        {!isDir && <span style={{ width: 14, flexShrink: 0 }} />}
        <Icon size={15} style={{ color: iconColor, flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
      </div>
      {isDir && node.expanded && node.children?.map(child => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          onToggle={onToggle}
          onSelect={onSelect}
          selectedPath={selectedPath}
        />
      ))}
    </>
  );
}

export default function FileTree({ onFileSelect, selectedPath }: FileTreeProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const loadDirectory = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}`);
    const data = await res.json();
    const entries: DirEntry[] = data.entries || [];
    return entries.map(e => ({
      name: e.name,
      path: dirPath === '.' ? e.name : `${dirPath}/${e.name}`,
      type: e.type,
      size: e.size,
      modified: e.modified,
      children: e.type === 'directory' ? [] : undefined,
      expanded: false,
      loaded: false,
    }));
  }, []);

  const initialize = useCallback(async () => {
    if (initialized) return;
    setLoading(true);
    try {
      const rootNodes = await loadDirectory('.');
      setNodes(rootNodes);
      setInitialized(true);
    } catch {}
    setLoading(false);
  }, [initialized, loadDirectory]);

  if (!initialized && !loading) {
    initialize();
  }

  const toggleDir = useCallback(async (path: string) => {
    const updateNodes = (items: TreeNode[]): TreeNode[] => {
      return items.map(node => {
        if (node.path === path) {
          return { ...node, expanded: !node.expanded, pendingLoad: !node.loaded && !node.expanded };
        }
        if (node.children) {
          return { ...node, children: updateNodes(node.children) };
        }
        return node;
      });
    };

    setNodes(prev => {
      const updated = updateNodes(prev);
      return updated;
    });

    const findNode = (items: TreeNode[]): TreeNode | null => {
      for (const item of items) {
        if (item.path === path) return item;
        if (item.children) {
          const found = findNode(item.children);
          if (found) return found;
        }
      }
      return null;
    };

    const node = findNode(nodes);
    if (node && !node.loaded && node.type === 'directory') {
      try {
        const children = await loadDirectory(path);
        const injectChildren = (items: TreeNode[]): TreeNode[] => {
          return items.map(n => {
            if (n.path === path) {
              return { ...n, children, loaded: true, expanded: true };
            }
            if (n.children) {
              return { ...n, children: injectChildren(n.children) };
            }
            return n;
          });
        };
        setNodes(prev => injectChildren(prev));
      } catch {}
    }
  }, [nodes, loadDirectory]);

  return (
    <div style={{
      width: 280,
      minWidth: 280,
      height: '100%',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        fontFamily: 'var(--font-heading)',
      }}>
        Explorer
      </div>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingTop: 4,
        paddingBottom: 4,
      }}>
        {loading ? (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>
        ) : nodes.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>No files found</div>
        ) : (
          nodes.map(node => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              onToggle={toggleDir}
              onSelect={onFileSelect}
              selectedPath={selectedPath}
            />
          ))
        )}
      </div>
    </div>
  );
}
