import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { BoardChat } from '../components/board/BoardChat';
import {
  Plus, Calendar, X, MessageSquare, Clock, Paperclip, Download, Trash2, Upload,
  ChevronLeft, Tag, Bot, PanelRightOpen, PanelRightClose, ChevronDown,
  LayoutDashboard, Columns3, Tags, ShieldCheck, Layers, Cpu, Users,
  Network, Play, Pause, List, LayoutGrid, Filter, Settings, Copy,
  Pencil, ZapOff, AlertCircle, Activity, Building2,
} from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, Agent, Comment, Activity as ActivityType } from '../types';
import { useLocation } from 'react-router-dom';

interface TagObject {
  id: string;
  name: string;
  color: string;
}

interface TaskWithAgents extends Task {
  assignee_agents: { id: string; name: string }[] | null;
  tag_objects: TagObject[] | null;
}

interface TaskDetailResponse {
  task: TaskWithAgents;
  comments: (Comment & { author_name?: string })[];
  activities: (ActivityType & { actor_name?: string })[];
}

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'inbox', label: 'Inbox', color: '#6B7280' },
  { status: 'assigned', label: 'Assigned', color: '#3B82F6' },
  { status: 'in_progress', label: 'In Progress', color: '#F59E0B' },
  { status: 'waiting_on_human', label: 'Waiting', color: '#EC4899' },
  { status: 'blocked', label: 'Blocked', color: '#EF4444' },
  { status: 'review', label: 'Review', color: '#8B5CF6' },
  { status: 'done', label: 'Done', color: '#14B8A6' },
  { status: 'archived', label: 'Archived', color: '#9CA3AF' },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; strip: string; dot: string; text: string }> = {
  critical: { label: 'Critical', strip: '#EF4444', dot: 'bg-red-500', text: 'text-[var(--negative)]' },
  high: { label: 'High', strip: '#F97316', dot: 'bg-orange-500', text: 'text-orange-500' },
  medium: { label: 'Medium', strip: '#3B82F6', dot: 'bg-blue-500', text: 'text-blue-500' },
  low: { label: 'Low', strip: '#9CA3AF', dot: 'bg-[var(--text-secondary)]', text: 'text-[var(--text-secondary)]' },
};

const STATUS_DOT: Record<string, string> = {
  active: '#22C55E',
  idle: '#F59E0B',
  error: '#EF4444',
  disabled: '#6B7280',
};

