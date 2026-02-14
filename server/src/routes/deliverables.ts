import { Router, Request, Response } from 'express';
import { getDeliverableFile } from '../services/deliverableService.js';

const router = Router();

router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const file = await getDeliverableFile(req.user!.tenantId, req.params.id);
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download file' });
  }
});

export default router;
