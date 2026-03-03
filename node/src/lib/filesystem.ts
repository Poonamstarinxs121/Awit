import fs from 'fs';
import path from 'path';
import { NODE_CONFIG } from '../config/node';

const MAX_FILE_SIZE = 1 * 1024 * 1024;

export function safePath(requestedPath: string): string {
  const root = NODE_CONFIG.openclawDir;
  const resolved = path.resolve(root, requestedPath);

  if (!resolved.startsWith(path.resolve(root))) {
    throw new Error('Path traversal detected');
  }

  try {
    const real = fs.realpathSync(resolved);
    if (!real.startsWith(path.resolve(root))) {
      throw new Error('Symlink points outside root');
    }
    return real;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      const parentDir = path.dirname(resolved);
      if (fs.existsSync(parentDir)) {
        const realParent = fs.realpathSync(parentDir);
        if (!realParent.startsWith(path.resolve(root))) {
          throw new Error('Symlink points outside root');
        }
      }
      return resolved;
    }
    throw err;
  }
}

export interface DirEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
}

export function listDir(dirPath: string): DirEntry[] {
  const safe = safePath(dirPath);

  if (!fs.existsSync(safe)) {
    throw new Error('Directory not found');
  }

  const stat = fs.statSync(safe);
  if (!stat.isDirectory()) {
    throw new Error('Not a directory');
  }

  const entries = fs.readdirSync(safe, { withFileTypes: true });
  return entries.map(entry => {
    const fullPath = path.join(safe, entry.name);
    try {
      const s = fs.statSync(fullPath);
      return {
        name: entry.name,
        type: (entry.isDirectory() ? 'directory' : 'file') as 'file' | 'directory',
        size: s.size,
        modified: s.mtime.toISOString(),
      };
    } catch {
      return {
        name: entry.name,
        type: 'file' as const,
        size: 0,
        modified: new Date().toISOString(),
      };
    }
  }).sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

export function readFile(filePath: string): string {
  const safe = safePath(filePath);

  if (!fs.existsSync(safe)) {
    throw new Error('File not found');
  }

  const stat = fs.statSync(safe);
  if (stat.isDirectory()) {
    throw new Error('Path is a directory');
  }
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error('File exceeds maximum size of 1MB');
  }

  return fs.readFileSync(safe, 'utf-8');
}

export function writeFile(filePath: string, content: string): void {
  const safe = safePath(filePath);

  const dir = path.dirname(safe);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(safe, content, 'utf-8');
}

export function getFileInfo(filePath: string): {
  name: string;
  path: string;
  size: number;
  modified: string;
  created: string;
  type: 'file' | 'directory';
} {
  const safe = safePath(filePath);

  if (!fs.existsSync(safe)) {
    throw new Error('File not found');
  }

  const stat = fs.statSync(safe);
  return {
    name: path.basename(safe),
    path: path.relative(NODE_CONFIG.openclawDir, safe),
    size: stat.size,
    modified: stat.mtime.toISOString(),
    created: stat.birthtime.toISOString(),
    type: stat.isDirectory() ? 'directory' : 'file',
  };
}
