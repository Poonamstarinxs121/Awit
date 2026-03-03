import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { Plus, Columns3, Pencil, Trash2, Layers } from 'lucide-react';

interface BoardGroup {
  id: string;
  name: string;
  description: string | null;
  color: string;
  task_count: number;
  created_at: string;
}

const PRESET_COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2'];

function ColorChip({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-7 h-7 rounded-full border-2 transition-transform ${selected ? 'border-text-primary scale-110' : 'border-transparent'}`}
      style={{ background: color }}
      title={color}
    />
  );
}

function BoardGroupForm({
  initial,
  onSubmit,
  loading,
}: {
  initial?: { name: string; description: string; color: string };
  onSubmit: (data: { name: string; description: string; color: string }) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState(initial?.color ?? '#2563eb');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, description, color });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Board Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Engineering"
        required
      />
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-text-primary">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
          className="w-full px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-none"
        />
      </div>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-text-primary">Color</label>
        <div className="flex gap-2">
          {PRESET_COLORS.map((c) => (
            <ColorChip key={c} color={c} selected={color === c} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? <Spinner size="sm" className="mr-2" /> : null}
          {initial ? 'Save Changes' : 'Create Board'}
        </Button>
      </div>
    </form>
  );
}

export function BoardGroups() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<BoardGroup | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['board-groups'],
    queryFn: () => apiGet<{ board_groups: BoardGroup[] }>('/v1/board-groups'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description: string; color: string }) =>
      apiPost('/v1/board-groups', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-groups'] });
      setCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name: string; description: string; color: string }) =>
      apiPatch(`/v1/board-groups/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-groups'] });
      setEditGroup(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/v1/board-groups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board-groups'] }),
  });

  const groups = data?.board_groups ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-accent/10 flex items-center justify-center">
            <Layers size={20} className="text-brand-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary font-heading">Boards</h1>
            <p className="text-sm text-text-secondary">Organise your work into board groups</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} className="mr-1.5" />
          New Board
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/kanban')}
          className="group text-left bg-[var(--card)] border-2 border-dashed border-[var(--border)] rounded-xl p-5 hover:border-brand-accent hover:bg-blue-50/30 transition-colors"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--surface-elevated)]">
              <Columns3 size={20} className="text-text-secondary" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary group-hover:text-brand-accent transition-colors font-heading">
                General
              </h3>
              <p className="text-xs text-text-muted">All ungrouped tasks</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">Click to open board →</p>
        </button>

        {groups.map((group) => (
          <div
            key={group.id}
            className="relative group bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/kanban?boardGroupId=${group.id}`)}
          >
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); setEditGroup(group); }}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-[var(--surface-elevated)] transition-colors"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${group.name}"? Tasks will become ungrouped.`)) {
                    deleteMutation.mutate(group.id);
                  }
                }}
                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-[rgba(255,59,48,0.1)] transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: group.color + '22', border: `1.5px solid ${group.color}44` }}
              >
                <Columns3 size={18} style={{ color: group.color }} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-text-primary font-heading truncate pr-10">{group.name}</h3>
                {group.description && (
                  <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">{group.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: group.color + '18', color: group.color }}
              >
                {group.task_count} {group.task_count === 1 ? 'task' : 'tasks'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Board Group">
        <BoardGroupForm
          onSubmit={(data) => createMutation.mutate(data)}
          loading={createMutation.isPending}
        />
      </Modal>

      <Modal
        open={!!editGroup}
        onClose={() => setEditGroup(null)}
        title="Edit Board Group"
      >
        {editGroup && (
          <BoardGroupForm
            initial={{ name: editGroup.name, description: editGroup.description ?? '', color: editGroup.color }}
            onSubmit={(data) => updateMutation.mutate({ id: editGroup.id, ...data })}
            loading={updateMutation.isPending}
          />
        )}
      </Modal>
    </div>
  );
}
