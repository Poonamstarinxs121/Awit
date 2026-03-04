import { Router, Request, Response } from 'express';
import { listAgents, createAgent, getAgent, updateAgent, getAgentStats } from '../services/agentService.js';
import { executeAgentTurn, executeAgentTurnStream } from '../services/orchestrationEngine.js';
import { getSessionHistory, clearSession } from '../services/sessionManager.js';
import { triggerHeartbeat } from '../services/heartbeatService.js';
import { requestAgentCollaboration } from '../services/interAgentService.js';
import { requireMinRole } from '../middleware/rbac.js';
import { getAgentMetrics, getAllAgentMetrics } from '../services/analyticsService.js';
import { pool } from '../db/index.js';

const router = Router();

router.get('/org-chart', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const result = await pool.query(
      `SELECT
         a.id, a.tenant_id, a.name, a.role, a.level, a.status, a.model_config,
         a.is_default, a.is_paused, a.manager_id, a.job_title, a.department, a.sort_order, a.created_at,
         COALESCE(sk.skills_count, 0)::int AS skills_count
       FROM agents a
       LEFT JOIN (
         SELECT agent_id, COUNT(*) AS skills_count
         FROM agent_skills
         GROUP BY agent_id
       ) sk ON sk.agent_id = a.id
       WHERE a.tenant_id = $1
       ORDER BY a.sort_order ASC, a.created_at ASC`,
      [tenantId]
    );

    const agents = result.rows;
    const stats = {
      total: agents.length,
      active: agents.filter((a: any) => a.status === 'active').length,
      idle: agents.filter((a: any) => a.status === 'idle').length,
      disabled: agents.filter((a: any) => a.status === 'disabled').length,
      leads: agents.filter((a: any) => a.level === 'lead').length,
      specialists: agents.filter((a: any) => a.level === 'specialist').length,
      interns: agents.filter((a: any) => a.level === 'intern').length,
    };

    res.json({ agents, stats });
  } catch (error) {
    console.error('Org chart error:', error);
    res.status(500).json({ error: 'Failed to load org chart' });
  }
});

router.get('/analytics', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const metrics = await getAllAgentMetrics(req.user!.tenantId, days);
    res.json(metrics);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

router.get('/', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const agents = await listAgents(req.user!.tenantId);
    res.json({ agents });
  } catch (error) {
    console.error('List agents error:', error);
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

router.post('/generate-soul', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const { name, role, tone, strengths, values, avoid, description } = req.body;
    if (!name || !role) {
      res.status(400).json({ error: 'Name and role are required' });
      return;
    }

    const prompt = `Generate a SOUL.md identity document for an AI agent with these characteristics:
Name: ${name}
Role: ${role}
${tone ? `Tone: ${tone}` : ''}
${strengths ? `Key Strengths: ${strengths}` : ''}
${values ? `Values/Principles: ${values}` : ''}
${avoid ? `Topics to Avoid: ${avoid}` : ''}
${description ? `Description: ${description}` : ''}

Write a compelling, personality-rich SOUL.md in the style of a character brief. It should be 2-3 paragraphs that define who this agent IS - their personality, approach, beliefs about their craft, and working style. Write in second person ("You are..."). Make it specific and vivid, not generic. Do not include headers or markdown formatting.`;

    const { chatCompletion } = await import('../services/llmProviderClient.js');
    const messages = [
      { role: 'system' as const, content: 'You are a specialist in crafting AI agent identity documents. Generate vivid, specific character briefs.' },
      { role: 'user' as const, content: prompt }
    ];

    const result = await chatCompletion(req.user!.tenantId, 'system', messages, { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.8 });
    res.json({ soul_md: result.content });
  } catch (error) {
    const { name, role } = req.body;
    const template = `You are ${name}, the ${role} for the team. You approach your work with dedication and expertise. You believe in delivering high-quality results and collaborating effectively with your teammates. You communicate clearly and are always looking for ways to improve your craft.`;
    res.json({ soul_md: template });
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

router.get('/:id/analytics', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const metrics = await getAgentMetrics(req.user!.tenantId, req.params.id, days);
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load agent analytics' });
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
      let streamingStarted = false;
      try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        streamingStarted = true;

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
      } catch (streamError: unknown) {
        console.error('Agent stream error:', streamError);
        const errorMessage = streamError instanceof Error ? streamError.message : 'Failed to process message';
        if (streamingStarted) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
          res.end();
        } else {
          res.status(500).json({ error: errorMessage });
        }
      }
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

router.post('/:id/collaborate', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const { targetAgentId, message, taskId } = req.body;
    if (!targetAgentId || !message) {
      res.status(400).json({ error: 'Missing targetAgentId or message' });
      return;
    }
    const result = await requestAgentCollaboration(
      req.user!.tenantId,
      req.params.id,
      targetAgentId,
      message,
      taskId
    );
    res.json(result);
  } catch (error) {
    console.error('Inter-agent collaboration error:', error);
    res.status(500).json({ error: 'Failed to process collaboration request' });
  }
});

router.post('/:id/pause', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;
    await pool.query(
      `UPDATE agents SET is_paused = true WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    res.json({ success: true, isPaused: true });
  } catch (error) {
    console.error('Pause agent error:', error);
    res.status(500).json({ error: 'Failed to pause agent' });
  }
});

router.post('/:id/resume', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;
    await pool.query(
      `UPDATE agents SET is_paused = false WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    res.json({ success: true, isPaused: false });
  } catch (error) {
    console.error('Resume agent error:', error);
    res.status(500).json({ error: 'Failed to resume agent' });
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
