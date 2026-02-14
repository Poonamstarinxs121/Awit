import { Router, Request, Response } from 'express';

const router = Router();

router.get('/providers', (_req: Request, res: Response) => {
  res.json({ providers: [] });
});

router.post('/providers', (_req: Request, res: Response) => {
  res.status(201).json({ provider: {} });
});

router.delete('/providers', (_req: Request, res: Response) => {
  res.json({ success: true });
});

export default router;
