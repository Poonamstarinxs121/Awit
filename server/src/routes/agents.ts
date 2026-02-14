import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({ agents: [] });
});

router.post('/', (_req: Request, res: Response) => {
  res.status(201).json({ agent: {} });
});

router.get('/:id', (_req: Request, res: Response) => {
  res.json({ agent: {} });
});

router.patch('/:id', (_req: Request, res: Response) => {
  res.json({ agent: {} });
});

export default router;
