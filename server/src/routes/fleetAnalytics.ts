import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';

const router = Router();

router.get('/costs', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const range = parseInt(req.query.range as string) || 30;
    const since = new Date();
    since.setDate(since.getDate() - range);

    const hubCosts = await pool.query(
      `SELECT COALESCE(SUM(estimated_cost), 0) as total_cost,
              COALESCE(SUM(tokens_in), 0) as total_tokens_in,
              COALESCE(SUM(tokens_out), 0) as total_tokens_out
       FROM usage_records
       WHERE tenant_id = $1 AND date >= $2`,
      [tenantId, since.toISOString().split('T')[0]]
    );

    const hubByModel = await pool.query(
      `SELECT model, SUM(estimated_cost) as cost, SUM(tokens_in + tokens_out) as tokens
       FROM usage_records
       WHERE tenant_id = $1 AND date >= $2
       GROUP BY model ORDER BY cost DESC`,
      [tenantId, since.toISOString().split('T')[0]]
    );

    const hubByAgent = await pool.query(
      `SELECT ur.agent_id, a.name as agent_name, SUM(ur.estimated_cost) as cost, SUM(ur.tokens_in + ur.tokens_out) as tokens
       FROM usage_records ur
       LEFT JOIN agents a ON ur.agent_id = a.id
       WHERE ur.tenant_id = $1 AND ur.date >= $2
       GROUP BY ur.agent_id, a.name ORDER BY cost DESC`,
      [tenantId, since.toISOString().split('T')[0]]
    );

    const hubDaily = await pool.query(
      `SELECT date, SUM(estimated_cost) as cost, SUM(tokens_in + tokens_out) as tokens
       FROM usage_records
       WHERE tenant_id = $1 AND date >= $2
       GROUP BY date ORDER BY date ASC`,
      [tenantId, since.toISOString().split('T')[0]]
    );

    const nodeCosts = await pool.query(
      `SELECT n.id as node_id, n.name as node_name,
              COUNT(nt.id) as entry_count,
              COALESCE(SUM((nt.payload->>'estimated_cost')::numeric), 0) as cost,
              COALESCE(SUM((nt.payload->>'tokens_in')::numeric), 0) as tokens_in,
              COALESCE(SUM((nt.payload->>'tokens_out')::numeric), 0) as tokens_out
       FROM nodes n
       LEFT JOIN node_telemetry nt ON nt.node_id = n.id AND nt.telemetry_type = 'cost' AND nt.recorded_at >= $2
       WHERE n.tenant_id = $1
       GROUP BY n.id, n.name`,
      [tenantId, since.toISOString()]
    );

    const hubTotal = parseFloat(hubCosts.rows[0]?.total_cost || '0');
    const nodeTotal = nodeCosts.rows.reduce((sum: number, r: any) => sum + parseFloat(r.cost || '0'), 0);

    res.json({
      total_cost: hubTotal + nodeTotal,
      hub_cost: hubTotal,
      node_cost: nodeTotal,
      total_tokens_in: parseInt(hubCosts.rows[0]?.total_tokens_in || '0'),
      total_tokens_out: parseInt(hubCosts.rows[0]?.total_tokens_out || '0'),
      by_model: hubByModel.rows,
      by_agent: hubByAgent.rows,
      by_node: nodeCosts.rows,
      daily_trend: hubDaily.rows,
      range,
    });
  } catch (error) {
    console.error('Fleet analytics costs error:', error);
    res.status(500).json({ error: 'Failed to get fleet cost analytics' });
  }
});

router.get('/usage', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const range = parseInt(req.query.range as string) || 30;
    const since = new Date();
    since.setDate(since.getDate() - range);

    const hubUsage = await pool.query(
      `SELECT COALESCE(SUM(tokens_in), 0) as tokens_in,
              COALESCE(SUM(tokens_out), 0) as tokens_out,
              COALESCE(SUM(api_calls), 0) as api_calls
       FROM usage_records
       WHERE tenant_id = $1 AND date >= $2`,
      [tenantId, since.toISOString().split('T')[0]]
    );

    const nodeUsage = await pool.query(
      `SELECT n.id as node_id, n.name as node_name,
              COALESCE(SUM((nt.payload->>'tokens_in')::numeric), 0) as tokens_in,
              COALESCE(SUM((nt.payload->>'tokens_out')::numeric), 0) as tokens_out
       FROM nodes n
       LEFT JOIN node_telemetry nt ON nt.node_id = n.id AND nt.telemetry_type = 'cost' AND nt.recorded_at >= $2
       WHERE n.tenant_id = $1
       GROUP BY n.id, n.name`,
      [tenantId, since.toISOString()]
    );

    const hubTokensIn = parseInt(hubUsage.rows[0]?.tokens_in || '0');
    const hubTokensOut = parseInt(hubUsage.rows[0]?.tokens_out || '0');
    const nodeTokensIn = nodeUsage.rows.reduce((s: number, r: any) => s + parseInt(r.tokens_in || '0'), 0);
    const nodeTokensOut = nodeUsage.rows.reduce((s: number, r: any) => s + parseInt(r.tokens_out || '0'), 0);

    res.json({
      total_tokens: hubTokensIn + hubTokensOut + nodeTokensIn + nodeTokensOut,
      total_tokens_in: hubTokensIn + nodeTokensIn,
      total_tokens_out: hubTokensOut + nodeTokensOut,
      hub_api_calls: parseInt(hubUsage.rows[0]?.api_calls || '0'),
      by_node: nodeUsage.rows,
      range,
    });
  } catch (error) {
    console.error('Fleet analytics usage error:', error);
    res.status(500).json({ error: 'Failed to get fleet usage analytics' });
  }
});

export default router;
