import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../types/index.js';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 1,
  operator: 2,
  admin: 3,
  owner: 4,
};

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export function requireMinRole(minRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    if (!userRole || ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[minRole]) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
