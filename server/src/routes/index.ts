import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import authRoutes from './auth.js';
import agentsRoutes from './agents.js';
import tasksRoutes from './tasks.js';
import activityRoutes from './activity.js';
import standupsRoutes from './standups.js';
import configRoutes from './config.js';
import cronJobsRoutes from './cronJobs.js';
import notificationsRoutes from './notifications.js';
import deliverablesRoutes from './deliverables.js';
import webhookRoutes from './webhooks.js';
import telegramRoutes from './telegram.js';
import setupRoutes from './setup.js';
import settingsRoutes from './settings.js';

const router = Router();

router.use('/auth', authRoutes);

router.use('/v1/agents', authMiddleware, tenantMiddleware, agentsRoutes);
router.use('/v1/tasks', authMiddleware, tenantMiddleware, tasksRoutes);
router.use('/v1/activity', authMiddleware, tenantMiddleware, activityRoutes);
router.use('/v1/standups', authMiddleware, tenantMiddleware, standupsRoutes);
router.use('/v1/config', authMiddleware, tenantMiddleware, configRoutes);
router.use('/v1/cron-jobs', authMiddleware, tenantMiddleware, cronJobsRoutes);
router.use('/v1/notifications', authMiddleware, tenantMiddleware, notificationsRoutes);
router.use('/v1/deliverables', authMiddleware, tenantMiddleware, deliverablesRoutes);
router.use('/v1/webhooks', authMiddleware, tenantMiddleware, webhookRoutes);
router.use('/v1/telegram', authMiddleware, tenantMiddleware, telegramRoutes);
router.use('/v1/setup', authMiddleware, tenantMiddleware, setupRoutes);
router.use('/v1/settings', authMiddleware, tenantMiddleware, settingsRoutes);

export default router;
