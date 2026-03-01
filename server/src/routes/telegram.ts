import { Router } from 'express';
import { requireMinRole } from '../middleware/rbac.js';
import { configureTelegramBot, getTelegramConfig, removeTelegramConfig, linkChat, getLinkedChats, sendTelegramMessage, startPolling, stopPolling } from '../services/telegramService.js';

const router = Router();

router.get('/config', async (req, res) => {
  try {
    const config = await getTelegramConfig(req.user!.tenantId);
    res.json({ config });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get config' });
  }
});

router.post('/connect', requireMinRole('admin'), async (req, res) => {
  try {
    const { bot_token, telegram_user_id } = req.body;
    if (!bot_token) return res.status(400).json({ error: 'bot_token is required' });
    const result = await configureTelegramBot(req.user!.tenantId, bot_token);

    if (telegram_user_id) {
      await linkChat(req.user!.tenantId, String(telegram_user_id), 'private', req.user!.userId);
    }

    startPolling(req.user!.tenantId).catch(err => {
      console.error('Failed to start polling after connect:', err);
    });

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to connect bot' });
  }
});

router.delete('/disconnect', requireMinRole('admin'), async (req, res) => {
  try {
    stopPolling(req.user!.tenantId);
    await removeTelegramConfig(req.user!.tenantId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

router.post('/chats', requireMinRole('admin'), async (req, res) => {
  try {
    const { chat_id, chat_type } = req.body;
    if (!chat_id) return res.status(400).json({ error: 'chat_id is required' });
    await linkChat(req.user!.tenantId, chat_id, chat_type || 'private', req.user!.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to link chat' });
  }
});

router.get('/chats', async (req, res) => {
  try {
    const chats = await getLinkedChats(req.user!.tenantId);
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get chats' });
  }
});

router.post('/test', requireMinRole('admin'), async (req, res) => {
  try {
    const { chat_id, message } = req.body;
    if (!chat_id) return res.status(400).json({ error: 'chat_id is required' });
    const success = await sendTelegramMessage(req.user!.tenantId, chat_id, message || '\u{1F991} Test message from SquidJob!');
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
