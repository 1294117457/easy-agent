export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  sourceField: string;
  targetNodeId: string;
  targetField: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodeIds: string[];
  edges: WorkflowEdge[];
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type CreateWorkflowDTO = Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>;

export interface WorkflowResult {
  success: boolean;
  output?: unknown;
  nodeResults?: Record<string, unknown>;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
