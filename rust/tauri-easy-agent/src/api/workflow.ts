// ============ Tauri Workflow API ============
// 迁移自 Electron IPC API，使用 @tauri-apps/api/core 的 invoke

import { invoke } from '@tauri-apps/api/core';
import type {
  ApiResult,
  McpServerRecord,
  McpToolRecord,
  McpListServersResult,
  McpParseConfigResult,
  McpConnectWithConfigResult,
  PluginRecord,
  StandardSchema,
  WorkflowNodeRecord,
  WorkflowRecord,
  WorkflowEdgeRecord,
} from '@/types/electron.d.ts';

// ============ MCP Server Input 类型 ============
export interface McpServerInput {
  id?: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  enabled?: boolean;
}

// ============ MCP Server CRUD ============
export const workflowApi = {
  /**
   * 列出所有 MCP Server
   */
  mcpList: (): Promise<McpListServersResult> => invoke('mcp_list'),

  /**
   * 获取单个 MCP Server
   */
  mcpGet: (id: string): Promise<McpServerRecord | null> =>
    invoke('mcp_get', { id }),

  /**
   * 保存（创建或更新）MCP Server
   */
  mcpSave: (data: McpServerInput): Promise<ApiResult<McpServerRecord>> =>
    invoke('mcp_save', { data }),

  /**
   * 更新 MCP Server
   */
  mcpUpdate: (
    id: string,
    updates: Partial<McpServerInput>
  ): Promise<ApiResult<McpServerRecord>> =>
    invoke('mcp_update', { id, updates }),

  /**
   * 删除 MCP Server
   */
  mcpDelete: (id: string): Promise<ApiResult<void>> =>
    invoke('mcp_delete', { id }),

  // ============ MCP Server 连接 ============

  /**
   * 连接 MCP Server
   */
  mcpConnect: (id: string): Promise<ApiResult<void>> =>
    invoke('mcp_connect', { id }),

  /**
   * 断开 MCP Server 连接
   */
  mcpDisconnect: (id: string): Promise<ApiResult<void>> =>
    invoke('mcp_disconnect', { id }),

  /**
   * 重连 MCP Server
   */
  mcpReconnect: (id: string): Promise<ApiResult<void>> =>
    invoke('mcp_reconnect', { id }),

  /**
   * 检查 MCP Server 是否已连接
   */
  mcpIsConnected: (id: string): Promise<boolean> =>
    invoke('mcp_is_connected', { id }),

  // ============ MCP Server 工具 ============

  /**
   * 列出 MCP Server 的工具
   */
  mcpListTools: (id: string): Promise<ApiResult<McpToolRecord[]>> =>
    invoke('mcp_list_tools', { id }),

  /**
   * 调用 MCP 工具
   */
  mcpCallTool: (id: string, toolName: string, args: unknown): Promise<ApiResult<unknown>> =>
    invoke('mcp_call_tool', { id, toolName, args }),

  // ============ MCP 配置解析 ============

  /**
   * 解析 MCP Config 文本
   */
  mcpParseConfig: (configText: string): Promise<McpParseConfigResult> =>
    invoke('mcp_parse_config', { configText }),

  /**
   * 通过配置文本连接 MCP Server
   */
  mcpConnectWithConfig: (
    configText: string,
    inputValues: Record<string, string>
  ): Promise<McpConnectWithConfigResult> =>
    invoke('mcp_connect_with_config', { configText, inputValues }),

  // ============ Plugin ============

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

  // ============ WorkflowNode ============

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
  ): Promise<ApiResult<WorkflowNodeRecord>> =>
    invoke('node_update', { id, data }),

  /**
   * 删除 WorkflowNode
   */
  nodeDelete: (id: string): Promise<ApiResult<void>> =>
    invoke('node_delete', { id }),

  // ============ Workflow ============

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
