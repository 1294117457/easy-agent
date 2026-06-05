import type { IMcpPort } from '../../ports/mcp.port.js';
import type { WorkflowNode, CreateWorkflowNodeDTO } from '../entities/WorkflowNode.js';
import type { StandardSchema } from '../entities/Plugin.js';

export class WorkflowNodeService {
  private nodes: Map<string, WorkflowNode> = new Map();
  private nodeExecutors: Map<string, (input: unknown) => Promise<unknown>> = new Map();

  constructor(private mcpPort: IMcpPort) {}

  async createNode(data: CreateWorkflowNodeDTO): Promise<WorkflowNode> {
    const node: WorkflowNode = {
      ...data,
      id: `node:${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.nodes.set(node.id, node);

    this.nodeExecutors.set(node.id, async (input: unknown) => {
      return this.executeNode(node, input);
    });

    return node;
  }

  private async executeNode(node: WorkflowNode, input: unknown): Promise<unknown> {
    const rawInput = this.transformInput(node, input);
    const rawOutput = await this.mcpPort.callTool(node.pluginId, node.toolName, rawInput as Record<string, unknown>);
    const result = this.transformOutput(node, rawOutput);
    return result;
  }

  private transformInput(node: WorkflowNode, input: unknown): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const inputObj = input as Record<string, unknown>;

    for (const [nodeField, pluginField] of Object.entries(node.inputMapping)) {
      result[pluginField] = inputObj[nodeField];
    }

    return result;
  }

  private transformOutput(node: WorkflowNode, output: unknown): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const outputObj = (output as { content?: Array<{ text?: string }> }) || {};

    let pluginOutput: Record<string, unknown> = {};

    if (outputObj.content && Array.isArray(outputObj.content)) {
      for (const item of outputObj.content) {
        if (item.text) {
          try {
            pluginOutput = JSON.parse(item.text);
          } catch {
            pluginOutput = { raw: item.text };
          }
        }
      }
    } else {
      pluginOutput = outputObj as Record<string, unknown>;
    }

    for (const [pluginField, nodeField] of Object.entries(node.outputMapping)) {
      result[nodeField] = pluginOutput[pluginField];
    }

    if (Object.keys(result).length === 0 && Object.keys(pluginOutput).length > 0) {
      return pluginOutput;
    }

    return result;
  }

  async execute(nodeId: string, input: unknown): Promise<unknown> {
    const executor = this.nodeExecutors.get(nodeId);
    if (!executor) {
      throw new Error(`Node ${nodeId} not found`);
    }
    return await executor(input);
  }

  getNode(id: string): WorkflowNode | undefined {
    return this.nodes.get(id);
  }

  listNodes(): WorkflowNode[] {
    return Array.from(this.nodes.values());
  }

  listNodesByPlugin(pluginId: string): WorkflowNode[] {
    return Array.from(this.nodes.values()).filter(n => n.pluginId === pluginId);
  }

  updateNode(id: string, data: Partial<WorkflowNode>): WorkflowNode | null {
    const node = this.nodes.get(id);
    if (!node) return null;

    const updated: WorkflowNode = {
      ...node,
      ...data,
      id: node.id,
      updatedAt: new Date().toISOString(),
    };

    this.nodes.set(id, updated);
    return updated;
  }

  deleteNode(id: string): boolean {
    this.nodeExecutors.delete(id);
    return this.nodes.delete(id);
  }

  validateInput(nodeId: string, input: unknown): { valid: boolean; errors: string[] } {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return { valid: false, errors: [`Node ${nodeId} not found`] };
    }

    const errors: string[] = [];
    const inputObj = input as Record<string, unknown>;
    const requiredFields = node.inputSchema.required || [];

    for (const field of requiredFields) {
      if (!(field in inputObj) || inputObj[field] === undefined || inputObj[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  getInputSchema(nodeId: string): StandardSchema | null {
    const node = this.nodes.get(nodeId);
    return node?.inputSchema || null;
  }

  getOutputSchema(nodeId: string): StandardSchema | null {
    const node = this.nodes.get(nodeId);
    return node?.outputSchema || null;
  }
}
