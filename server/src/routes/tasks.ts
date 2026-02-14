import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({ tasks: [] });
});

router.post('/', (_req: Request, res: Response) => {
  res.status(201).json({ task: {} });
});

router.get('/:id', (_req: Request, res: Response) => {
  res.json({ task: {} });
});

router.patch('/:id', (_req: Request, res: Response) => {
  res.json({ task: {} });
});

router.post('/:id/comments', (_req: Request, res: Response) => {
  res.status(201).json({ comment: {} });
});

export default router;
