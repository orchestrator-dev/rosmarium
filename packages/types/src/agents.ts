export type AgentTaskType =
  | 'localization'
  | 'compliance'
  | 'brand-voice'
  | 'seo-audit'
  | 'rot-cleanup'
  | 'custom';

export type AgentTaskStatus =
  | 'pending'
  | 'planning'
  | 'executing'
  | 'review'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface AgentStep {
  id: string;
  action: string;
  args: Record<string, unknown>;
  dependsOn?: string[];
  status: AgentStepStatus;
  result?: unknown;
  error?: string;
  startedAt?: string | Date;
  completedAt?: string | Date;
}

export interface AgentStepResult {
  stepId: string;
  action: string;
  success: boolean;
  output?: unknown;
  error?: string;
  executedAt: string | Date;
}

export interface AgentTask {
  id: string;
  type: AgentTaskType;
  status: AgentTaskStatus;
  goal: string;
  plan?: AgentStep[];
  results: AgentStepResult[];
  requiresHumanReview: boolean;
  createdBy: string;
  tenantId: string;
  startedAt?: string | Date;
  completedAt?: string | Date;
  error?: string;
}

export interface CreateAgentTaskInput {
  type: AgentTaskType;
  goal: string;
  requiresHumanReview?: boolean;
  tenantId?: string;
  createdBy?: string;
}
