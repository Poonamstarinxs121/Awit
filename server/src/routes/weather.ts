import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || 'auto';
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'SquidJob-MissionControl/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`wttr.in returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: 'Weather service unavailable' });
  }
});

export default router;
