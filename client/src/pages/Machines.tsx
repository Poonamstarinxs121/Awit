import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Server, Plus, Trash2, Terminal, Wifi, WifiOff, RefreshCw, Play, Layers, Edit2, X } from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { Modal } from '../components/ui/Modal';

interface Machine {
  id: string;
  name: string;
  host: string;
  ssh_port: number;
  ssh_user: string;
  ssh_auth_type: 'key' | 'password';
  group_id: string | null;
  group_name: string | null;
  status: 'online' | 'offline' | 'unknown';
  last_ping: string | null;
  description: string | null;
  created_at: string;
}

interface MachineGroup {
  id: string;
  name: string;
  description: string | null;
  machine_count: number;
  created_at: string;
}

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  machine_name?: string;
  error?: string;
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: 'bg-green-500',
    offline: 'bg-[rgba(255,59,48,0.1)]0',
    unknown: 'bg-[var(--surface-elevated)]',
  };
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-[var(--surface-elevated)]'} flex-shrink-0`} title={status} />
  );
}

function timeSince(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function Machines() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'machines' | 'groups'>('machines');

  const [showAddMachine, setShowAddMachine] = useState(false);
  const [editMachine, setEditMachine] = useState<Machine | null>(null);
  const [terminalMachine, setTerminalMachine] = useState<Machine | null>(null);
  const [terminalGroup, setTerminalGroup] = useState<MachineGroup | null>(null);
  const [command, setCommand] = useState('');
  const [execResults, setExecResults] = useState<ExecResult[]>([]);
  const [execRunning, setExecRunning] = useState(false);
  const [pingStates, setPingStates] = useState<Record<string, { loading: boolean; latency?: number }>>({});

  const [showAddGroup, setShowAddGroup] = useState(false);
  const [editGroup, setEditGroup] = useState<MachineGroup | null>(null);

  const blankForm = { name: '', host: '', ssh_port: '22', ssh_user: '', ssh_auth_type: 'key' as const, ssh_credential: '', group_id: '', description: '' };
  const [machineForm, setMachineForm] = useState(blankForm);
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [formError, setFormError] = useState('');

  const { data: machinesData, isLoading: loadingMachines } = useQuery({
    queryKey: ['machines'],
    queryFn: () => apiGet<{ machines: Machine[] }>('/v1/machines'),
  });

  const { data: groupsData, isLoading: loadingGroups } = useQuery({
    queryKey: ['machine-groups'],
    queryFn: () => apiGet<{ groups: MachineGroup[] }>('/v1/machines/groups'),
  });

  const machines = machinesData?.machines ?? [];
  const groups = groupsData?.groups ?? [];

  const createMachineMutation = useMutation({
    mutationFn: (data: typeof blankForm) => apiPost('/v1/machines', {
      ...data, ssh_port: Number(data.ssh_port), group_id: data.group_id || undefined,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['machines'] }); setShowAddMachine(false); setMachineForm(blankForm); setFormError(''); },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMachineMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof blankForm> }) =>
      apiPatch(`/v1/machines/${id}`, { ...data, ssh_port: data.ssh_port ? Number(data.ssh_port) : undefined, group_id: data.group_id || null }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['machines'] }); setEditMachine(null); setMachineForm(blankForm); setFormError(''); },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMachineMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/v1/machines/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['machines'] }),
  });

  const createGroupMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) => apiPost('/v1/machines/groups', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['machine-groups'] }); setShowAddGroup(false); setGroupForm({ name: '', description: '' }); },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
      apiPatch(`/v1/machines/groups/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['machine-groups'] }); setEditGroup(null); setGroupForm({ name: '', description: '' }); },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/v1/machines/groups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['machine-groups'] }),
  });

  async function pingMachine(machine: Machine) {
    setPingStates(prev => ({ ...prev, [machine.id]: { loading: true } }));
    try {
      const result = await apiPost<{ online: boolean; latency_ms: number }>(`/v1/machines/${machine.id}/ping`, {});
      setPingStates(prev => ({ ...prev, [machine.id]: { loading: false, latency: result.latency_ms } }));
      queryClient.invalidateQueries({ queryKey: ['machines'] });
    } catch {
      setPingStates(prev => ({ ...prev, [machine.id]: { loading: false } }));
    }
  }

  async function runExec() {
    if (!command.trim()) return;
    setExecRunning(true);
    setExecResults([]);
    try {
      if (terminalMachine) {
        const result = await apiPost<ExecResult>(`/v1/machines/${terminalMachine.id}/exec`, { command });
        setExecResults([result]);
      } else if (terminalGroup) {
        const result = await apiPost<{ results: ExecResult[] }>(`/v1/machines/groups/${terminalGroup.id}/exec`, { command });
        setExecResults(result.results ?? []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setExecResults([{ stdout: '', stderr: msg, exitCode: 1 }]);
    } finally {
      setExecRunning(false);
    }
  }

  function openEdit(machine: Machine) {
    setMachineForm({
      name: machine.name,
      host: machine.host,
      ssh_port: String(machine.ssh_port),
      ssh_user: machine.ssh_user,
      ssh_auth_type: machine.ssh_auth_type,
      ssh_credential: '',
      group_id: machine.group_id || '',
      description: machine.description || '',
    });
    setEditMachine(machine);
    setFormError('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Infrastructure</h1>
          <p className="text-text-secondary text-sm mt-0.5">Manage your Mac Minis and machine groups via SSH</p>
        </div>
        <Button
          onClick={() => { setActiveTab('machines'); setShowAddMachine(true); setMachineForm(blankForm); setFormError(''); }}
          size="sm"
        >
          <Plus size={16} className="mr-1.5" /> Add Machine
        </Button>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)]">
        {(['machines', 'groups'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-brand-accent text-brand-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          >
            {tab}
            {tab === 'machines' && <span className="ml-1.5 text-xs text-text-muted">({machines.length})</span>}
            {tab === 'groups' && <span className="ml-1.5 text-xs text-text-muted">({groups.length})</span>}
          </button>
        ))}
      </div>

      {activeTab === 'machines' && (
        <div>
          {loadingMachines ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : machines.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Server size={40} className="mx-auto text-text-muted mb-3" />
                <p className="text-text-muted text-sm">No machines registered yet.</p>
                <p className="text-text-muted text-xs mt-1">Add your Mac Minis to manage them via SSH.</p>
                <Button className="mt-4" size="sm" onClick={() => setShowAddMachine(true)}>
                  <Plus size={14} className="mr-1.5" /> Add First Machine
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {machines.map(machine => {
                const ping = pingStates[machine.id];
                return (
                  <div key={machine.id} className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <StatusDot status={machine.status} />
                        <div>
                          <h3 className="text-text-primary font-semibold">{machine.name}</h3>
                          <p className="text-text-muted text-xs">{machine.ssh_user}@{machine.host}:{machine.ssh_port}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {machine.group_name && <Badge variant="info">{machine.group_name}</Badge>}
                        <Badge variant={machine.status === 'online' ? 'active' : machine.status === 'offline' ? 'idle' : 'info'}>
                          {machine.status}
                        </Badge>
                      </div>
                    </div>

                    {machine.description && (
                      <p className="text-text-secondary text-xs">{machine.description}</p>
                    )}

                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span>Last ping: {timeSince(machine.last_ping)}</span>
                      {ping?.latency !== undefined && <span className="text-green-600">+{ping.latency}ms</span>}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => pingMachine(machine)}
                        disabled={ping?.loading}
                        className="flex-1"
                      >
                        {ping?.loading ? <Spinner size="sm" className="mr-1" /> : machine.status === 'online' ? <Wifi size={12} className="mr-1" /> : <WifiOff size={12} className="mr-1" />}
                        Ping
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => { setTerminalMachine(machine); setTerminalGroup(null); setCommand(''); setExecResults([]); }}
                        className="flex-1"
                      >
                        <Terminal size={12} className="mr-1" /> Terminal
                      </Button>
                      <button onClick={() => openEdit(machine)} className="p-1.5 text-text-muted hover:text-text-primary rounded transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => deleteMachineMutation.mutate(machine.id)} className="p-1.5 text-text-muted hover:text-red-500 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => { setShowAddGroup(true); setGroupForm({ name: '', description: '' }); }}>
              <Plus size={14} className="mr-1.5" /> New Group
            </Button>
          </div>
          {loadingGroups ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : groups.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Layers size={40} className="mx-auto text-text-muted mb-3" />
                <p className="text-text-muted text-sm">No groups yet. Create one to manage machines together.</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {groups.map(group => {
                const groupMachines = machines.filter(m => m.group_id === group.id);
                return (
                  <div key={group.id} className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-text-primary font-semibold">{group.name}</h3>
                        {group.description && <p className="text-text-muted text-xs mt-0.5">{group.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{group.machine_count} machines</Badge>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => { setTerminalGroup(group); setTerminalMachine(null); setCommand(''); setExecResults([]); }}
                          disabled={group.machine_count === 0}
                        >
                          <Play size={12} className="mr-1" /> Run on Group
                        </Button>
                        <button onClick={() => { setEditGroup(group); setGroupForm({ name: group.name, description: group.description || '' }); }} className="p-1.5 text-text-muted hover:text-text-primary rounded">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteGroupMutation.mutate(group.id)} className="p-1.5 text-text-muted hover:text-red-500 rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {groupMachines.map(m => (
                        <div key={m.id} className="flex items-center gap-1.5 bg-[var(--surface-elevated)] rounded-full px-3 py-1">
                          <StatusDot status={m.status} />
                          <span className="text-text-secondary text-xs">{m.name}</span>
                        </div>
                      ))}
                      {groupMachines.length === 0 && <p className="text-text-muted text-xs">No machines in this group yet. Assign machines via the Machines tab.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Modal open={showAddMachine || !!editMachine} onClose={() => { setShowAddMachine(false); setEditMachine(null); setFormError(''); }} title={editMachine ? 'Edit Machine' : 'Add Machine'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={machineForm.name} onChange={e => setMachineForm(p => ({ ...p, name: e.target.value }))} placeholder="Mac Mini 1" />
            <Input label="Host / IP" value={machineForm.host} onChange={e => setMachineForm(p => ({ ...p, host: e.target.value }))} placeholder="192.168.1.10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="SSH Port" value={machineForm.ssh_port} onChange={e => setMachineForm(p => ({ ...p, ssh_port: e.target.value }))} placeholder="22" />
            <Input label="SSH User" value={machineForm.ssh_user} onChange={e => setMachineForm(p => ({ ...p, ssh_user: e.target.value }))} placeholder="kaustubh" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Auth Type</label>
            <select
              value={machineForm.ssh_auth_type}
              onChange={e => setMachineForm(p => ({ ...p, ssh_auth_type: e.target.value as 'key' | 'password' }))}
              className="w-full px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              <option value="key">SSH Private Key (recommended)</option>
              <option value="password">Password</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              {machineForm.ssh_auth_type === 'key' ? 'Private Key' : 'Password'}
              {editMachine && ' (leave blank to keep existing)'}
            </label>
            {machineForm.ssh_auth_type === 'key' ? (
              <textarea
                value={machineForm.ssh_credential}
                onChange={e => setMachineForm(p => ({ ...p, ssh_credential: e.target.value }))}
                rows={5}
                className="w-full px-4 py-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-text-primary font-mono text-xs placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent resize-y"
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
              />
            ) : (
              <Input
                type="password"
                value={machineForm.ssh_credential}
                onChange={e => setMachineForm(p => ({ ...p, ssh_credential: e.target.value }))}
                placeholder="SSH password"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Group (optional)</label>
            <select
              value={machineForm.group_id}
              onChange={e => setMachineForm(p => ({ ...p, group_id: e.target.value }))}
              className="w-full px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              <option value="">No group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <Input label="Description (optional)" value={machineForm.description} onChange={e => setMachineForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Video encoding machine" />
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <Button
            onClick={() => {
              if (editMachine) {
                const updateData: Partial<typeof blankForm> = { ...machineForm };
                if (!updateData.ssh_credential) delete (updateData as Record<string, unknown>).ssh_credential;
                updateMachineMutation.mutate({ id: editMachine.id, data: updateData });
              } else {
                createMachineMutation.mutate(machineForm);
              }
            }}
            disabled={!machineForm.name || !machineForm.host || !machineForm.ssh_user || (createMachineMutation.isPending || updateMachineMutation.isPending)}
            className="w-full"
          >
            {(createMachineMutation.isPending || updateMachineMutation.isPending) && <Spinner size="sm" className="mr-2" />}
            {editMachine ? 'Save Changes' : 'Add Machine'}
          </Button>
        </div>
      </Modal>

      <Modal open={!!terminalMachine || !!terminalGroup} onClose={() => { setTerminalMachine(null); setTerminalGroup(null); setExecResults([]); setCommand(''); }} title={terminalMachine ? `Terminal: ${terminalMachine.name}` : `Run on Group: ${terminalGroup?.name}`}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runExec()}
              placeholder="e.g. df -h"
              className="flex-1 px-4 py-2.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-text-primary font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
            <Button onClick={runExec} disabled={!command.trim() || execRunning} size="sm">
              {execRunning ? <Spinner size="sm" /> : <Play size={14} />}
            </Button>
          </div>
          {execResults.length > 0 && (
            <div className="space-y-2">
              {execResults.map((r, i) => (
                <div key={i} className="bg-[var(--bg)] rounded-lg p-4 font-mono text-xs text-green-400 space-y-1 max-h-64 overflow-y-auto">
                  {r.machine_name && <div className="text-[var(--text-muted)] text-[10px] mb-2">[{r.machine_name}]</div>}
                  {r.stdout && <pre className="whitespace-pre-wrap">{r.stdout}</pre>}
                  {r.stderr && <pre className="text-red-400 whitespace-pre-wrap">{r.stderr}</pre>}
                  <div className={`text-[10px] mt-2 ${r.exitCode === 0 ? 'text-[var(--text-secondary)]' : 'text-red-500'}`}>exit: {r.exitCode}</div>
                </div>
              ))}
            </div>
          )}
          {execRunning && (
            <div className="flex items-center gap-2 text-text-muted text-sm">
              <RefreshCw size={14} className="animate-spin" />
              Running command via SSH...
            </div>
          )}
        </div>
      </Modal>

      <Modal open={showAddGroup || !!editGroup} onClose={() => { setShowAddGroup(false); setEditGroup(null); }} title={editGroup ? 'Edit Group' : 'New Group'}>
        <div className="space-y-4">
          <Input label="Group Name" value={groupForm.name} onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. dev-macs" />
          <Input label="Description (optional)" value={groupForm.description} onChange={e => setGroupForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Development machines" />
          <Button
            onClick={() => {
              if (editGroup) updateGroupMutation.mutate({ id: editGroup.id, data: groupForm });
              else createGroupMutation.mutate(groupForm);
            }}
            disabled={!groupForm.name || createGroupMutation.isPending || updateGroupMutation.isPending}
            className="w-full"
          >
            {(createGroupMutation.isPending || updateGroupMutation.isPending) && <Spinner size="sm" className="mr-2" />}
            {editGroup ? 'Save Group' : 'Create Group'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
