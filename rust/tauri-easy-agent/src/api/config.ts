// ============ Tauri Config API ============
// 迁移自 Electron IPC API，使用 @tauri-apps/api/core 的 invoke

import { invoke } from '@tauri-apps/api/core';
import type {
  ApiKeyRecord,
  PromptRecord,
  LLMConfigRecord,
  LLMProviderRecord,
  TestConnectionResult,
  ApiResult,
  McpServerRecord,
  McpToolRecord,
  PluginRecord,
  StandardSchema,
  WorkflowNodeRecord,
  WorkflowRecord,
  WorkflowEdgeRecord,
} from '@/types/electron.d.ts';

export const configApi = {
  // ============ 基础配置 ============

  /**
   * 获取所有配置（API Keys、Prompts、LLM Config）
   */
  getConfig: (): Promise<{
    apiKeys: ApiKeyRecord[];
    prompts: PromptRecord[];
    llmConfig: LLMConfigRecord | null;
  }> => invoke('get_config'),

  // ============ API Key CRUD ============

  /**
   * 创建新的 API Key
   */
  createApiKey: (data: {
    provider: string;
    key: string;
    model: string;
    baseURL?: string;
  }): Promise<ApiKeyRecord> => invoke('create_api_key', data),

  /**
   * 删除 API Key
   */
  deleteApiKey: (id: string): Promise<boolean> =>
    invoke('delete_api_key', { id }),

  // ============ Prompt CRUD ============

  /**
   * 创建新的 Prompt
   */
  createPrompt: (data: {
    name: string;
    description?: string;
    systemPrompt: string;
  }): Promise<PromptRecord> => invoke('create_prompt', data),

  /**
   * 删除 Prompt
   */
  deletePrompt: (id: string): Promise<boolean> =>
    invoke('delete_prompt', { id }),

  /**
   * 设置激活的 Prompt
   */
  setActivePrompt: (id: string): Promise<boolean> =>
    invoke('set_active_prompt', { id }),

  /**
   * 获取当前激活的 Prompt
   */
  getActivePrompt: (): Promise<PromptRecord | null> =>
    invoke('get_active_prompt'),

  // ============ LLM 相关 ============

  /**
   * 设置默认的 API Key
   */
  setActiveKey: (keyId: string): Promise<void> =>
    invoke('set_active_key', { keyId }),

  /**
   * 获取当前 LLM 配置
   */
  getActiveLLMConfig: (): Promise<LLMConfigRecord | null> =>
    invoke('get_active_llm_config'),

  /**
   * 获取 LLM Provider 列表
   */
  listProviders: (): Promise<LLMProviderRecord[]> =>
    invoke('list_llm_providers'),

  /**
   * 测试 LLM 连接
   */
  testConnection: (data: {
    provider: string;
    apiKey: string;
    model: string;
    baseURL?: string;
  }): Promise<TestConnectionResult> => invoke('test_llm_connection', data),

  // ============ MCP 相关 ============

  /**
   * 连接 MCP Server
   */
  mcpConnect: (server: McpServerRecord): Promise<ApiResult<void>> =>
    invoke('mcp_connect', { server }),

  /**
   * 断开 MCP Server 连接
   */
  mcpDisconnect: (serverId: string): Promise<ApiResult<void>> =>
    invoke('mcp_disconnect', { serverId }),

  /**
   * 检查 MCP Server 是否已连接
   */
  mcpIsConnected: (serverId: string): Promise<boolean> =>
    invoke('mcp_is_connected', { serverId }),

  /**
   * 列出 MCP Server 的工具
   */
  mcpListTools: (serverId: string): Promise<ApiResult<McpToolRecord[]>> =>
    invoke('mcp_list_tools', { serverId }),

  /**
   * 调用 MCP 工具
   */
  mcpCallTool: (
    serverId: string,
    toolName: string,
    args: unknown
  ): Promise<ApiResult<unknown>> =>
    invoke('mcp_call_tool', { serverId, toolName, args }),

  // ============ Plugin 相关 ============

  /**
   * 创建 Plugin
   */
  pluginCreate: (data: {
    name: string;
    description: string;
    serverId: string;
    toolNames: string[];
  }): Promise<ApiResult<PluginRecord>> => invoke('plugin_create', data),

  /**
   * 列出所有 Plugin
   */
  pluginList: (): Promise<ApiResult<PluginRecord[]>> =>
    invoke('plugin_list'),

  /**
   * 获取单个 Plugin
   */
  pluginGet: (id: string): Promise<ApiResult<PluginRecord>> =>
    invoke('plugin_get', { id }),

  /**
   * 删除 Plugin
   */
  pluginDelete: (id: string): Promise<ApiResult<void>> =>
    invoke('plugin_delete', { id }),

  // ============ WorkflowNode 相关 ============

  /**
   * 创建 WorkflowNode
   */
  nodeCreate: (data: {
    name: string;
    description?: string;
    pluginId: string;
    toolName: string;
    inputSchema: StandardSchema;
    outputSchema: StandardSchema;
    inputMapping: Record<string, string>;
    outputMapping: Record<string, string>;
  }): Promise<ApiResult<WorkflowNodeRecord>> => invoke('node_create', data),

  /**
   * 执行 WorkflowNode
   */
  nodeExecute: (nodeId: string, input: unknown): Promise<ApiResult<unknown>> =>
    invoke('node_execute', { nodeId, input }),

  /**
   * 列出所有 WorkflowNode
   */
  nodeList: (): Promise<ApiResult<WorkflowNodeRecord[]>> =>
    invoke('node_list'),

  /**
   * 按 Plugin 列出 WorkflowNode
   */
  nodeListByPlugin: (pluginId: string): Promise<ApiResult<WorkflowNodeRecord[]>> =>
    invoke('node_list_by_plugin', { pluginId }),

  /**
   * 更新 WorkflowNode
   */
  nodeUpdate: (
    id: string,
    data: Partial<WorkflowNodeRecord>
  ): Promise<ApiResult<WorkflowNodeRecord>> => invoke('node_update', { id, data }),

  /**
   * 删除 WorkflowNode
   */
  nodeDelete: (id: string): Promise<ApiResult<void>> =>
    invoke('node_delete', { id }),

  // ============ Workflow 相关 ============

  /**
   * 创建 Workflow
   */
  workflowCreate: (data: {
    name: string;
    description?: string;
  }): Promise<ApiResult<WorkflowRecord>> => invoke('workflow_create', data),

  /**
   * 列出所有 Workflow
   */
  workflowList: (): Promise<ApiResult<WorkflowRecord[]>> =>
    invoke('workflow_list'),

  /**
   * 获取单个 Workflow
   */
  workflowGet: (id: string): Promise<ApiResult<WorkflowRecord>> =>
    invoke('workflow_get', { id }),

  /**
   * 向 Workflow 添加节点
   */
  workflowAddNode: (workflowId: string, nodeId: string): Promise<ApiResult<void>> =>
    invoke('workflow_add_node', { workflowId, nodeId }),

  /**
   * 从 Workflow 移除节点
   */
  workflowRemoveNode: (workflowId: string, nodeId: string): Promise<ApiResult<void>> =>
    invoke('workflow_remove_node', { workflowId, nodeId }),

  /**
   * 连接 Workflow 中两个节点
   */
  workflowConnect: (
    workflowId: string,
    sourceNodeId: string,
    sourceField: string,
    targetNodeId: string,
    targetField: string
  ): Promise<ApiResult<WorkflowEdgeRecord>> =>
    invoke('workflow_connect', {
      workflowId,
      sourceNodeId,
      sourceField,
      targetNodeId,
      targetField,
    }),

  /**
   * 断开 Workflow 中的连接
   */
  workflowDisconnect: (workflowId: string, edgeId: string): Promise<ApiResult<void>> =>
    invoke('workflow_disconnect', { workflowId, edgeId }),

  /**
   * 验证 Workflow
   */
  workflowValidate: (workflowId: string): Promise<ApiResult<{ valid: boolean; errors: string[] }>> =>
    invoke('workflow_validate', { workflowId }),

  /**
   * 执行 Workflow
   */
  workflowExecute: (workflowId: string, input: unknown): Promise<ApiResult<void>> =>
    invoke('workflow_execute', { workflowId, input }),

  /**
   * 更新 Workflow
   */
  workflowUpdate: (
    id: string,
    data: Partial<WorkflowRecord>
  ): Promise<ApiResult<WorkflowRecord>> => invoke('workflow_update', { id, data }),

  /**
   * 删除 Workflow
   */
  workflowDelete: (id: string): Promise<ApiResult<void>> =>
    invoke('workflow_delete', { id }),

  /**
   * 获取 Workflow 的节点列表
   */
  workflowGetNodes: (workflowId: string): Promise<ApiResult<WorkflowNodeRecord[]>> =>
    invoke('workflow_get_nodes', { workflowId }),
};
