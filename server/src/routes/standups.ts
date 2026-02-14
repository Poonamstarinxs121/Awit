import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({ standups: [] });
});

router.get('/latest', (_req: Request, res: Response) => {
  res.json({ standup: null });
});

export default router;
