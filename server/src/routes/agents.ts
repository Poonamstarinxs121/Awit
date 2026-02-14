import { Router, Request, Response } from 'express';
import { listAgents, createAgent, getAgent, updateAgent, getAgentStats } from '../services/agentService.js';
import { executeAgentTurn, executeAgentTurnStream } from '../services/orchestrationEngine.js';
import { getSessionHistory, clearSession } from '../services/sessionManager.js';
import { triggerHeartbeat } from '../services/heartbeatService.js';
import { requireMinRole } from '../middleware/rbac.js';

const router = Router();

router.get('/', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const agents = await listAgents(req.user!.tenantId);
    res.json({ agents });
  } catch (error) {
    console.error('List agents error:', error);
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

router.post('/', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, role, soul_md, agents_md, tools_md, heartbeat_md, model_config, level } = req.body;

    if (!name || !role) {
      res.status(400).json({ error: 'Missing required fields: name, role' });
      return;
    }

    const agent = await createAgent(req.user!.tenantId, {
      name, role, soul_md, agents_md, tools_md, heartbeat_md, model_config, level,
    });
    res.status(201).json({ agent });
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

router.get('/:id/stats', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const stats = await getAgentStats(req.user!.tenantId, req.params.id);
    res.json({ stats });
  } catch (error) {
    console.error('Get agent stats error:', error);
    res.status(500).json({ error: 'Failed to get agent stats' });
  }
});

router.get('/:id', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const agent = await getAgent(req.user!.tenantId, req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json({ agent });
  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

router.patch('/:id', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const agent = await updateAgent(req.user!.tenantId, req.params.id, req.body);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found or no changes provided' });
      return;
    }
    res.json({ agent });
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

router.post('/:id/message', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const { message, session_key, stream } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Missing required field: message' });
      return;
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const result = await executeAgentTurnStream(
        req.user!.tenantId,
        req.params.id,
        message,
        (chunk: string) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        },
        session_key
      );

      res.write(`data: ${JSON.stringify({
        type: 'done',
        session_id: result.sessionId,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        model: result.model,
        provider: result.provider,
      })}\n\n`);

      res.end();
    } else {
      const result = await executeAgentTurn(
        req.user!.tenantId,
        req.params.id,
        message,
        session_key
      );

      res.json({
        response: result.response,
        session_id: result.sessionId,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        model: result.model,
        provider: result.provider,
      });
    }
  } catch (error: unknown) {
    console.error('Agent message error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process message';
    res.status(500).json({ error: errorMessage });
  }
});

router.get('/:id/history', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const sessionKey = req.query.session_key as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const messages = await getSessionHistory(req.user!.tenantId, req.params.id, sessionKey, limit);
    res.json({ messages });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get conversation history' });
  }
});

router.delete('/:id/history', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const sessionKey = req.query.session_key as string | undefined;
    await clearSession(req.user!.tenantId, req.params.id, sessionKey);
    res.json({ success: true });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ error: 'Failed to clear conversation history' });
  }
});

router.post('/:id/heartbeat', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await triggerHeartbeat(req.user!.tenantId, req.params.id);
    res.json({ message: result });
  } catch (error: unknown) {
    console.error('Heartbeat trigger error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to trigger heartbeat';
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
