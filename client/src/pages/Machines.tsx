import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Server, Plus, Trash2, Terminal, Wifi, WifiOff,
  RefreshCw, Play, Layers, Edit2, X, CheckCircle,
  Clock, Cpu, AlertCircle,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client';
import { Spinner } from '../components/ui/Spinner';

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

const STATUS_CONFIG: Record<string, { color: string; glow: string; label: string; icon: typeof CheckCircle }> = {
  online:  { color: '#30D158', glow: 'rgba(48,209,88,0.3)',  label: 'Online',  icon: CheckCircle },
  offline: { color: '#FF453A', glow: 'rgba(255,69,58,0.3)', label: 'Offline', icon: AlertCircle },
  unknown: { color: '#636366', glow: 'rgba(99,99,102,0.3)', label: 'Unknown', icon: Clock },
};

function timeSince(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)',
  display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
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
  const [formError, setFormError] = useState('');

  const blankForm = { name: '', host: '', ssh_port: '22', ssh_user: '', ssh_auth_type: 'key' as const, ssh_credential: '', group_id: '', description: '' };
  const [machineForm, setMachineForm] = useState(blankForm);
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });

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
  const onlineCount = machines.filter(m => m.status === 'online').length;
  const offlineCount = machines.filter(m => m.status === 'offline').length;

  const createMachineMutation = useMutation({
    mutationFn: (data: typeof blankForm) => apiPost('/v1/machines', { ...data, ssh_port: Number(data.ssh_port), group_id: data.group_id || undefined }),
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
      name: machine.name, host: machine.host, ssh_port: String(machine.ssh_port),
      ssh_user: machine.ssh_user, ssh_auth_type: machine.ssh_auth_type,
      ssh_credential: '', group_id: machine.group_id || '', description: machine.description || '',
    });
    setEditMachine(machine);
    setFormError('');
  }

  const showMachineForm = showAddMachine || !!editMachine;
  const showGroupForm = showAddGroup || !!editGroup;
  const showTerminal = !!terminalMachine || !!terminalGroup;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px', margin: '0 0 4px' }}>
            Machines
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Manage SSH-connected machines and groups for remote execution
          </p>
        </div>
        <button
          onClick={() => { setActiveTab('machines'); setShowAddMachine(true); setMachineForm(blankForm); setFormError(''); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '8px',
            backgroundColor: 'var(--accent)', border: 'none',
            color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Plus size={15} /> Add Machine
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Total Machines', value: machines.length, color: 'var(--text-primary)', icon: Server },
          { label: 'Online', value: onlineCount, color: '#30D158', icon: CheckCircle },
          { label: 'Offline', value: offlineCount, color: '#FF453A', icon: AlertCircle },
          { label: 'Groups', value: groups.length, color: '#64D2FF', icon: Layers },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} style={{
              backgroundColor: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '9px',
                backgroundColor: 'var(--surface-elevated)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={18} style={{ color: stat.color }} />
              </div>
              <div>
                <p style={{ fontSize: '22px', fontWeight: 700, color: stat.color, fontFamily: 'var(--font-heading)', margin: 0, lineHeight: 1 }}>
                  {stat.value}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                  {stat.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '1px' }}>
        {(['machines', 'groups'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
              borderRadius: '6px 6px 0 0', transition: 'all 150ms',
              backgroundColor: activeTab === tab ? 'var(--card)' : 'transparent',
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--text-muted)', backgroundColor: 'var(--surface-elevated)', padding: '1px 6px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              {tab === 'machines' ? machines.length : groups.length}
            </span>
          </button>
        ))}
      </div>

      {/* Machines list */}
      {activeTab === 'machines' && (
        <div>
          {loadingMachines ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><Spinner /></div>
          ) : machines.length === 0 ? (
            <div style={{
              backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px',
              padding: '60px 24px', textAlign: 'center',
            }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'var(--surface-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <Server size={28} style={{ color: 'var(--text-muted)' }} />
              </div>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>No machines registered</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px' }}>Add your Mac Minis or servers to manage them via SSH</p>
              <button
                onClick={() => setShowAddMachine(true)}
                style={{ padding: '9px 20px', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} /> Add First Machine
              </button>
            </div>
          ) : (
            <div style={{
              backgroundColor: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: '14px', overflow: 'hidden',
            }}>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '40px 1fr 160px 120px 100px 120px 140px',
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
              }}>
                {['', 'Machine', 'Host', 'Auth', 'Group', 'Last Ping', 'Actions'].map((h, i) => (
                  <div key={i} style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center' }}>
                    {h}
                  </div>
                ))}
              </div>
              {/* Table rows */}
              {machines.map((machine, idx) => {
                const ping = pingStates[machine.id];
                const sc = STATUS_CONFIG[machine.status] || STATUS_CONFIG.unknown;
                return (
                  <div
                    key={machine.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '40px 1fr 160px 120px 100px 120px 140px',
                      padding: '12px 16px', alignItems: 'center',
                      borderBottom: idx < machines.length - 1 ? '1px solid var(--border)' : 'none',
                      transition: 'background-color 150ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {/* Status dot */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{
                        width: '9px', height: '9px', borderRadius: '50%',
                        backgroundColor: sc.color,
                        boxShadow: `0 0 6px ${sc.glow}`,
                      }} />
                    </div>

                    {/* Name + desc */}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {machine.name}
                      </p>
                      {machine.description && (
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {machine.description}
                        </p>
                      )}
                    </div>

                    {/* Host */}
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {machine.ssh_user}@{machine.host}:{machine.ssh_port}
                    </div>

                    {/* Auth type */}
                    <div>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '5px',
                        backgroundColor: machine.ssh_auth_type === 'key' ? 'rgba(100,210,255,0.1)' : 'rgba(255,159,10,0.1)',
                        color: machine.ssh_auth_type === 'key' ? '#64D2FF' : '#FF9F0A',
                        textTransform: 'uppercase', letterSpacing: '0.3px',
                      }}>
                        {machine.ssh_auth_type === 'key' ? 'SSH Key' : 'Password'}
                      </span>
                    </div>

                    {/* Group */}
                    <div>
                      {machine.group_name ? (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', backgroundColor: 'var(--surface-elevated)', padding: '2px 8px', borderRadius: '5px', border: '1px solid var(--border)' }}>
                          {machine.group_name}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </div>

                    {/* Last ping */}
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {ping?.latency !== undefined
                        ? <span style={{ color: '#30D158', fontFamily: 'var(--font-mono)' }}>{ping.latency}ms</span>
                        : timeSince(machine.last_ping)
                      }
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ActionBtn
                        icon={ping?.loading ? RefreshCw : machine.status === 'online' ? Wifi : WifiOff}
                        onClick={() => pingMachine(machine)}
                        disabled={ping?.loading}
                        title="Ping"
                        spin={ping?.loading}
                      />
                      <ActionBtn
                        icon={Terminal}
                        onClick={() => { setTerminalMachine(machine); setTerminalGroup(null); setCommand(''); setExecResults([]); }}
                        title="SSH Terminal"
                      />
                      <ActionBtn icon={Edit2} onClick={() => openEdit(machine)} title="Edit" />
                      <ActionBtn
                        icon={Trash2}
                        onClick={() => deleteMachineMutation.mutate(machine.id)}
                        title="Delete"
                        danger
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Groups tab */}
      {activeTab === 'groups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setShowAddGroup(true); setGroupForm({ name: '', description: '' }); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
            >
              <Plus size={13} /> New Group
            </button>
          </div>

          {loadingGroups ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><Spinner /></div>
          ) : groups.length === 0 ? (
            <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '48px 24px', textAlign: 'center' }}>
              <Layers size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>No groups yet. Create one to run commands across multiple machines.</p>
            </div>
          ) : (
            groups.map(group => {
              const groupMachines = machines.filter(m => m.group_id === group.id);
              const onlineInGroup = groupMachines.filter(m => m.status === 'online').length;
              return (
                <div key={group.id} style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Layers size={16} style={{ color: 'var(--accent)' }} />
                        </div>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{group.name}</h3>
                        <span style={{ fontSize: '11px', color: '#30D158', backgroundColor: 'rgba(48,209,88,0.1)', padding: '2px 8px', borderRadius: '5px' }}>
                          {onlineInGroup}/{groupMachines.length} online
                        </span>
                      </div>
                      {group.description && (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 0 42px' }}>{group.description}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => { setTerminalGroup(group); setTerminalMachine(null); setCommand(''); setExecResults([]); }}
                        disabled={group.machine_count === 0}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '7px',
                          backgroundColor: 'var(--accent-soft)', border: '1px solid rgba(255,59,48,0.25)',
                          color: 'var(--accent)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                          opacity: group.machine_count === 0 ? 0.4 : 1,
                        }}
                      >
                        <Play size={12} fill="currentColor" /> Run on Group
                      </button>
                      <ActionBtn icon={Edit2} onClick={() => { setEditGroup(group); setGroupForm({ name: group.name, description: group.description || '' }); }} title="Edit" />
                      <ActionBtn icon={Trash2} onClick={() => deleteGroupMutation.mutate(group.id)} title="Delete" danger />
                    </div>
                  </div>

                  {/* Machines in group */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {groupMachines.map(m => {
                      const sc = STATUS_CONFIG[m.status] || STATUS_CONFIG.unknown;
                      return (
                        <div key={m.id} style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '5px 10px', borderRadius: '7px',
                          backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
                        }}>
                          <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: sc.color, flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{m.name}</span>
                        </div>
                      );
                    })}
                    {groupMachines.length === 0 && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>No machines in this group. Assign machines via the Machines tab.</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add/Edit Machine Slide-in Panel */}
      {showMachineForm && (
        <SlidePanel title={editMachine ? `Edit: ${editMachine.name}` : 'Add Machine'} onClose={() => { setShowAddMachine(false); setEditMachine(null); setFormError(''); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Name">
                <input style={fieldStyle} value={machineForm.name} onChange={e => setMachineForm(p => ({ ...p, name: e.target.value }))} placeholder="Mac Mini 1" />
              </Field>
              <Field label="Host / IP">
                <input style={fieldStyle} value={machineForm.host} onChange={e => setMachineForm(p => ({ ...p, host: e.target.value }))} placeholder="192.168.1.10" />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="SSH Port">
                <input style={fieldStyle} value={machineForm.ssh_port} onChange={e => setMachineForm(p => ({ ...p, ssh_port: e.target.value }))} placeholder="22" />
              </Field>
              <Field label="SSH User">
                <input style={fieldStyle} value={machineForm.ssh_user} onChange={e => setMachineForm(p => ({ ...p, ssh_user: e.target.value }))} placeholder="username" />
              </Field>
            </div>
            <Field label="Auth Type">
              <select style={{ ...fieldStyle, cursor: 'pointer' }} value={machineForm.ssh_auth_type} onChange={e => setMachineForm(p => ({ ...p, ssh_auth_type: e.target.value as 'key' | 'password' }))}>
                <option value="key">SSH Private Key (recommended)</option>
                <option value="password">Password</option>
              </select>
            </Field>
            <Field label={machineForm.ssh_auth_type === 'key' ? 'Private Key' : 'Password'}>
              {machineForm.ssh_auth_type === 'key' ? (
                <textarea
                  style={{ ...fieldStyle, fontFamily: 'var(--font-mono)', fontSize: '11px', minHeight: '120px', resize: 'vertical' }}
                  value={machineForm.ssh_credential}
                  onChange={e => setMachineForm(p => ({ ...p, ssh_credential: e.target.value }))}
                  placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----'}
                />
              ) : (
                <input type="password" style={fieldStyle} value={machineForm.ssh_credential} onChange={e => setMachineForm(p => ({ ...p, ssh_credential: e.target.value }))} placeholder="SSH password" />
              )}
            </Field>
            <Field label="Group (optional)">
              <select style={{ ...fieldStyle, cursor: 'pointer' }} value={machineForm.group_id} onChange={e => setMachineForm(p => ({ ...p, group_id: e.target.value }))}>
                <option value="">No group</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <Field label="Description (optional)">
              <input style={fieldStyle} value={machineForm.description} onChange={e => setMachineForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Video encoding machine" />
            </Field>
            {formError && (
              <div style={{ padding: '10px 12px', backgroundColor: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.25)', borderRadius: '8px', fontSize: '12px', color: '#FF453A' }}>
                {formError}
              </div>
            )}
            <button
              onClick={() => {
                if (editMachine) {
                  const updateData: Partial<typeof blankForm> = { ...machineForm };
                  if (!updateData.ssh_credential) delete (updateData as Record<string, unknown>).ssh_credential;
                  updateMachineMutation.mutate({ id: editMachine.id, data: updateData });
                } else {
                  createMachineMutation.mutate(machineForm);
                }
              }}
              disabled={!machineForm.name || !machineForm.host || !machineForm.ssh_user || createMachineMutation.isPending || updateMachineMutation.isPending}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                backgroundColor: 'var(--accent)', border: 'none', color: '#fff',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                opacity: (!machineForm.name || !machineForm.host || !machineForm.ssh_user) ? 0.5 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              {(createMachineMutation.isPending || updateMachineMutation.isPending) && <Spinner size="sm" />}
              {editMachine ? 'Save Changes' : 'Add Machine'}
            </button>
          </div>
        </SlidePanel>
      )}

      {/* Add/Edit Group Panel */}
      {showGroupForm && (
        <SlidePanel title={editGroup ? 'Edit Group' : 'New Group'} onClose={() => { setShowAddGroup(false); setEditGroup(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Field label="Group Name">
              <input style={fieldStyle} value={groupForm.name} onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. dev-macs" />
            </Field>
            <Field label="Description (optional)">
              <input style={fieldStyle} value={groupForm.description} onChange={e => setGroupForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Development machines" />
            </Field>
            <button
              onClick={() => { if (editGroup) updateGroupMutation.mutate({ id: editGroup.id, data: groupForm }); else createGroupMutation.mutate(groupForm); }}
              disabled={!groupForm.name || createGroupMutation.isPending || updateGroupMutation.isPending}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: 'var(--accent)', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {(createGroupMutation.isPending || updateGroupMutation.isPending) && <Spinner size="sm" />}
              {editGroup ? 'Save Group' : 'Create Group'}
            </button>
          </div>
        </SlidePanel>
      )}

      {/* SSH Terminal Panel */}
      {showTerminal && (
        <SlidePanel
          title={terminalMachine ? `SSH Terminal — ${terminalMachine.name}` : `Group Exec — ${terminalGroup?.name}`}
          onClose={() => { setTerminalMachine(null); setTerminalGroup(null); setExecResults([]); setCommand(''); }}
          wide
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={command}
                onChange={e => setCommand(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runExec()}
                placeholder="Enter command... (e.g. df -h, uptime, ls -la)"
                style={{ ...fieldStyle, fontFamily: 'var(--font-mono)', flex: 1 }}
              />
              <button
                onClick={runExec}
                disabled={!command.trim() || execRunning}
                style={{ padding: '9px 16px', borderRadius: '8px', backgroundColor: 'var(--accent)', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: !command.trim() ? 0.5 : 1 }}
              >
                {execRunning ? <Spinner size="sm" /> : <Play size={14} fill="currentColor" />}
                Run
              </button>
            </div>

            {execRunning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <RefreshCw size={13} className="animate-spin" /> Running via SSH...
              </div>
            )}

            {execResults.map((r, i) => (
              <div key={i} style={{ backgroundColor: '#0A0A0A', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                {r.machine_name && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '8px', letterSpacing: '0.3px' }}>
                    [{r.machine_name}]
                  </div>
                )}
                {r.stdout && <pre style={{ color: '#30D158', whiteSpace: 'pre-wrap', margin: 0 }}>{r.stdout}</pre>}
                {r.stderr && <pre style={{ color: '#FF453A', whiteSpace: 'pre-wrap', margin: 0 }}>{r.stderr}</pre>}
                <div style={{ color: r.exitCode === 0 ? 'var(--text-muted)' : '#FF453A', fontSize: '10px', marginTop: '8px' }}>
                  exit code: {r.exitCode}
                </div>
              </div>
            ))}
          </div>
        </SlidePanel>
      )}
    </div>
  );
}

function ActionBtn({ icon: Icon, onClick, disabled, title, danger, spin }: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  onClick?: () => void; disabled?: boolean; title?: string; danger?: boolean; spin?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '6px', border: '1px solid var(--border)', cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: 'var(--surface-elevated)',
        color: danger ? '#FF453A' : 'var(--text-secondary)',
        opacity: disabled ? 0.4 : 1, transition: 'all 150ms', flexShrink: 0,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.backgroundColor = danger ? 'rgba(255,69,58,0.12)' : 'var(--surface-hover)'; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; } }}
    >
      <Icon size={13} className={spin ? 'animate-spin' : ''} />
    </button>
  );
}

function SlidePanel({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'relative', width: wide ? '600px' : '440px', maxWidth: '90vw',
        height: '100%', backgroundColor: 'var(--card)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          padding: '18px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: 'var(--surface)', flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-elevated)', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
