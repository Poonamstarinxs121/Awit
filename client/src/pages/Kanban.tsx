import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { Plus, Calendar, X, MessageSquare, Clock, Paperclip, Download, Trash2, Upload } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, Agent, Comment, Activity } from '../types';

interface TaskWithAgents extends Task {
  assignee_agents: { id: string; name: string }[] | null;
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
  { status: 'review', label: 'Review', color: '#8B5CF6' },
  { status: 'done', label: 'Done', color: '#14B8A6' },
];

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; dot: string }> = {
  critical: { color: 'text-red-400', dot: 'bg-red-500' },
  high: { color: 'text-orange-400', dot: 'bg-orange-500' },
  medium: { color: 'text-blue-400', dot: 'bg-blue-500' },
  low: { color: 'text-gray-400', dot: 'bg-gray-500' },
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

export function Kanban() {
  const queryClient = useQueryClient();
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<TaskStatus>('inbox');
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => apiGet<{ tasks: TaskWithAgents[] }>('/v1/tasks'),
  });

  const { data: statsData } = useQuery({
    queryKey: ['taskStats'],
    queryFn: () => apiGet<{ stats: { status: TaskStatus; count: number }[] }>('/v1/tasks/stats'),
  });

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiGet<{ agents: Agent[] }>('/v1/agents'),
  });

  const tasks = tasksData?.tasks ?? [];
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
        <h1 className="text-2xl font-bold text-white">Mission Queue</h1>
        <Button onClick={() => openCreateModal('inbox')} size="sm">
          <Plus size={16} className="mr-1" /> New Task
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
        {COLUMNS.map((col) => (
          <div
            key={col.status}
            className={`flex flex-col min-w-[280px] w-[280px] shrink-0 rounded-xl border transition-colors ${
              dragOverColumn === col.status
                ? 'border-blue-500/50 bg-blue-500/5'
                : 'border-[#1E293B] bg-[#111827]/50'
            }`}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.status)}
          >
            <div
              className="px-4 py-3 border-b border-[#1E293B] rounded-t-xl"
              style={{ borderTopWidth: 3, borderTopColor: col.color, borderTopStyle: 'solid' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{col.label}</span>
                  <span className="text-xs text-gray-500 bg-[#1E293B] px-2 py-0.5 rounded-full">
                    {statsCounts[col.status] ?? tasksByStatus[col.status].length}
                  </span>
                </div>
                <button
                  onClick={() => openCreateModal(col.status)}
                  className="text-gray-500 hover:text-white transition-colors p-0.5 rounded hover:bg-[#1E293B]"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {tasksByStatus[col.status].length === 0 ? (
                <div className="text-center py-8 text-gray-600 text-xs">No tasks</div>
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
          onClose={() => setCreateModalOpen(false)}
        />
      )}

      {detailTaskId && (
        <TaskDetailModal
          taskId={detailTaskId}
          agents={agents}
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
  const assigneeNames = task.assignee_agents?.map((a) => a.name) ?? [];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={onClick}
      className={`p-3 rounded-lg border border-[#1E293B] bg-[#111827] hover:border-gray-600 cursor-pointer transition-all ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold text-white truncate">{task.title}</p>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${priority.dot}`} />
            <span className={`text-xs ${priority.color}`}>{task.priority}</span>
          </div>
          {task.is_blocked && (
            <Badge variant="error" className="text-[10px] px-1.5 py-0">BLOCKED</Badge>
          )}
        </div>

        <div className="text-xs text-gray-500">
          {assigneeNames.length > 0 ? (
            <span className="text-gray-300">{assigneeNames.join(', ')}</span>
          ) : (
            <span>Unassigned</span>
          )}
        </div>

        {(task.due_date || (task.tags && task.tags.length > 0)) && (
          <div className="flex items-center gap-2 flex-wrap">
            {task.due_date && (
              <div className={`flex items-center gap-1 text-xs ${isOverdue(task.due_date) && task.status !== 'done' ? 'text-red-400' : 'text-gray-500'}`}>
                <Calendar size={12} />
                {formatDate(task.due_date)}
              </div>
            )}
            {task.tags?.map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E293B] text-gray-400">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateTaskModal({
  defaultStatus,
  agents,
  onClose,
}: {
  defaultStatus: TaskStatus;
  agents: Agent[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState('');
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
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    createMutation.mutate({
      title: title.trim(),
      description,
      priority,
      status,
      assignees: selectedAssignees,
      tags,
      due_date: dueDate || null,
    });
  };

  const toggleAssignee = (id: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#111827] border border-gray-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Create Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-400">{error}</p>}

          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            required
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description..."
              rows={3}
              className="w-full px-4 py-2.5 bg-surface-light border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-4 py-2.5 bg-surface-light border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-4 py-2.5 bg-surface-light border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
              >
                {COLUMNS.map((c) => (
                  <option key={c.status} value={c.status}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {agents.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">Assignees</label>
              <div className="flex flex-wrap gap-2">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleAssignee(agent.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      selectedAssignees.includes(agent.id)
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                        : 'bg-surface-light border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {agent.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input
            label="Tags (comma-separated)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. frontend, bug, urgent"
          />

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
  onClose,
}: {
  taskId: string;
  agents: Agent[];
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
  const [editDueDate, setEditDueDate] = useState('');
  const [editTags, setEditTags] = useState('');
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
    setEditDueDate(task.due_date ? task.due_date.split('T')[0] : '');
    setEditTags((task.tags || []).join(', '));
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
    const tags = editTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    updateMutation.mutate({
      title: editTitle,
      description: editDescription,
      status: editStatus,
      priority: editPriority,
      assignees: editAssignees,
      due_date: editDueDate || null,
      tags,
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
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#111827] border border-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Task Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
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
                <label className="block text-sm font-medium text-gray-300">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                  className="w-full px-4 py-2.5 bg-surface-light border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                >
                  {COLUMNS.map((c) => (
                    <option key={c.status} value={c.status}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-300">Priority</label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                  className="w-full px-4 py-2.5 bg-surface-light border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 bg-surface-light border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-colors resize-none"
              />
            </div>

            {agents.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-300">Assignees</label>
                <div className="flex flex-wrap gap-2">
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggleAssignee(agent.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        editAssignees.includes(agent.id)
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                          : 'bg-surface-light border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {agent.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Due Date"
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
              <Input
                label="Tags (comma-separated)"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editBlocked}
                  onChange={(e) => setEditBlocked(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-surface-light text-red-500 focus:ring-red-500"
                />
                <span className="text-sm font-medium text-red-400">Blocked</span>
              </label>
              {editBlocked && (
                <textarea
                  value={editBlockerReason}
                  onChange={(e) => setEditBlockerReason(e.target.value)}
                  placeholder="Reason for blocking..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-surface-light border border-red-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors resize-none"
                />
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Spinner size="sm" className="mr-2" /> : null}
                Save Changes
              </Button>
            </div>

            <div className="border-t border-gray-800 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Paperclip size={16} className="text-gray-400" />
                  <h3 className="text-sm font-semibold text-white">Deliverables</h3>
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
                <p className="text-xs text-gray-500">No files attached</p>
              ) : (
                <div className="space-y-2">
                  {deliverables.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0A1628] border border-[#1E293B]">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate">{d.original_filename}</p>
                        <p className="text-[10px] text-gray-500">
                          {formatFileSize(d.file_size)} · {relativeTime(d.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <button
                          onClick={() => handleDownload(d.id, d.original_filename)}
                          className="p-1.5 rounded hover:bg-[#1E293B] text-gray-400 hover:text-blue-400 transition-colors"
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => deleteDeliverableMutation.mutate(d.id)}
                          className="p-1.5 rounded hover:bg-[#1E293B] text-gray-400 hover:text-red-400 transition-colors"
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

            <div className="border-t border-gray-800 pt-5 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-gray-400" />
                <h3 className="text-sm font-semibold text-white">Comments</h3>
              </div>

              {comments.length === 0 ? (
                <p className="text-xs text-gray-500">No comments yet</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="p-3 rounded-lg bg-[#0A1628] border border-[#1E293B]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-300">
                          {comment.author_name || 'Unknown'}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {relativeTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">{comment.content}</p>
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
                  className="flex-1 px-4 py-2.5 bg-surface-light border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-colors resize-none text-sm"
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
              <div className="border-t border-gray-800 pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-gray-400" />
                  <h3 className="text-sm font-semibold text-white">Activity</h3>
                </div>
                <div className="space-y-2">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-600 mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <span className="text-gray-300">{activity.actor_name || 'System'}</span>
                        {' '}
                        <span className="text-gray-500">
                          {activity.action.replace(/_/g, ' ')}
                        </span>
                        {activity.metadata && (activity.metadata as Record<string, string>).from && (
                          <span className="text-gray-500">
                            {' '}{(activity.metadata as Record<string, string>).from} → {(activity.metadata as Record<string, string>).to}
                          </span>
                        )}
                      </div>
                      <span className="text-gray-600 shrink-0">{relativeTime(activity.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">Task not found</div>
        )}
      </div>
    </div>
  );
}