const PRIORITY_BADGE: Record<TaskPriority, { bg: string; color: string }> = {
  critical: { bg: 'rgba(239,68,68,0.12)', color: '#EF4444' },
  high: { bg: 'rgba(249,115,22,0.12)', color: '#F97316' },
  medium: { bg: 'rgba(59,130,246,0.12)', color: '#60A5FA' },
  low: { bg: 'rgba(156,163,175,0.12)', color: '#9CA3AF' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function TagChip({ tag, small = false }: { tag: TagObject; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded border font-medium ${small ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'}`}
      style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }}
    >
      {tag.name}
    </span>
  );
}

type ViewMode = 'board' | 'list';
type WorkspaceMode = 'personal' | 'organisation';

function BoardSidebar({
  agents,
  filterTagId,
  setFilterTagId,
  tags,
  workspaceMode,
  setWorkspaceMode,
}: {
  agents: Agent[];
  filterTagId: string;
  setFilterTagId: (id: string) => void;
  tags: TagObject[];
  workspaceMode: WorkspaceMode;
  setWorkspaceMode: (m: WorkspaceMode) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const wsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) {
        setWsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function NavItem({ href, icon: Icon, label, indent = false }: { href: string; icon: typeof Bot; label: string; indent?: boolean }) {
    const isActive = location.pathname === href || location.pathname.startsWith(href + '?');
    return (
      <button
        onClick={() => navigate(href)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: indent ? '5px 12px 5px 28px' : '5px 12px',
          borderRadius: '6px', background: 'none', border: 'none', cursor: 'pointer',
          backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
          color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
          fontSize: '13px', fontWeight: isActive ? 600 : 400,
          transition: 'background-color 150ms',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <Icon size={14} style={{ flexShrink: 0, color: isActive ? 'var(--accent)' : 'var(--text-muted)' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </button>
    );
  }

  function SectionLabel({ label }: { label: string }) {
    return (
      <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '12px 12px 4px' }}>
        {label}
      </p>
    );
  }

  return (
    <div style={{
      width: '200px',
      flexShrink: 0,
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--surface)',
      overflowY: 'auto',
    }}>
      <div style={{ padding: '10px 10px 4px', position: 'relative' }} ref={wsRef}>
        <button
          onClick={() => setWsMenuOpen(!wsMenuOpen)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 10px', borderRadius: '8px',
            backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)',
            cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600,
          }}
        >
          <span>{workspaceMode === 'personal' ? 'Personal' : 'Organisation'}</span>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
        {wsMenuOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: '10px', right: '10px', zIndex: 50,
            backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', padding: '4px', marginTop: '2px',
          }}>
            {(['personal', 'organisation'] as WorkspaceMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setWorkspaceMode(m); setWsMenuOpen(false); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: '6px',
                  border: 'none', cursor: 'pointer', fontSize: '13px',
                  backgroundColor: workspaceMode === m ? 'var(--accent-soft)' : 'transparent',
                  color: workspaceMode === m ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: workspaceMode === m ? 600 : 400,
                }}
              >
                {m === 'personal' ? 'Personal' : 'Organisation'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: '0 4px 8px' }}>
        <SectionLabel label="Navigation" />
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <NavItem href="/activity" icon={Activity} label="Live feed" />

        <SectionLabel label="Boards" />
        <NavItem href="/boards" icon={Layers} label="Board groups" />
        <NavItem href="/kanban" icon={Columns3} label="Boards" />
        <NavItem href="/settings" icon={Tags} label="Tags" />
        <NavItem href="/approvals" icon={ShieldCheck} label="Approvals" />

        <SectionLabel label="Skills" />
        <NavItem href="/agents" icon={Bot} label="Agents" />
        <NavItem href="/automation" icon={ZapOff} label="Automation" />

        <SectionLabel label="Administration" />
        <NavItem href="/organisation" icon={Building2} label="Organization" />
        <NavItem href="/machines" icon={Network} label="Gateways" />

        {agents.length > 0 && (
          <>
            <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '8px 8px 4px' }} />
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '4px 12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Agents</span>
              <span style={{ fontWeight: 400, fontSize: '10px' }}>{agents.length}</span>
            </p>
            <div>
              {agents.map((agent) => (
                <Link
                  key={agent.id}
                  to={`/agents/${agent.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '5px 12px', borderRadius: '6px', textDecoration: 'none',
                    color: 'var(--text-secondary)', fontSize: '12px',
                  }}
                  className="group"
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      backgroundColor: 'rgba(255,59,48,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Bot size={12} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div style={{
                      position: 'absolute', bottom: '-1px', right: '-1px',
                      width: '7px', height: '7px', borderRadius: '50%',
                      backgroundColor: STATUS_DOT[agent.status] || STATUS_DOT.disabled,
                      border: '1.5px solid var(--surface)',
                    }} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name}</p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.role || agent.level}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function Board() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const boardGroupId = searchParams.get('boardGroupId');
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<TaskStatus>('inbox');
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [filterTagId, setFilterTagId] = useState<string>('');
  const [chatOpen, setChatOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [isPlaying, setIsPlaying] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('personal');
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: boardGroupData } = useQuery({
    queryKey: ['board-group', boardGroupId],
    queryFn: () => apiGet<{ board_groups: { id: string; name: string; color: string }[] }>('/v1/board-groups'),
    enabled: !!boardGroupId,
    select: (data) => data.board_groups.find((g) => g.id === boardGroupId),
  });

  const tasksUrl = boardGroupId ? `/v1/tasks?board_group_id=${boardGroupId}` : '/v1/tasks';

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', boardGroupId],
    queryFn: () => apiGet<{ tasks: TaskWithAgents[] }>(tasksUrl),
  });

  const { data: statsData } = useQuery({
    queryKey: ['taskStats'],
    queryFn: () => apiGet<{ stats: { status: TaskStatus; count: number }[] }>('/v1/tasks/stats'),
  });

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiGet<{ agents: Agent[] }>('/v1/agents'),
  });

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => apiGet<{ tags: TagObject[] }>('/v1/tags'),
  });

  const allTags = tagsData?.tags ?? [];

  const tasks = (tasksData?.tasks ?? []).filter((t) => {
    if (!filterTagId) return true;
    return t.tag_objects?.some((tg) => tg.id === filterTagId);
  });
  const agents = agentsData?.agents ?? [];
  const statsCounts = (statsData?.stats ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = s.count;
    return acc;
  }, {});

  const tasksByStatus = COLUMNS.reduce<Record<TaskStatus, TaskWithAgents[]>>((acc, col) => {
    acc[col.status] = tasks.filter((t) => t.status === col.status);
    return acc;
  }, {} as Record<TaskStatus, TaskWithAgents[]>);

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiPatch<{ task: Task }>(`/v1/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskStats'] });
    },
  });

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetStatus: TaskStatus) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      setDragOverColumn(null);
      setDraggedTaskId(null);
      if (taskId) {
        const task = tasks.find((t) => t.id === taskId);
        if (task && task.status !== targetStatus) {
          updateTaskMutation.mutate({ id: taskId, data: { status: targetStatus } });
        }
      }
    },
    [tasks, updateTaskMutation]
  );

  const openCreateModal = (status: TaskStatus) => {
    setCreateDefaultStatus(status);
    setCreateModalOpen(true);
  };

  const boardTitle = boardGroupId ? (boardGroupData?.name ?? 'Board') : 'Mission Control';

  function ToolbarBtn({ icon: Icon, onClick, active = false, title }: { icon: typeof Play; onClick?: () => void; active?: boolean; title?: string }) {
    return (
      <button
        onClick={onClick}
        title={title}
        style={{
          width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '6px', border: '1px solid var(--border)', cursor: 'pointer',
          backgroundColor: active ? 'var(--accent-soft)' : 'var(--surface-elevated)',
          color: active ? 'var(--accent)' : 'var(--text-secondary)',
          transition: 'all 150ms',
        }}
        onMouseEnter={(e) => { if (!active) { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
        onMouseLeave={(e) => { if (!active) { e.currentTarget.style.backgroundColor = 'var(--surface-elevated)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
      >
        <Icon size={14} />
      </button>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 48px - 32px)', display: 'flex', flexDirection: 'column', minHeight: 0, margin: '-24px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <BoardSidebar
          agents={agents}
          filterTagId={filterTagId}
          setFilterTagId={setFilterTagId}
          tags={allTags}
          workspaceMode={workspaceMode}
          setWorkspaceMode={setWorkspaceMode}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <div style={{
            padding: '16px 20px 12px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                {boardGroupId && (
                  <Link
                    to="/boards"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '4px' }}
                  >
                    <ChevronLeft size={14} />
                    Boards
                  </Link>
                )}
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                  {boardTitle}
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Keep tasks moving through your workflow.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', backgroundColor: 'var(--surface-elevated)', borderRadius: '7px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <button
                  onClick={() => setViewMode('board')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px',
                    fontSize: '12px', fontWeight: viewMode === 'board' ? 600 : 400, border: 'none', cursor: 'pointer',
                    backgroundColor: viewMode === 'board' ? 'var(--accent)' : 'transparent',
                    color: viewMode === 'board' ? '#fff' : 'var(--text-muted)',
                    transition: 'all 150ms',
                  }}
                >
                  <LayoutGrid size={13} /> Board
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px',
                    fontSize: '12px', fontWeight: viewMode === 'list' ? 600 : 400, border: 'none', cursor: 'pointer',
                    backgroundColor: viewMode === 'list' ? 'var(--accent)' : 'transparent',
                    color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                    transition: 'all 150ms',
                  }}
                >
                  <List size={13} /> List
                </button>
              </div>

              <button
                onClick={() => openCreateModal('inbox')}
                style={{
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '6px', border: '1px solid var(--border)', cursor: 'pointer',
                  backgroundColor: 'var(--accent)', color: '#fff',
                }}
              >
                <Plus size={14} />
              </button>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)', margin: '0 2px' }} />

              <ToolbarBtn icon={isPlaying ? Pause : Play} onClick={() => setIsPlaying(p => !p)} active={isPlaying} title={isPlaying ? 'Pause automation' : 'Run automation'} />
              <ToolbarBtn icon={Filter} onClick={() => setFilterOpen(f => !f)} active={filterOpen} title="Filter" />
              <ToolbarBtn icon={Copy} title="Duplicate board" />
              <ToolbarBtn icon={Pencil} title="Edit board" />
              <ToolbarBtn icon={Settings} title="Board settings" />

              <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)', margin: '0 2px' }} />

              <ToolbarBtn icon={chatOpen ? PanelRightClose : PanelRightOpen} onClick={() => setChatOpen(p => !p)} active={chatOpen} title={chatOpen ? 'Hide chat' : 'Show chat'} />

              {filterOpen && allTags.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                  <Tag size={13} style={{ color: 'var(--text-muted)' }} />
                  <select
                    value={filterTagId}
                    onChange={(e) => setFilterTagId(e.target.value)}
                    style={{
                      fontSize: '12px', padding: '4px 8px', backgroundColor: 'var(--surface-elevated)',
                      border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none',
                    }}
                  >
                    <option value="">All tags</option>
                    {allTags.map((tag) => (
                      <option key={tag.id} value={tag.id}>{tag.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {tasksLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              <Spinner size="lg" />
            </div>
          ) : viewMode === 'board' ? (
            <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden', minHeight: 0 }}>
              <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
                <div style={{ display: 'flex', gap: '10px', padding: '12px', height: '100%', minWidth: 'max-content' }}>
                  {COLUMNS.map((col) => {
                    const count = filterTagId ? tasksByStatus[col.status].length : (statsCounts[col.status] ?? tasksByStatus[col.status].length);
                    const isDragOver = dragOverColumn === col.status;
                    return (
                      <div
                        key={col.status}
                        style={{
                          width: '230px', flexShrink: 0, display: 'flex', flexDirection: 'column',
                          backgroundColor: isDragOver ? 'var(--accent-soft)' : 'var(--surface-elevated)',
                          borderRadius: '10px', border: `1px solid ${isDragOver ? 'var(--accent)' : 'var(--border)'}`,
                          transition: 'all 150ms',
                        }}
                        onDragOver={(e) => handleDragOver(e, col.status)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.status)}
                      >
                        <div style={{
                          padding: '10px 12px 8px',
                          borderBottom: '1px solid var(--border)',
                          borderTop: `3px solid ${col.color}`,
                          borderRadius: '10px 10px 0 0',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: col.color }} />
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{col.label}</span>
                              <span style={{
                                fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600,
                                backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                                borderRadius: '999px', padding: '0px 6px',
                              }}>{count}</span>
                            </div>
                            <button
                              onClick={() => openCreateModal(col.status)}
                              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px', padding: '2px' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {tasksByStatus[col.status].length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '11px', color: 'var(--text-muted)' }}>No tasks</div>
                          ) : (
                            tasksByStatus[col.status].map((task) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                onDragStart={handleDragStart}
                                isDragging={draggedTaskId === task.id}
                                onClick={() => setDetailTaskId(task.id)}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {chatOpen && (
                <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)' }}>
                  <BoardChat onClose={() => setChatOpen(false)} />
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              <ListView tasks={tasks} agents={agents} onClickTask={(id) => setDetailTaskId(id)} onStatusChange={(id, status) => updateTaskMutation.mutate({ id, data: { status } })} />
            </div>
          )}
        </div>
      </div>

      {createModalOpen && (
        <CreateTaskModal
          defaultStatus={createDefaultStatus}
          agents={agents}
          tags={allTags}
          boardGroupId={boardGroupId}
          onClose={() => setCreateModalOpen(false)}
        />
      )}

      {detailTaskId && (
        <TaskDetailModal
          taskId={detailTaskId}
          agents={agents}
          tags={allTags}
          onClose={() => setDetailTaskId(null)}
        />
      )}
    </div>
  );
}

function ListView({ tasks, agents, onClickTask, onStatusChange }: {
  tasks: TaskWithAgents[];
  agents: Agent[];
  onClickTask: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}) {
  return (
    <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Task', 'Status', 'Priority', 'Assignee', 'Due'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No tasks yet</td>
            </tr>
          ) : tasks.map((task, i) => {
            const prio = PRIORITY_BADGE[task.priority];
            const col = COLUMNS.find(c => c.status === task.status);
            return (
              <tr
                key={task.id}
                style={{ borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                onClick={() => onClickTask(task.id)}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, maxWidth: '300px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const }}>{task.title}</span>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 500, color: col?.color, backgroundColor: (col?.color || '#888') + '15', padding: '2px 8px', borderRadius: '999px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: col?.color || '#888' }} />
                    {col?.label}
                  </span>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: prio.color, backgroundColor: prio.bg, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                    {task.priority}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {task.assignee_agents?.length ? task.assignee_agents[0].name : 'Unassigned'}
                </td>
                <td style={{ padding: '10px 16px', fontSize: '12px', color: task.due_date && isOverdue(task.due_date) && task.status !== 'done' ? '#EF4444' : 'var(--text-muted)' }}>
                  {task.due_date ? formatDate(task.due_date) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TaskCard({
  task,
  onDragStart,
  isDragging,
  onClick,
}: {
  task: TaskWithAgents;
  onDragStart: (e: React.DragEvent, id: string) => void;
  isDragging: boolean;
  onClick: () => void;
}) {
  const priority = PRIORITY_CONFIG[task.priority];
  const prioBadge = PRIORITY_BADGE[task.priority];
  const assignees = task.assignee_agents ?? [];
  const tagObjects = task.tag_objects ?? [];
  const displayTags = tagObjects.slice(0, 2);
  const extraTags = tagObjects.length - displayTags.length;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={onClick}
      style={{
        borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)',
        cursor: 'pointer', overflow: 'hidden', display: 'flex',
        opacity: isDragging ? 0.5 : 1, transform: isDragging ? 'scale(0.96)' : 'scale(1)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        transition: 'box-shadow 150ms, border-color 150ms',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)')}
    >
      <div style={{ width: '3px', flexShrink: 0, backgroundColor: priority.strip }} />
      <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, lineHeight: '1.4' }}>{task.title}</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px',
            backgroundColor: prioBadge.bg, color: prioBadge.color, textTransform: 'uppercase', letterSpacing: '0.3px',
          }}>{task.priority}</span>
          {task.is_blocked && (
            <Badge variant="error" className="text-[8px] px-1 py-0">BLOCKED</Badge>
          )}
        </div>

        {displayTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {displayTags.map((tag) => <TagChip key={tag.id} tag={tag} small />)}
            {extraTags > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{extraTags}</span>}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {assignees.slice(0, 3).map((a) => (
              <div
                key={a.id}
                style={{
                  width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '8px', fontWeight: 700, color: '#fff', border: '1.5px solid var(--card)',
                }}
                title={a.name}
              >
                {getInitials(a.name)}
              </div>
            ))}
            {assignees.length === 0 && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Unassigned</span>
            )}
          </div>
          {task.due_date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: isOverdue(task.due_date) && task.status !== 'done' ? '#EF4444' : 'var(--text-muted)' }}>
              <Calendar size={9} />
              {formatDate(task.due_date)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TagMultiSelect({
  tags,
  selected,
  onChange,
}: {
  tags: TagObject[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = tags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const selectedTags = tags.filter((t) => selected.includes(t.id));

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--text)]">Tags</label>
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full text-xs px-2.5 py-0.5 font-medium border"
              style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }}
            >
              {tag.name}
              <button onClick={() => toggle(tag.id)} className="hover:opacity-70">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search tags..."
        className="w-full px-3 py-1.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
          {filtered.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              className={`inline-flex items-center rounded border text-xs px-2 py-0.5 font-medium transition-opacity ${selected.includes(tag.id) ? 'opacity-100 ring-2 ring-offset-1' : 'opacity-70 hover:opacity-100'}`}
              style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
      {filtered.length === 0 && search && (
        <p className="text-xs text-[var(--text-muted)]">No tags match. Create tags in Settings.</p>
      )}
    </div>
  );
}

function CreateTaskModal({
  defaultStatus,
  agents,
  tags,
  boardGroupId,
  onClose,
}: {
  defaultStatus: TaskStatus;
  agents: Agent[];
  tags: TagObject[];
  boardGroupId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<{ task: Task }>('/v1/tasks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskStats'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    createMutation.mutate({
      title: title.trim(), description, priority, status,
      assignees: selectedAssignees, tag_ids: selectedTagIds,
      due_date: dueDate || null, board_group_id: boardGroupId || null,
    });
  };

  const toggleAssignee = (id: string) => {
    setSelectedAssignees((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">Create Task</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" required />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--text)]">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Task description..." rows={3}
              className="w-full px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-colors resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--text)]">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent">
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--text)]">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent">
                {COLUMNS.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}
              </select>
            </div>
          </div>
          {agents.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--text)]">Assignees</label>
              <div className="flex flex-wrap gap-2">
                {agents.map((agent) => (
                  <button key={agent.id} type="button" onClick={() => toggleAssignee(agent.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${selectedAssignees.includes(agent.id) ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'}`}>
                    {agent.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tags.length > 0 && <TagMultiSelect tags={tags} selected={selectedTagIds} onChange={setSelectedTagIds} />}
          <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Spinner size="sm" className="mr-2" /> : null} Create Task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskDetailModal({ taskId, agents, tags, onClose }: { taskId: string; agents: Agent[]; tags: TagObject[]; onClose: () => void; }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => apiGet<TaskDetailResponse>(`/v1/tasks/${taskId}`),
  });

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<TaskStatus>('inbox');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editAssignees, setEditAssignees] = useState<string[]>([]);
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [editDueDate, setEditDueDate] = useState('');
  const [editBlocked, setEditBlocked] = useState(false);
  const [editBlockerReason, setEditBlockerReason] = useState('');
  const [commentText, setCommentText] = useState('');
  const [initialized, setInitialized] = useState(false);

  const task = data?.task;
  const comments = data?.comments ?? [];
  const activities = data?.activities ?? [];

  useEffect(() => {
    if (task && !initialized) {
      setEditTitle(task.title);
      setEditDescription(task.description || '');
      setEditStatus(task.status);
      setEditPriority(task.priority);
      setEditAssignees(task.assignees || []);
      setEditTagIds((task.tag_objects ?? []).map((t) => t.id));
      setEditDueDate(task.due_date ? task.due_date.split('T')[0] : '');
      setEditBlocked(task.is_blocked);
      setEditBlockerReason(task.blocker_reason || '');
      setInitialized(true);
    }
  }, [task, initialized]);

  const updateMutation = useMutation({
    mutationFn: (updateData: Record<string, unknown>) => apiPatch<{ task: Task }>(`/v1/tasks/${taskId}`, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskStats'] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      onClose();
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => apiPost<{ comment: Comment }>(`/v1/tasks/${taskId}/comments`, { content }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['task', taskId] }); setCommentText(''); },
  });

  interface Deliverable {
    id: string; task_id: string; uploaded_by: string; uploader_type: string;
    original_filename: string; mime_type: string; file_size: number; created_at: string;
  }

  const { data: deliverablesData, isLoading: deliverablesLoading } = useQuery({
    queryKey: ['deliverables', taskId],
    queryFn: () => apiGet<Deliverable[]>(`/v1/tasks/${taskId}/deliverables`),
  });

  const deliverables = deliverablesData ?? [];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('squidjob_token');
      await fetch(`/api/v1/tasks/${taskId}/deliverables`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      queryClient.invalidateQueries({ queryKey: ['deliverables', taskId] });
    } catch (err) { console.error('Upload failed:', err); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const deleteDeliverableMutation = useMutation({
    mutationFn: (deliverableId: string) => apiDelete(`/v1/tasks/${taskId}/deliverables/${deliverableId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deliverables', taskId] }),
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = (deliverableId: string, filename: string) => {
    const token = localStorage.getItem('squidjob_token');
    fetch(`/api/v1/deliverables/${deliverableId}/download`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
      });
  };

  const handleSave = () => {
    updateMutation.mutate({
      title: editTitle, description: editDescription, status: editStatus, priority: editPriority,
      assignees: editAssignees, tag_ids: editTagIds, due_date: editDueDate || null,
      is_blocked: editBlocked, blocker_reason: editBlocked ? editBlockerReason : null,
    });
  };

  const toggleAssignee = (id: string) => {
    setEditAssignees((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">Task Details</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"><X size={20} /></button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : task ? (
          <div className="p-6 space-y-5">
            <Input label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--text)]">Status</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                  className="w-full px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent">
                  {COLUMNS.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--text)]">Priority</label>
                <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                  className="w-full px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--text)]">Description</label>
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4}
                className="w-full px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-colors resize-none"
              />
            </div>

            {agents.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--text)]">Assignees</label>
                <div className="flex flex-wrap gap-2">
                  {agents.map((agent) => (
                    <button key={agent.id} type="button" onClick={() => toggleAssignee(agent.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${editAssignees.includes(agent.id) ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'}`}>
                      {agent.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tags.length > 0 && <TagMultiSelect tags={tags} selected={editTagIds} onChange={setEditTagIds} />}

            <div className="grid grid-cols-2 gap-4">
              <Input label="Due Date" type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editBlocked} onChange={(e) => setEditBlocked(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border)] bg-[var(--card)] text-red-500 focus:ring-red-500" />
                <span className="text-sm font-medium text-red-500">Blocked</span>
              </label>
              {editBlocked && (
                <textarea value={editBlockerReason} onChange={(e) => setEditBlockerReason(e.target.value)} placeholder="Reason for blocking..." rows={2}
                  className="w-full px-4 py-2.5 bg-[var(--card)] border border-[rgba(255,59,48,0.3)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors resize-none"
                />
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Spinner size="sm" className="mr-2" /> : null} Save Changes
              </Button>
            </div>

            <div className="border-t border-[var(--border)] pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Paperclip size={16} className="text-[var(--text-secondary)]" />
                  <h3 className="text-sm font-semibold text-[var(--text)]">Deliverables</h3>
                </div>
                <div>
                  <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
                  <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Spinner size="sm" className="mr-1" /> : <Upload size={14} className="mr-1" />} Upload
                  </Button>
                </div>
              </div>
              {deliverablesLoading ? <div className="flex justify-center py-4"><Spinner size="sm" /></div>
                : deliverables.length === 0 ? <p className="text-xs text-[var(--text-muted)]">No files attached</p>
                : (
                  <div className="space-y-2">
                    {deliverables.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)]">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--text)] truncate">{d.original_filename}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">{formatFileSize(d.file_size)} · {relativeTime(d.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                          <button onClick={() => handleDownload(d.id, d.original_filename)} className="p-1.5 rounded hover:bg-[var(--card)] text-[var(--text-muted)] hover:text-blue-500 transition-colors" title="Download"><Download size={14} /></button>
                          <button onClick={() => deleteDeliverableMutation.mutate(d.id)} className="p-1.5 rounded hover:bg-[var(--card)] text-[var(--text-muted)] hover:text-red-500 transition-colors" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <div className="border-t border-[var(--border)] pt-5 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-[var(--text-secondary)]" />
                <h3 className="text-sm font-semibold text-[var(--text)]">Comments</h3>
              </div>
              {comments.length === 0 ? <p className="text-xs text-[var(--text-muted)]">No comments yet</p> : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">{comment.author_name || 'Unknown'}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">{relativeTime(comment.created_at)}</span>
                      </div>
                      <p className="text-sm text-[var(--text)]">{comment.content}</p>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); if (commentText.trim()) addCommentMutation.mutate(commentText.trim()); }} className="flex gap-2">
                <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..." rows={2}
                  className="flex-1 px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-colors resize-none text-sm"
                />
                <Button type="submit" size="sm" disabled={!commentText.trim() || addCommentMutation.isPending} className="self-end">
                  {addCommentMutation.isPending ? <Spinner size="sm" /> : 'Send'}
                </Button>
              </form>
            </div>

            {activities.length > 0 && (
              <div className="border-t border-[var(--border)] pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-[var(--text-secondary)]" />
                  <h3 className="text-sm font-semibold text-[var(--text)]">Activity</h3>
                </div>
                <div className="space-y-2">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--surface-elevated)] mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <span className="text-[var(--text-secondary)]">{activity.actor_name || 'System'}</span>{' '}
                        <span className="text-[var(--text-muted)]">{activity.action.replace(/_/g, ' ')}</span>
                        {activity.metadata && (activity.metadata as Record<string, string>).from && (
                          <span className="text-[var(--text-muted)]"> {(activity.metadata as Record<string, string>).from} → {(activity.metadata as Record<string, string>).to}</span>
                        )}
                      </div>
                      <span className="text-[var(--text-muted)] shrink-0">{relativeTime(activity.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-[var(--text-muted)]">Task not found</div>
        )}
      </div>
    </div>
  );
}
