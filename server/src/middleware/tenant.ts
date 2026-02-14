import { Request, Response, NextFunction } from 'express';

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.user.tenantId) {
    res.status(401).json({ error: 'Tenant context not available' });
    return;
  }

  next();
}
