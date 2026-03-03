import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { requireMinRole } from '../middleware/rbac.js';

const router = Router();

router.get('/skills', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { q, category, risk, pack_id } = req.query;

    let sql = `
      SELECT
        s.id, s.name, s.slug, s.description, s.category, s.risk, s.tools_md,
        s.created_at, s.updated_at,
        sp.id as pack_id, sp.name as pack_name, sp.slug as pack_slug, sp.source_url,
        ins.installed_at
      FROM skills s
      JOIN skill_packs sp ON sp.id = s.pack_id
      LEFT JOIN installed_skills ins ON ins.skill_id = s.id AND ins.tenant_id = $1
      WHERE 1=1
    `;
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (q) {
      sql += ` AND (s.name ILIKE $${paramIdx} OR s.description ILIKE $${paramIdx} OR s.category ILIKE $${paramIdx} OR sp.name ILIKE $${paramIdx})`;
      params.push(`%${q}%`);
      paramIdx++;
    }
    if (category && category !== 'all') {
      sql += ` AND s.category = $${paramIdx}`;
      params.push(category);
      paramIdx++;
    }
    if (risk && risk !== 'all') {
      sql += ` AND s.risk = $${paramIdx}`;
      params.push(risk);
      paramIdx++;
    }
    if (pack_id) {
      sql += ` AND s.pack_id = $${paramIdx}`;
      params.push(pack_id);
      paramIdx++;
    }

    sql += ` ORDER BY sp.name ASC, s.name ASC`;

    const result = await pool.query(sql, params);
    res.json({ skills: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Marketplace list skills error:', error);
    res.status(500).json({ error: 'Failed to list skills' });
  }
});

router.get('/skills/installed', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const result = await pool.query(
      `SELECT s.id, s.name, s.slug, s.description, s.category, s.risk, s.tools_md,
              sp.name as pack_name, ins.installed_at
       FROM installed_skills ins
       JOIN skills s ON s.id = ins.skill_id
       JOIN skill_packs sp ON sp.id = s.pack_id
       WHERE ins.tenant_id = $1
       ORDER BY ins.installed_at DESC`,
      [tenantId]
    );
    res.json({ skills: result.rows });
  } catch (error) {
    console.error('Installed skills error:', error);
    res.status(500).json({ error: 'Failed to list installed skills' });
  }
});

router.post('/skills/:id/install', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const skill = await pool.query('SELECT id FROM skills WHERE id = $1', [id]);
    if (skill.rows.length === 0) return res.status(404).json({ error: 'Skill not found' });

    await pool.query(
      `INSERT INTO installed_skills (tenant_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [tenantId, id]
    );
    res.json({ success: true, message: 'Skill installed' });
  } catch (error) {
    console.error('Install skill error:', error);
    res.status(500).json({ error: 'Failed to install skill' });
  }
});

router.delete('/skills/:id/install', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    await pool.query(
      `DELETE FROM installed_skills WHERE tenant_id = $1 AND skill_id = $2`,
      [tenantId, id]
    );

    await pool.query(
      `DELETE FROM agent_skills WHERE skill_id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Skill uninstalled' });
  } catch (error) {
    console.error('Uninstall skill error:', error);
    res.status(500).json({ error: 'Failed to uninstall skill' });
  }
});

router.get('/packs', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const result = await pool.query(
      `SELECT
         sp.id, sp.name, sp.slug, sp.description, sp.source_url, sp.is_builtin,
         sp.last_synced_at, sp.created_at,
         COUNT(s.id)::int as skill_count,
         COUNT(ins.id)::int as installed_count
       FROM skill_packs sp
       LEFT JOIN skills s ON s.pack_id = sp.id
       LEFT JOIN installed_skills ins ON ins.skill_id = s.id AND ins.tenant_id = $1
       GROUP BY sp.id
       ORDER BY sp.is_builtin DESC, sp.name ASC`,
      [tenantId]
    );
    res.json({ packs: result.rows });
  } catch (error) {
    console.error('List packs error:', error);
    res.status(500).json({ error: 'Failed to list packs' });
  }
});

