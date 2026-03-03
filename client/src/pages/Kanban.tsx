import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { Plus, Calendar, X, MessageSquare, Clock, Paperclip, Download, Trash2, Upload, ChevronLeft, Tag } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, Agent, Comment, Activity } from '../types';

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
  activities: (Activity & { actor_name?: string })[];
}

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'inbox', label: 'Inbox', color: '#6B7280' },
  { status: 'assigned', label: 'Assigned', color: '#3B82F6' },
  { status: 'in_progress', label: 'In Progress', color: '#F59E0B' },
  { status: 'waiting_on_human', label: 'Waiting on Human', color: '#EC4899' },
  { status: 'blocked', label: 'Blocked', color: '#EF4444' },
  { status: 'review', label: 'Review', color: '#8B5CF6' },
  { status: 'done', label: 'Done', color: '#14B8A6' },
  { status: 'archived', label: 'Archived', color: '#9CA3AF' },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; strip: string; dot: string; text: string }> = {
  critical: { label: 'Critical', strip: '#EF4444', dot: 'bg-red-500', text: 'text-red-600' },
  high: { label: 'High', strip: '#F97316', dot: 'bg-orange-500', text: 'text-orange-600' },
  medium: { label: 'Medium', strip: '#3B82F6', dot: 'bg-blue-500', text: 'text-blue-600' },
  low: { label: 'Low', strip: '#9CA3AF', dot: 'bg-gray-400', text: 'text-text-secondary' },
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
  const style: React.CSSProperties = {
    backgroundColor: tag.color + '20',
    color: tag.color,
    borderColor: tag.color + '40',
  };
  return (
    <span
      className={`inline-flex items-center rounded border font-medium ${small ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'}`}
      style={style}
    >
      {tag.name}
    </span>
  );
}

