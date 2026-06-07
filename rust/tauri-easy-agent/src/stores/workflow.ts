import { defineStore } from 'pinia';
import { ref } from 'vue';
import { workflowApi, type McpServerInput } from '@/api/workflow';
import type {
  McpServerRecord,
  PluginRecord,
  WorkflowNodeRecord,
  WorkflowRecord,
  WorkflowEdgeRecord,
} from '@/types/electron.d.ts';

// ============ 内部记录类型（Store 使用的本地类型）============

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

// ============ MCP Config 类型 ============
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

// ============ 工具函数 ============

/** 将 McpServerRecord 转换为本地 McpServer 类型 */
function toMcpServer(record: McpServerRecord): McpServer {
  return {
    ...record,
    isConnected: record.status === 'connected',
    isConnecting: record.status === 'connecting',
    hasError: record.status === 'error',
    toolCount: 0,
    tools: [],
  };
}

/** 将 record 列表转换为本地类型 */
function toMcpServers(records: McpServerRecord[]): McpServer[] {
  return records.map(toMcpServer);
}

// ============ Store ============
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
      if (result.success && result.servers) {
        mcpServers.value = toMcpServers(result.servers);
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
      return result;
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
      if (result.success && result.data) {
        plugins.value.push(result.data as Plugin);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function loadPlugins() {
    try {
      const result = await workflowApi.pluginList();
      if (result.success && result.data) {
        plugins.value = result.data as PluginRecord[];
      }
    } catch (error) {
      console.error('Failed to load plugins:', error);
    }
  }

  async function deletePlugin(id: string) {
    try {
      const result = await workflowApi.pluginDelete(id);
      if (result.success) {
        plugins.value = plugins.value.filter(p => p.id !== id);
      }
      return result;
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
      if (result.success && result.data) {
        nodes.value.push(result.data as WorkflowNodeRecord);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function loadNodes() {
    try {
      const result = await workflowApi.nodeList();
      if (result.success && result.data) {
        nodes.value = result.data as WorkflowNodeRecord[];
      }
    } catch (error) {
      console.error('Failed to load nodes:', error);
    }
  }

  async function deleteNode(id: string) {
    try {
      const result = await workflowApi.nodeDelete(id);
      if (result.success) {
        nodes.value = nodes.value.filter(n => n.id !== id);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============ Workflow ============

  async function loadWorkflows() {
    try {
      const result = await workflowApi.workflowList();
      if (result.success && result.data) {
        workflows.value = result.data as WorkflowRecord[];
      }
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  }

  async function createWorkflow(name: string, description?: string) {
    try {
      const result = await workflowApi.workflowCreate({ name, description });
      if (result.success && result.data) {
        workflows.value.push(result.data as WorkflowRecord);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function selectWorkflow(id: string) {
    try {
      const result = await workflowApi.workflowGet(id);
      if (result.success && result.data) {
        currentWorkflow.value = result.data as WorkflowRecord;
        const nodesResult = await workflowApi.workflowGetNodes(id);
        if (nodesResult.success && nodesResult.data) {
          currentWorkflowNodes.value = nodesResult.data as WorkflowNodeRecord[];
        }
      }
      return result;
    } catch (error) {
      console.error('Failed to select workflow:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function addNodeToWorkflow(workflowId: string, nodeId: string) {
    try {
      const result = await workflowApi.workflowAddNode(workflowId, nodeId);
      if (result.success) {
        await selectWorkflow(workflowId);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function removeNodeFromWorkflow(workflowId: string, nodeId: string) {
    try {
      const result = await workflowApi.workflowRemoveNode(workflowId, nodeId);
      if (result.success) {
        await selectWorkflow(workflowId);
      }
      return result;
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
      if (result.success && result.data) {
        currentWorkflowEdges.value.push(result.data as WorkflowEdgeRecord);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function disconnectNodes(workflowId: string, edgeId: string) {
    try {
      const result = await workflowApi.workflowDisconnect(workflowId, edgeId);
      if (result.success) {
        currentWorkflowEdges.value = currentWorkflowEdges.value.filter(e => e.id !== edgeId);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function validateWorkflow(workflowId: string) {
    try {
      return await workflowApi.workflowValidate(workflowId);
    } catch (error) {
      return { success: false, error: (error as Error).message };
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
      const result = await workflowApi.workflowDelete(id);
      if (result.success) {
        workflows.value = workflows.value.filter(w => w.id !== id);
        if (currentWorkflow.value?.id === id) {
          currentWorkflow.value = null;
          currentWorkflowNodes.value = [];
          currentWorkflowEdges.value = [];
        }
      }
      return result;
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