router.post('/packs', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, source_url, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const slug = `custom/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

    const existing = await pool.query('SELECT id FROM skill_packs WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'A pack with this name already exists' });

    const result = await pool.query(
      `INSERT INTO skill_packs (name, slug, description, source_url, is_builtin) VALUES ($1,$2,$3,$4,false) RETURNING *`,
      [name, slug, description || null, source_url || null]
    );
    res.status(201).json({ pack: result.rows[0] });
  } catch (error) {
    console.error('Create pack error:', error);
    res.status(500).json({ error: 'Failed to create pack' });
  }
});

router.delete('/packs/:id', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pack = await pool.query('SELECT id, is_builtin FROM skill_packs WHERE id = $1', [id]);
    if (pack.rows.length === 0) return res.status(404).json({ error: 'Pack not found' });
    if (pack.rows[0].is_builtin) return res.status(403).json({ error: 'Cannot delete built-in packs' });

    await pool.query('DELETE FROM skill_packs WHERE id = $1', [id]);
    res.json({ success: true, message: 'Pack deleted' });
  } catch (error) {
    console.error('Delete pack error:', error);
    res.status(500).json({ error: 'Failed to delete pack' });
  }
});

router.post('/packs/:id/sync', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pack = await pool.query('SELECT id, source_url FROM skill_packs WHERE id = $1', [id]);
    if (pack.rows.length === 0) return res.status(404).json({ error: 'Pack not found' });

    await pool.query('UPDATE skill_packs SET last_synced_at = NOW() WHERE id = $1', [id]);
    res.json({ message: 'Sync complete (stub — remote sync not yet implemented)', last_synced_at: new Date().toISOString() });
  } catch (error) {
    console.error('Sync pack error:', error);
    res.status(500).json({ error: 'Failed to sync pack' });
  }
});

router.get('/agent/:agentId/skills', requireMinRole('viewer'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { agentId } = req.params;

    const agentCheck = await pool.query('SELECT id FROM agents WHERE id = $1 AND tenant_id = $2', [agentId, tenantId]);
    if (agentCheck.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });

    const result = await pool.query(
      `SELECT s.id, s.name, s.slug, s.description, s.category, s.risk,
              sp.name as pack_name, ags.enabled_at
       FROM agent_skills ags
       JOIN skills s ON s.id = ags.skill_id
       JOIN skill_packs sp ON sp.id = s.pack_id
       WHERE ags.agent_id = $1`,
      [agentId]
    );
    res.json({ skills: result.rows });
  } catch (error) {
    console.error('Agent skills error:', error);
    res.status(500).json({ error: 'Failed to list agent skills' });
  }
});

router.post('/agent/:agentId/skills/:skillId', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { agentId, skillId } = req.params;

    const agentCheck = await pool.query('SELECT id FROM agents WHERE id = $1 AND tenant_id = $2', [agentId, tenantId]);
    if (agentCheck.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });

    const installed = await pool.query(
      'SELECT id FROM installed_skills WHERE tenant_id = $1 AND skill_id = $2',
      [tenantId, skillId]
    );
    if (installed.rows.length === 0) {
      return res.status(400).json({ error: 'Skill must be installed in your workspace before enabling it for an agent' });
    }

    await pool.query(
      `INSERT INTO agent_skills (agent_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [agentId, skillId]
    );
    res.json({ success: true, message: 'Skill enabled for agent' });
  } catch (error) {
    console.error('Enable agent skill error:', error);
    res.status(500).json({ error: 'Failed to enable skill for agent' });
  }
});

router.delete('/agent/:agentId/skills/:skillId', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { agentId, skillId } = req.params;

    const agentCheck = await pool.query('SELECT id FROM agents WHERE id = $1 AND tenant_id = $2', [agentId, tenantId]);
    if (agentCheck.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });

    await pool.query('DELETE FROM agent_skills WHERE agent_id = $1 AND skill_id = $2', [agentId, skillId]);
    res.json({ success: true, message: 'Skill disabled for agent' });
  } catch (error) {
    console.error('Disable agent skill error:', error);
    res.status(500).json({ error: 'Failed to disable skill for agent' });
  }
});

export default router;