export function Kanban() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const boardGroupId = searchParams.get('boardGroupId');
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<TaskStatus>('inbox');
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [filterTagId, setFilterTagId] = useState<string>('');

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

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {boardGroupId && (
            <Link
              to="/boards"
              className="flex items-center gap-1 text-sm text-text-secondary hover:text-brand-accent transition-colors"
            >
              <ChevronLeft size={16} />
              Boards
            </Link>
          )}
          {boardGroupId && <span className="text-text-muted">/</span>}
          <h1 className="text-xl font-bold text-text-primary font-heading">
            {boardGroupId ? (boardGroupData?.name ?? 'Board') : 'Mission Queue'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {allTags.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-text-muted" />
              <select
                value={filterTagId}
                onChange={(e) => setFilterTagId(e.target.value)}
                className="text-sm px-3 py-1.5 bg-white border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
              >
                <option value="">All tags</option>
                {allTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </select>
            </div>
          )}
          <Button size="sm" onClick={() => openCreateModal('inbox')}>
            <Plus size={16} className="mr-1.5" /> New Task
          </Button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
        {COLUMNS.map((col) => (
          <div
            key={col.status}
            className={`flex-none w-64 bg-surface-light rounded-xl border flex flex-col transition-colors ${
              dragOverColumn === col.status ? 'border-brand-accent bg-blue-50' : 'border-border-default'
            }`}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.status)}
          >
            <div
              className="px-4 py-3 border-b border-border-default rounded-t-xl"
              style={{ borderTopWidth: 3, borderTopColor: col.color, borderTopStyle: 'solid' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{col.label}</span>
                  <span className="text-xs text-text-secondary bg-white px-2 py-0.5 rounded-full border border-border-default">
                    {filterTagId ? tasksByStatus[col.status].length : (statsCounts[col.status] ?? tasksByStatus[col.status].length)}
                  </span>
                </div>
                <button
                  onClick={() => openCreateModal(col.status)}
                  className="text-text-muted hover:text-text-primary transition-colors p-0.5 rounded hover:bg-white"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {tasksByStatus[col.status].length === 0 ? (
                <div className="text-center py-8 text-text-muted text-xs">No tasks</div>
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
        ))}
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
  const assignees = task.assignee_agents ?? [];
  const tagObjects = task.tag_objects ?? [];
  const displayTags = tagObjects.slice(0, 3);
  const extraTags = tagObjects.length - displayTags.length;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={onClick}
      className={`rounded-lg border border-border-default bg-white shadow-sm hover:shadow-md hover:border-gray-300 cursor-pointer transition-all overflow-hidden flex ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
    >
      <div
        className="w-1 shrink-0"
        style={{ backgroundColor: priority.strip }}
      />
      <div className="p-3 flex-1 space-y-2 min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">{task.title}</p>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium ${priority.text}`}>{priority.label}</span>
          {task.is_blocked && (
            <Badge variant="error" className="text-[10px] px-1.5 py-0">BLOCKED</Badge>
          )}
        </div>

        {tagObjects.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {displayTags.map((tag) => (
              <TagChip key={tag.id} tag={tag} small />
            ))}
            {extraTags > 0 && (
              <span className="text-[10px] text-text-muted">+{extraTags}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex -space-x-1">
            {assignees.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center text-white text-[8px] font-bold border border-white"
                title={a.name}
              >
                {getInitials(a.name)}
              </div>
            ))}
            {assignees.length === 0 && (
              <span className="text-[10px] text-text-muted">Unassigned</span>
            )}
          </div>
          {task.due_date && (
            <div className={`flex items-center gap-1 text-[10px] ${isOverdue(task.due_date) && task.status !== 'done' ? 'text-red-500' : 'text-text-muted'}`}>
              <Calendar size={10} />
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
      <label className="block text-sm font-medium text-text-primary">Tags</label>
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
        className="w-full px-3 py-1.5 bg-white border border-border-default rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent"
      />
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
          {filtered.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              className={`inline-flex items-center rounded border text-xs px-2 py-0.5 font-medium transition-opacity ${selected.includes(tag.id) ? 'opacity-100 ring-2 ring-offset-1' : 'opacity-70 hover:opacity-100'}`}
              style={{
                backgroundColor: tag.color + '20',
                color: tag.color,
                borderColor: tag.color + '40',
                ringColor: tag.color,
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
      {filtered.length === 0 && search && (
        <p className="text-xs text-text-muted">No tags match. Create tags in Settings.</p>
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
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    createMutation.mutate({
      title: title.trim(),
      description,
      priority,
      status,
      assignees: selectedAssignees,
      tag_ids: selectedTagIds,
      due_date: dueDate || null,
      board_group_id: boardGroupId || null,
    });
  };

  const toggleAssignee = (id: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-border-default rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <h2 className="text-lg font-semibold text-text-primary">Create Task</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}

          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            required
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-primary">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description..."
              rows={3}
              className="w-full px-4 py-2.5 bg-white border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-4 py-2.5 bg-white border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-4 py-2.5 bg-white border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
              >
                {COLUMNS.map((c) => (
                  <option key={c.status} value={c.status}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {agents.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">Assignees</label>
              <div className="flex flex-wrap gap-2">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleAssignee(agent.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      selectedAssignees.includes(agent.id)
                        ? 'bg-blue-50 border-blue-300 text-blue-600'
                        : 'bg-surface-light border-border-default text-text-secondary hover:border-gray-300'
                    }`}
                  >
                    {agent.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tags.length > 0 && (
            <TagMultiSelect tags={tags} selected={selectedTagIds} onChange={setSelectedTagIds} />
          )}

          <Input
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Spinner size="sm" className="mr-2" /> : null}
              Create Task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskDetailModal({
  taskId,
  agents,
  tags,
  onClose,
}: {
  taskId: string;
  agents: Agent[];
  tags: TagObject[];
  onClose: () => void;
}) {
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

  const updateMutation = useMutation({
    mutationFn: (updateData: Record<string, unknown>) =>
      apiPatch<{ task: Task }>(`/v1/tasks/${taskId}`, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskStats'] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      onClose();
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) =>
      apiPost<{ comment: Comment }>(`/v1/tasks/${taskId}/comments`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setCommentText('');
    },
  });

  interface Deliverable {
    id: string;
    task_id: string;
    uploaded_by: string;
    uploader_type: string;
    original_filename: string;
    mime_type: string;
    file_size: number;
    created_at: string;
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
      await fetch(`/api/v1/tasks/${taskId}/deliverables`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      queryClient.invalidateQueries({ queryKey: ['deliverables', taskId] });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteDeliverableMutation = useMutation({
    mutationFn: (deliverableId: string) =>
      apiDelete(`/v1/tasks/${taskId}/deliverables/${deliverableId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverables', taskId] });
    },
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = (deliverableId: string, filename: string) => {
    const token = localStorage.getItem('squidjob_token');
    const url = `/api/v1/deliverables/${deliverableId}/download`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  };

  const handleSave = () => {
    updateMutation.mutate({
      title: editTitle,
      description: editDescription,
      status: editStatus,
      priority: editPriority,
      assignees: editAssignees,
      tag_ids: editTagIds,
      due_date: editDueDate || null,
      is_blocked: editBlocked,
      blocker_reason: editBlocked ? editBlockerReason : null,
    });
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      addCommentMutation.mutate(commentText.trim());
    }
  };

  const toggleAssignee = (id: string) => {
    setEditAssignees((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-border-default rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <h2 className="text-lg font-semibold text-text-primary">Task Details</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : task ? (
          <div className="p-6 space-y-5">
            <Input
              label="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                  className="w-full px-4 py-2.5 bg-white border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                >
                  {COLUMNS.map((c) => (
                    <option key={c.status} value={c.status}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Priority</label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                  className="w-full px-4 py-2.5 bg-white border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 bg-white border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-colors resize-none"
              />
            </div>

            {agents.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-primary">Assignees</label>
                <div className="flex flex-wrap gap-2">
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggleAssignee(agent.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        editAssignees.includes(agent.id)
                          ? 'bg-blue-50 border-blue-300 text-blue-600'
                          : 'bg-surface-light border-border-default text-text-secondary hover:border-gray-300'
                      }`}
                    >
                      {agent.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tags.length > 0 && (
              <TagMultiSelect tags={tags} selected={editTagIds} onChange={setEditTagIds} />
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Due Date"
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editBlocked}
                  onChange={(e) => setEditBlocked(e.target.checked)}
                  className="w-4 h-4 rounded border-border-default bg-white text-red-500 focus:ring-red-500"
                />
                <span className="text-sm font-medium text-red-500">Blocked</span>
              </label>
              {editBlocked && (
                <textarea
                  value={editBlockerReason}
                  onChange={(e) => setEditBlockerReason(e.target.value)}
                  placeholder="Reason for blocking..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-white border border-red-200 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors resize-none"
                />
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Spinner size="sm" className="mr-2" /> : null}
                Save Changes
              </Button>
            </div>

            <div className="border-t border-border-default pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Paperclip size={16} className="text-text-secondary" />
                  <h3 className="text-sm font-semibold text-text-primary">Deliverables</h3>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Spinner size="sm" className="mr-1" /> : <Upload size={14} className="mr-1" />}
                    Upload
                  </Button>
                </div>
              </div>

              {deliverablesLoading ? (
                <div className="flex justify-center py-4"><Spinner size="sm" /></div>
              ) : deliverables.length === 0 ? (
                <p className="text-xs text-text-muted">No files attached</p>
              ) : (
                <div className="space-y-2">
                  {deliverables.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light border border-border-default">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">{d.original_filename}</p>
                        <p className="text-[10px] text-text-muted">
                          {formatFileSize(d.file_size)} · {relativeTime(d.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <button
                          onClick={() => handleDownload(d.id, d.original_filename)}
                          className="p-1.5 rounded hover:bg-white text-text-muted hover:text-blue-600 transition-colors"
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => deleteDeliverableMutation.mutate(d.id)}
                          className="p-1.5 rounded hover:bg-white text-text-muted hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border-default pt-5 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-text-secondary" />
                <h3 className="text-sm font-semibold text-text-primary">Comments</h3>
              </div>

              {comments.length === 0 ? (
                <p className="text-xs text-text-muted">No comments yet</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="p-3 rounded-lg bg-surface-light border border-border-default shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-text-secondary">
                          {comment.author_name || 'Unknown'}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {relativeTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-text-primary">{comment.content}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddComment} className="flex gap-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  rows={2}
                  className="flex-1 px-4 py-2.5 bg-white border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-colors resize-none text-sm"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!commentText.trim() || addCommentMutation.isPending}
                  className="self-end"
                >
                  {addCommentMutation.isPending ? <Spinner size="sm" /> : 'Send'}
                </Button>
              </form>
            </div>

            {activities.length > 0 && (
              <div className="border-t border-border-default pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-text-secondary" />
                  <h3 className="text-sm font-semibold text-text-primary">Activity</h3>
                </div>
                <div className="space-y-2">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <span className="text-text-secondary">{activity.actor_name || 'System'}</span>
                        {' '}
                        <span className="text-text-muted">
                          {activity.action.replace(/_/g, ' ')}
                        </span>
                        {activity.metadata && (activity.metadata as Record<string, string>).from && (
                          <span className="text-text-muted">
                            {' '}{(activity.metadata as Record<string, string>).from} → {(activity.metadata as Record<string, string>).to}
                          </span>
                        )}
                      </div>
                      <span className="text-text-muted shrink-0">{relativeTime(activity.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-text-muted">Task not found</div>
        )}
      </div>
    </div>
  );
}
