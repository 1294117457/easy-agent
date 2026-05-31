import { defineStore } from 'pinia';
import { ref } from 'vue';
import { workflowApi } from '@/api/workflow';

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
}

export interface McpTool {
  id: string;
  serverId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  enabled: boolean;
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
  // MCP Server 状态
  const mcpServers = ref<McpServer[]>([]);
  const connectedServers = ref<Set<string>>(new Set());
  const serverTools = ref<Map<string, McpTool[]>>(new Map());

  // Plugin 状态
  const plugins = ref<Plugin[]>([]);

  // WorkflowNode 状态
  const nodes = ref<WorkflowNode[]>([]);

  // Workflow 状态
  const workflows = ref<Workflow[]>([]);
  const currentWorkflow = ref<Workflow | null>(null);
  const currentWorkflowNodes = ref<WorkflowNode[]>([]);
  const currentWorkflowEdges = ref<WorkflowEdge[]>([]);

  // 加载状态
  const loading = ref(false);
  const executing = ref(false);

  // ========== MCP Server 操作 ==========

  async function loadMcpServers() {
    // 从配置或数据库加载已保存的 MCP Server
    // 暂时使用内存存储
    return mcpServers.value;
  }

  async function addMcpServer(server: Omit<McpServer, 'id'>) {
    const newServer: McpServer = {
      ...server,
      id: `mcp_${Date.now()}`,
    };
    mcpServers.value.push(newServer);
    return newServer;
  }

  async function removeMcpServer(id: string) {
    if (connectedServers.value.has(id)) {
      await disconnectMcpServer(id);
    }
    mcpServers.value = mcpServers.value.filter(s => s.id !== id);
    serverTools.value.delete(id);
  }

  async function connectMcpServer(server: McpServer) {
    try {
      const result = await workflowApi.mcpConnect(server);
      if (result.success) {
        connectedServers.value.add(server.id);
        // 获取工具列表
        const toolsResult = await workflowApi.mcpListTools(server.id);
        if (toolsResult.success) {
          serverTools.value.set(server.id, toolsResult.tools);
        }
        return { success: true };
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function disconnectMcpServer(serverId: string) {
    try {
      await workflowApi.mcpDisconnect(serverId);
      connectedServers.value.delete(serverId);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  function isServerConnected(serverId: string): boolean {
    return connectedServers.value.has(serverId);
  }

  function getServerTools(serverId: string): McpTool[] {
    return serverTools.value.get(serverId) || [];
  }

  async function refreshServerTools(serverId: string) {
    try {
      const toolsResult = await workflowApi.mcpListTools(serverId);
      if (toolsResult.success) {
        serverTools.value.set(serverId, toolsResult.tools);
      }
    } catch (error) {
      console.error('Failed to refresh tools:', error);
    }
  }

  // ========== 解析 MCP Config ==========

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
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ========== Plugin 操作 ==========

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

  // ========== WorkflowNode 操作 ==========

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

  // ========== Workflow 操作 ==========

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
    connectedServers,
    serverTools,
    plugins,
    nodes,
    workflows,
    currentWorkflow,
    currentWorkflowNodes,
    currentWorkflowEdges,
    loading,
    executing,

    // MCP Server 方法
    loadMcpServers,
    addMcpServer,
    removeMcpServer,
    connectMcpServer,
    disconnectMcpServer,
    isServerConnected,
    getServerTools,
    refreshServerTools,
    parseMcpConfig,
    connectWithConfig,

    // Plugin 方法
    createPlugin,
    loadPlugins,
    deletePlugin,

    // WorkflowNode 方法
    createNode,
    loadNodes,
    deleteNode,

    // Workflow 方法
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
