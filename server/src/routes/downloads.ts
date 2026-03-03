import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';

const router = Router();

const WORKSPACE_ROOT = path.resolve(process.cwd(), '..');

function getDirectoryPath(dirName: string): string {
  const fromCwd = path.resolve(process.cwd(), dirName);
  if (fs.existsSync(fromCwd)) return fromCwd;

  const fromWorkspace = path.resolve(WORKSPACE_ROOT, dirName);
  if (fs.existsSync(fromWorkspace)) return fromWorkspace;

  return fromCwd;
}

router.get('/node', async (_req: Request, res: Response) => {
  try {
    const nodeDir = getDirectoryPath('node');

    if (!fs.existsSync(nodeDir)) {
      res.status(404).json({ error: 'Node app package not found on server' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="squidjob-node.zip"');

    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('error', (err: Error) => {
      console.error('Archive error (node):', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create archive' });
      }
    });

    archive.pipe(res);

    archive.glob('**/*', {
      cwd: nodeDir,
      dot: true,
      ignore: [
        'node_modules/**',
        '.next/**',
        '.env',
        '.env.local',
        '.env.production',
        '.env.*',
        'dist/**',
        '.turbo/**',
        '.git/**',
        '*.pem',
      ],
    });

    await archive.finalize();
  } catch (err) {
    console.error('Download node error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to prepare download' });
    }
  }
});

router.get('/extension', async (_req: Request, res: Response) => {
  try {
    const extDir = getDirectoryPath('extension');

    if (!fs.existsSync(extDir)) {
      res.status(404).json({ error: 'Extension package not found on server' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="squidjob-extension.zip"');

    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('error', (err: Error) => {
      console.error('Archive error (extension):', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create archive' });
      }
    });

    archive.pipe(res);

    archive.glob('**/*', {
      cwd: extDir,
      dot: true,
      ignore: [
        'node_modules/**',
        '.env',
        '.env.*',
        '.git/**',
        '*.pem',
      ],
    });

    await archive.finalize();
  } catch (err) {
    console.error('Download extension error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to prepare download' });
    }
  }
});

export default router;
