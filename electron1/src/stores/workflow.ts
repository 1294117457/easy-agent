import { defineStore } from 'pinia';
import { ref } from 'vue';
import { workflowApi, type McpServerInput } from '@/api/workflow';

export interface McpTool {
  id: string;
  serverId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  enabled: boolean;
}

export interface McpServer {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  enabled: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  isConnected: boolean;
  isConnecting: boolean;
  hasError: boolean;
  lastError?: string;
  connectedAt?: string;
  toolCount: number;
  tools: McpTool[];
  createdAt: string;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  serverId: string;
  toolNames: string[];
}

export interface StandardSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    required?: boolean;
    default?: unknown;
  }>;
  required?: string[];
}

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
}

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
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

// MCP Config 类型
export interface McpConfigInput {
  type: 'promptString';
  id: string;
  description: string;
  password?: boolean;
}

export interface McpConfig {
  servers: Record<string, {
    type?: 'stdio' | 'http';
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    headers?: Record<string, string>;
  }>;
  inputs?: McpConfigInput[];
}

export const useWorkflowStore = defineStore('workflow', () => {
  // ============ MCP Server 状态 ============
  const mcpServers = ref<McpServer[]>([]);
  const mcpLoading = ref(false);

  // ============ Plugin 状态 ============
  const plugins = ref<Plugin[]>([]);

  // ============ WorkflowNode 状态 ============
  const nodes = ref<WorkflowNode[]>([]);

  // ============ Workflow 状态 ============
  const workflows = ref<Workflow[]>([]);
  const currentWorkflow = ref<Workflow | null>(null);
  const currentWorkflowNodes = ref<WorkflowNode[]>([]);
  const currentWorkflowEdges = ref<WorkflowEdge[]>([]);

  // ============ 加载状态 ============
  const loading = ref(false);
  const executing = ref(false);

  // ============ MCP Server CRUD ============

  async function loadMcpServers() {
    mcpLoading.value = true;
    try {
      const result = await workflowApi.mcpList();
      if (result.success) {
        mcpServers.value = result.servers;
      }
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    } finally {
      mcpLoading.value = false;
    }
  }

  async function addMcpServer(data: McpServerInput) {
    try {
      const result = await workflowApi.mcpSave(data);
      if (result.success) {
        await loadMcpServers();
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function updateMcpServer(id: string, updates: Partial<McpServerInput>) {
    try {
      const result = await workflowApi.mcpUpdate(id, updates);
      if (result.success) {
        await loadMcpServers();
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function removeMcpServer(id: string) {
    try {
      const result = await workflowApi.mcpDelete(id);
      if (result.success) {
        mcpServers.value = mcpServers.value.filter(s => s.id !== id);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============ MCP Server 连接 ============

  async function connectMcpServer(id: string) {
    try {
      const result = await workflowApi.mcpConnect(id);
      if (result.success) {
        await loadMcpServers();
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function disconnectMcpServer(id: string) {
    try {
      const result = await workflowApi.mcpDisconnect(id);
      if (result.success) {
        await loadMcpServers();
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function reconnectMcpServer(id: string) {
    try {
      const result = await workflowApi.mcpReconnect(id);
      if (result.success) {
        await loadMcpServers();
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  function isServerConnected(id: string): boolean {
    const server = mcpServers.value.find(s => s.id === id);
    return server?.isConnected ?? false;
  }

  function getServerTools(id: string): McpTool[] {
    const server = mcpServers.value.find(s => s.id === id);
    return server?.tools || [];
  }

  // ============ MCP Config ============

  async function parseMcpConfig(configText: string) {
    try {
      const result = await workflowApi.mcpParseConfig(configText);
      if (result.success) {
        return result;
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function connectWithConfig(configText: string, inputValues: Record<string, string>) {
    try {
      const result = await workflowApi.mcpConnectWithConfig(configText, inputValues);
      if (result.success) {
        await loadMcpServers();
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============ Plugin ============

  async function createPlugin(data: {
    name: string;
    description: string;
    serverId: string;
    toolNames: string[];
  }) {
    try {
      const result = await workflowApi.pluginCreate(data);
      if (result.success) {
        plugins.value.push(result.plugin);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function loadPlugins() {
    try {
      const list = await workflowApi.pluginList();
      plugins.value = list;
    } catch (error) {
      console.error('Failed to load plugins:', error);
    }
  }

  async function deletePlugin(id: string) {
    try {
      await workflowApi.pluginDelete(id);
      plugins.value = plugins.value.filter(p => p.id !== id);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============ WorkflowNode ============

  async function createNode(data: {
    name: string;
    description?: string;
    pluginId: string;
    toolName: string;
    inputSchema: StandardSchema;
    outputSchema: StandardSchema;
    inputMapping: Record<string, string>;
    outputMapping: Record<string, string>;
  }) {
    try {
      const result = await workflowApi.nodeCreate(data);
      if (result.success) {
        nodes.value.push(result.node);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function loadNodes() {
    try {
      const list = await workflowApi.nodeList();
      nodes.value = list;
    } catch (error) {
      console.error('Failed to load nodes:', error);
    }
  }

  async function deleteNode(id: string) {
    try {
      await workflowApi.nodeDelete(id);
      nodes.value = nodes.value.filter(n => n.id !== id);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============ Workflow ============

  async function loadWorkflows() {
    try {
      const list = await workflowApi.workflowList();
      workflows.value = list;
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  }

  async function createWorkflow(name: string, description?: string) {
    try {
      const result = await workflowApi.workflowCreate({ name, description });
      if (result.success) {
        workflows.value.push(result.workflow);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function selectWorkflow(id: string) {
    try {
      const workflow = await workflowApi.workflowGet(id);
      if (workflow) {
        currentWorkflow.value = workflow;
        const nodesResult = await workflowApi.workflowGetNodes(id);
        currentWorkflowNodes.value = nodesResult;
      }
      return workflow;
    } catch (error) {
      console.error('Failed to select workflow:', error);
      return null;
    }
  }

  async function addNodeToWorkflow(workflowId: string, nodeId: string) {
    try {
      await workflowApi.workflowAddNode(workflowId, nodeId);
      await selectWorkflow(workflowId);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function removeNodeFromWorkflow(workflowId: string, nodeId: string) {
    try {
      await workflowApi.workflowRemoveNode(workflowId, nodeId);
      await selectWorkflow(workflowId);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function connectNodes(
    workflowId: string,
    sourceNodeId: string,
    sourceField: string,
    targetNodeId: string,
    targetField: string
  ) {
    try {
      const result = await workflowApi.workflowConnect(
        workflowId, sourceNodeId, sourceField, targetNodeId, targetField
      );
      if (result.success) {
        currentWorkflowEdges.value.push(result.edge);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function disconnectNodes(workflowId: string, edgeId: string) {
    try {
      await workflowApi.workflowDisconnect(workflowId, edgeId);
      currentWorkflowEdges.value = currentWorkflowEdges.value.filter(e => e.id !== edgeId);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function validateWorkflow(workflowId: string) {
    try {
      return await workflowApi.workflowValidate(workflowId);
    } catch (error) {
      return { valid: false, errors: [(error as Error).message] };
    }
  }

  async function executeWorkflow(workflowId: string, input: unknown) {
    executing.value = true;
    try {
      const result = await workflowApi.workflowExecute(workflowId, input);
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    } finally {
      executing.value = false;
    }
  }

  async function deleteWorkflow(id: string) {
    try {
      await workflowApi.workflowDelete(id);
      workflows.value = workflows.value.filter(w => w.id !== id);
      if (currentWorkflow.value?.id === id) {
        currentWorkflow.value = null;
        currentWorkflowNodes.value = [];
        currentWorkflowEdges.value = [];
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  return {
    // 状态
    mcpServers,
    mcpLoading,
    plugins,
    nodes,
    workflows,
    currentWorkflow,
    currentWorkflowNodes,
    currentWorkflowEdges,
    loading,
    executing,

    // MCP Server CRUD
    loadMcpServers,
    addMcpServer,
    updateMcpServer,
    removeMcpServer,

    // MCP Server 连接
    connectMcpServer,
    disconnectMcpServer,
    reconnectMcpServer,
    isServerConnected,
    getServerTools,
    parseMcpConfig,
    connectWithConfig,

    // Plugin
    createPlugin,
    loadPlugins,
    deletePlugin,

    // WorkflowNode
    createNode,
    loadNodes,
    deleteNode,

    // Workflow
    loadWorkflows,
    createWorkflow,
    selectWorkflow,
    addNodeToWorkflow,
    removeNodeFromWorkflow,
    connectNodes,
    disconnectNodes,
    validateWorkflow,
    executeWorkflow,
    deleteWorkflow,
  };
});
