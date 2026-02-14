import { Router, Request, Response } from 'express';
import { getNotifications, markNotificationsRead, getUnreadCount } from '../services/notificationService.js';
import { requireMinRole } from '../middleware/rbac.js';

const router = Router();

router.get('/', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const limit = parseInt(req.query.limit as string) || 50;
    const notifications = await getNotifications(req.user!.tenantId, req.user!.userId, { unreadOnly, limit });
    res.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

router.get('/unread-count', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const count = await getUnreadCount(req.user!.tenantId, req.user!.userId);
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

router.post('/mark-read', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const { notificationIds } = req.body;
    await markNotificationsRead(req.user!.tenantId, req.user!.userId, notificationIds);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

export default router;
