import type { StandardSchema } from './Plugin.js';

export interface WorkflowNode {
  id: string;
  name: string;
  description?: string;
  pluginId: string;
  toolName: string;
  inputSchema: StandardSchema;
  outputSchema: StandardSchema;
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  position?: { x: number; y: number };
  createdAt: string;
  updatedAt: string;
}

export type CreateWorkflowNodeDTO = Omit<WorkflowNode, 'id' | 'createdAt' | 'updatedAt'>;
