import { v4 as uuidv4 } from 'uuid';
import type { Workflow, WorkflowEdge, CreateWorkflowDTO, WorkflowResult, ValidationResult } from '../entities/Workflow.js';
import type { WorkflowNode } from '../entities/WorkflowNode.js';
import { WorkflowNodeService } from './WorkflowNodeService.js';

export class WorkflowService {
  private workflows: Map<string, Workflow> = new Map();
  private workflowNodes: Map<string, WorkflowNode[]> = new Map();

  constructor(private nodeService: WorkflowNodeService) {}

  async createWorkflow(data: CreateWorkflowDTO): Promise<Workflow> {
    const workflow: Workflow = {
      ...data,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.workflows.set(workflow.id, workflow);
    this.workflowNodes.set(workflow.id, []);

    return workflow;
  }

  addNode(workflowId: string, node: WorkflowNode): void {
    const nodes = this.workflowNodes.get(workflowId);
    if (!nodes) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (!nodes.find(n => n.id === node.id)) {
      nodes.push(node);
    }
  }

  removeNode(workflowId: string, nodeId: string): void {
    const nodes = this.workflowNodes.get(workflowId);
    if (!nodes) return;

    const index = nodes.findIndex(n => n.id === nodeId);
    if (index !== -1) {
      nodes.splice(index, 1);
    }

    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      workflow.edges = workflow.edges.filter(
        e => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
      );
    }
  }

  connect(
    workflowId: string,
    sourceNodeId: string,
    sourceField: string,
    targetNodeId: string,
    targetField: string
  ): WorkflowEdge | null {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;

    const edge: WorkflowEdge = {
      id: uuidv4(),
      sourceNodeId,
      sourceField,
      targetNodeId,
      targetField,
    };

    workflow.edges.push(edge);
    workflow.updatedAt = new Date().toISOString();

    return edge;
  }

  disconnect(workflowId: string, edgeId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    const index = workflow.edges.findIndex(e => e.id === edgeId);
    if (index === -1) return false;

    workflow.edges.splice(index, 1);
    workflow.updatedAt = new Date().toISOString();

    return true;
  }

  validate(workflowId: string): ValidationResult {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return { valid: false, errors: [`Workflow ${workflowId} not found`] };
    }

    const errors: string[] = [];
    const nodes = this.workflowNodes.get(workflowId) || [];

    if (nodes.length === 0) {
      errors.push('Workflow has no nodes');
    }

    for (const edge of workflow.edges) {
      const sourceExists = nodes.find(n => n.id === edge.sourceNodeId);
      const targetExists = nodes.find(n => n.id === edge.targetNodeId);

      if (!sourceExists) {
        errors.push(`Source node ${edge.sourceNodeId} not found`);
      }
      if (!targetExists) {
        errors.push(`Target node ${edge.targetNodeId} not found`);
      }
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    for (const edge of workflow.edges) {
      if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
        continue;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(workflowId: string, input: unknown): Promise<WorkflowResult> {
    const validation = this.validate(workflowId);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    const workflow = this.workflows.get(workflowId)!;
    const nodes = this.workflowNodes.get(workflowId) || [];

    const executionOrder = this.topologicalSort(nodes, workflow.edges);
    const context: Record<string, unknown> = {};
    context['__input__'] = input;

    try {
      for (const node of executionOrder) {
        const nodeInput = this.getNodeInput(node.id, workflow.edges, context);
        const nodeOutput = await this.nodeService.execute(node.id, nodeInput);
        context[node.id] = nodeOutput;
      }

      const lastNode = executionOrder[executionOrder.length - 1];
      return {
        success: true,
        output: context[lastNode.id],
        nodeResults: context,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    for (const edge of edges) {
      adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
      inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId);
    }

    const result: WorkflowNode[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = nodes.find(n => n.id === nodeId);
      if (node) result.push(node);

      for (const neighbor of adjacency.get(nodeId) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  private getNodeInput(
    nodeId: string,
    edges: WorkflowEdge[],
    context: Record<string, unknown>
  ): unknown {
    const inputEdges = edges.filter(e => e.targetNodeId === nodeId);

    if (inputEdges.length === 0) {
      return context['__input__'];
    }

    const input: Record<string, unknown> = {};
    for (const edge of inputEdges) {
      const sourceOutput = context[edge.sourceNodeId] as Record<string, unknown>;
      input[edge.targetField] = sourceOutput?.[edge.sourceField];
    }

    return input;
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  listWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  getNodes(workflowId: string): WorkflowNode[] {
    return this.workflowNodes.get(workflowId) || [];
  }

  updateWorkflow(id: string, data: Partial<Workflow>): Workflow | null {
    const workflow = this.workflows.get(id);
    if (!workflow) return null;

    const updated: Workflow = {
      ...workflow,
      ...data,
      id: workflow.id,
      updatedAt: new Date().toISOString(),
    };

    this.workflows.set(id, updated);
    return updated;
  }

  deleteWorkflow(id: string): boolean {
    this.workflowNodes.delete(id);
    return this.workflows.delete(id);
  }

  updateWorkflowStatus(id: string, status: Workflow['status']): Workflow | null {
    return this.updateWorkflow(id, { status });
  }
}
