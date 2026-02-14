export type TenantPlan = 'starter' | 'professional' | 'enterprise';
export type UserRole = 'owner' | 'admin' | 'operator' | 'viewer';
export type AgentLevel = 'intern' | 'specialist' | 'lead';
export type AgentStatus = 'active' | 'idle' | 'error' | 'disabled';
export type TaskStatus = 'inbox' | 'assigned' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Tenant {
  id: string;
  name: string;
  plan: TenantPlan;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Agent {
  id: string;
  tenant_id: string;
  name: string;
  role: string;
  soul_md: string;
  agents_md: string;
  tools_md: string;
  heartbeat_md: string;
  model_config: Record<string, unknown>;
  level: AgentLevel;
  status: AgentStatus;
  is_default: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  is_blocked: boolean;
  blocker_reason: string | null;
  blocked_by: string | null;
  blocked_at: string | null;
  blocked_until: string | null;
  unblock_owner: string | null;
  priority: TaskPriority;
  assignees: string[];
  created_by: string;
  parent_task: string | null;
  tags: string[];
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  tenant_id: string;
  task_id: string;
  author_id: string;
  content: string;
  mentions: string[];
  parent_comment_id: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  tenant_id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Session {
  id: string;
  tenant_id: string;
  agent_id: string;
  session_key: string;
  conversation_buffer: string;
  compaction_summary: string | null;
  token_count: number;
  model_config: Record<string, unknown>;
  status: 'active' | 'idle' | 'archived';
  last_active_at: string;
  created_at: string;
}

export interface MemoryEntry {
  id: string;
  tenant_id: string;
  agent_id: string;
  memory_type: 'long_term' | 'working' | 'daily_note';
  content: string;
  date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deliverable {
  id: string;
  tenant_id: string;
  task_id: string;
  agent_id: string;
  file_name: string;
  file_ref: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface CronJob {
  id: string;
  tenant_id: string;
  agent_id: string;
  name: string;
  schedule: string;
  schedule_type: 'cron' | 'at' | 'interval';
  execution_mode: 'main_session' | 'isolated';
  command: string;
  model_override: string | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string;
  retry_count: number;
  created_at: string;
}

export interface UsageRecord {
  id: string;
  tenant_id: string;
  agent_id: string;
  date: string;
  tokens_in: number;
  tokens_out: number;
  api_calls: number;
  estimated_cost: number;
}

export interface Notification {
  id: string;
  tenant_id: string;
  recipient_id: string;
  recipient_type: 'agent' | 'user';
  type: 'mention' | 'assignment' | 'review_request' | 'status_change' | 'standup';
  source_task_id: string | null;
  source_comment_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface Standup {
  id: string;
  tenant_id: string;
  date: string;
  summary: string;
  per_agent_summaries: Record<string, unknown>[];
  delivered_to: string[];
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  isSaasAdmin?: boolean;
}
