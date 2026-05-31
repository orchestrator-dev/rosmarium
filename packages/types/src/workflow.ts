export interface WorkflowDefinition {
  id: string;
  name: string;
  contentTypes: string[];       // Which content types use this workflow
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  initialState: string;
  publishedState: string;       // Which state = "published"
}

export interface WorkflowState {
  key: string;                   // e.g., "draft", "review", "approved"
  label: string;
  color: string;                 // UI badge color
  permissions: {
    edit: string[];              // Roles that can edit in this state
    view: string[];              // Roles that can view in this state
  };
}

export interface TransitionCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "contains" | "not_contains" | "empty" | "not_empty";
  value?: unknown;
}

export interface WorkflowTransition {
  from: string;                  // State key
  to: string;                    // State key
  label: string;                 // e.g., "Submit for Review"
  requiredRole: string;          // Minimum role to trigger
  requireComment: boolean;       // Force reviewer to leave a note
  autoAssign?: string;           // Auto-assign to role/user
  webhookEvent?: string;         // Custom webhook event name
  conditions?: TransitionCondition[];
}
