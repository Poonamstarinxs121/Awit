import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import authRoutes from './auth.js';
import agentsRoutes from './agents.js';
import tasksRoutes from './tasks.js';
import activityRoutes from './activity.js';
import standupsRoutes from './standups.js';
import configRoutes from './config.js';

const router = Router();

router.use('/auth', authRoutes);

router.use('/v1/agents', authMiddleware, tenantMiddleware, agentsRoutes);
router.use('/v1/tasks', authMiddleware, tenantMiddleware, tasksRoutes);
router.use('/v1/activity', authMiddleware, tenantMiddleware, activityRoutes);
router.use('/v1/standups', authMiddleware, tenantMiddleware, standupsRoutes);
router.use('/v1/config', authMiddleware, tenantMiddleware, configRoutes);

export default router;
