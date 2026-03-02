import { Router, Request, Response } from 'express';
import { requireMinRole } from '../middleware/rbac.js';
import {
  getMachines,
  getMachineById,
  createMachine,
  updateMachine,
  deleteMachine,
  pingMachine,
  executeRemoteCommand,
  getMachineGroups,
  createMachineGroup,
  updateMachineGroup,
  deleteMachineGroup,
  getMachinesInGroup,
  updateMachineStatus,
} from '../services/sshService.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const machines = await getMachines(req.user!.tenantId);
    res.json({ machines });
  } catch (error) {
    console.error('List machines error:', error);
    res.status(500).json({ error: 'Failed to list machines' });
  }
});

router.post('/', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, host, ssh_port, ssh_user, ssh_auth_type, ssh_credential, group_id, description } = req.body;
    if (!name || !host || !ssh_user || !ssh_auth_type || !ssh_credential) {
      res.status(400).json({ error: 'Missing required fields: name, host, ssh_user, ssh_auth_type, ssh_credential' });
      return;
    }
    const machine = await createMachine(req.user!.tenantId, {
      name, host, ssh_port, ssh_user, ssh_auth_type, ssh_credential, group_id, description,
    });
    res.status(201).json({ machine });
  } catch (error) {
    console.error('Create machine error:', error);
    res.status(500).json({ error: 'Failed to create machine' });
  }
});

router.patch('/:id', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const machine = await updateMachine(req.user!.tenantId, req.params.id, req.body);
    if (!machine) {
      res.status(404).json({ error: 'Machine not found' });
      return;
    }
    res.json({ machine });
  } catch (error) {
    console.error('Update machine error:', error);
    res.status(500).json({ error: 'Failed to update machine' });
  }
});

router.delete('/:id', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const deleted = await deleteMachine(req.user!.tenantId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Machine not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete machine error:', error);
    res.status(500).json({ error: 'Failed to delete machine' });
  }
});

router.post('/:id/ping', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const machine = await getMachineById(req.user!.tenantId, req.params.id);
    if (!machine) {
      res.status(404).json({ error: 'Machine not found' });
      return;
    }
    const result = await pingMachine(machine);
    await updateMachineStatus(machine.id, result.online ? 'online' : 'offline');
    res.json({ online: result.online, latency_ms: result.latencyMs, error: result.error });
  } catch (error) {
    console.error('Ping machine error:', error);
    res.status(500).json({ error: 'Failed to ping machine' });
  }
});

router.post('/:id/exec', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const { command } = req.body;
    if (!command) {
      res.status(400).json({ error: 'command is required' });
      return;
    }
    const machine = await getMachineById(req.user!.tenantId, req.params.id);
    if (!machine) {
      res.status(404).json({ error: 'Machine not found' });
      return;
    }
    const result = await executeRemoteCommand(machine, command);
    res.json({ ...result, machine_name: machine.name });
  } catch (error) {
    console.error('Exec machine error:', error);
    res.status(500).json({ error: 'Failed to execute command' });
  }
});

router.get('/groups', async (req: Request, res: Response) => {
  try {
    const groups = await getMachineGroups(req.user!.tenantId);
    res.json({ groups });
  } catch (error) {
    console.error('List groups error:', error);
    res.status(500).json({ error: 'Failed to list groups' });
  }
});

router.post('/groups', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const group = await createMachineGroup(req.user!.tenantId, name, description);
    res.status(201).json({ group });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

router.patch('/groups/:id', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const group = await updateMachineGroup(req.user!.tenantId, req.params.id, req.body);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    res.json({ group });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

router.delete('/groups/:id', requireMinRole('admin'), async (req: Request, res: Response) => {
  try {
    const deleted = await deleteMachineGroup(req.user!.tenantId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

router.post('/groups/:id/exec', requireMinRole('operator'), async (req: Request, res: Response) => {
  try {
    const { command } = req.body;
    if (!command) {
      res.status(400).json({ error: 'command is required' });
      return;
    }
    const machines = await getMachinesInGroup(req.user!.tenantId, req.params.id);
    if (machines.length === 0) {
      res.status(404).json({ error: 'Group not found or has no machines' });
      return;
    }
    const results = await Promise.all(
      machines.map(async (m) => {
        const result = await executeRemoteCommand(m, command);
        return { machine_id: m.id, machine_name: m.name, ...result };
      })
    );
    res.json({ results });
  } catch (error) {
    console.error('Group exec error:', error);
    res.status(500).json({ error: 'Failed to execute group command' });
  }
});

export default router;
