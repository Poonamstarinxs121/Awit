import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const memoriesResult = await pool.query(
      `SELECT me.id, me.agent_id, me.memory_type, me.content, me.created_at,
              a.name as agent_name
       FROM memory_entries me
       LEFT JOIN agents a ON a.id = me.agent_id AND a.tenant_id = me.tenant_id
       WHERE me.tenant_id = $1
       ORDER BY me.created_at DESC
       LIMIT 500`,
      [tenantId]
    );

    const agentsResult = await pool.query(
      `SELECT id, name, role, level FROM agents WHERE tenant_id = $1`,
      [tenantId]
    );

    let documentsResult = { rows: [] as any[] };
    try {
      documentsResult = await pool.query(
        `SELECT id, title, type, task_id, agent_id, created_at FROM documents WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [tenantId]
      );
    } catch {}

    const nodes: any[] = [];
    const edges: any[] = [];
    const agentNodeIds = new Set<string>();

    for (const agent of agentsResult.rows) {
      const nodeId = `agent-${agent.id}`;
      agentNodeIds.add(nodeId);
      nodes.push({
        id: nodeId,
        label: agent.name,
        type: 'agent',
        agentName: agent.name,
        metadata: { role: agent.role, level: agent.level },
        createdAt: null,
      });
    }

    for (const mem of memoriesResult.rows) {
      const nodeId = `memory-${mem.id}`;
      const label = mem.content.length > 60 ? mem.content.substring(0, 60) + '...' : mem.content;
      nodes.push({
        id: nodeId,
        label,
        type: mem.memory_type,
        agentName: mem.agent_name || null,
        createdAt: mem.created_at,
      });

      const agentNodeId = `agent-${mem.agent_id}`;
      if (agentNodeIds.has(agentNodeId)) {
        edges.push({
          source: agentNodeId,
          target: nodeId,
          relationship: 'has_memory',
        });
      }
    }

    for (const doc of documentsResult.rows) {
      const nodeId = `document-${doc.id}`;
      nodes.push({
        id: nodeId,
        label: doc.title,
        type: 'document',
        agentName: null,
        metadata: { docType: doc.type },
        createdAt: doc.created_at,
      });

      if (doc.agent_id) {
        const agentNodeId = `agent-${doc.agent_id}`;
        if (agentNodeIds.has(agentNodeId)) {
          edges.push({
            source: agentNodeId,
            target: nodeId,
            relationship: 'authored',
          });
        }
      }

      if (doc.task_id) {
        edges.push({
          source: nodeId,
          target: `task-${doc.task_id}`,
          relationship: 'linked_to_task',
        });
      }
    }

    res.json({ nodes, edges });
  } catch (error: any) {
    console.error('Memory graph error:', error);
    res.status(500).json({ error: 'Failed to build memory graph' });
  }
});

export default router;
