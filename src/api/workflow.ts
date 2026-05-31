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

export const workflowApi = {
  // ============ MCP Server CRUD ============
  mcpList: () => window.electronAPI.mcpList(),
  mcpGet: (id: string) => window.electronAPI.mcpGet(id),
  mcpSave: (data: McpServerInput) => window.electronAPI.mcpSave(data),
  mcpUpdate: (id: string, updates: Partial<McpServerInput>) => window.electronAPI.mcpUpdate(id, updates),
  mcpDelete: (id: string) => window.electronAPI.mcpDelete(id),

  // ============ MCP Server 连接 ============
  mcpConnect: (id: string) => window.electronAPI.mcpConnect(id),
  mcpDisconnect: (id: string) => window.electronAPI.mcpDisconnect(id),
  mcpReconnect: (id: string) => window.electronAPI.mcpReconnect(id),
  mcpIsConnected: (id: string) => window.electronAPI.mcpIsConnected(id),

  // ============ MCP Server 工具 ============
  mcpListTools: (id: string) => window.electronAPI.mcpListTools(id),
  mcpCallTool: (id: string, toolName: string, args: any) =>
    window.electronAPI.mcpCallTool(id, toolName, args),

  // ============ MCP 配置解析 ============
  mcpParseConfig: (configText: string) => window.electronAPI.mcpParseConfig(configText),
  mcpConnectWithConfig: (configText: string, inputValues: Record<string, string>) =>
    window.electronAPI.mcpConnectWithConfig(configText, inputValues),

  // ============ Plugin ============
  pluginCreate: (data: { name: string; description: string; serverId: string; toolNames: string[] }) =>
    window.electronAPI.pluginCreate(data),
  pluginList: () => window.electronAPI.pluginList(),
  pluginGet: (id: string) => window.electronAPI.pluginGet(id),
  pluginDelete: (id: string) => window.electronAPI.pluginDelete(id),

  // ============ WorkflowNode ============
  nodeCreate: (data: any) => window.electronAPI.nodeCreate(data),
  nodeExecute: (nodeId: string, input: any) => window.electronAPI.nodeExecute(nodeId, input),
  nodeList: () => window.electronAPI.nodeList(),
  nodeListByPlugin: (pluginId: string) => window.electronAPI.nodeListByPlugin(pluginId),
  nodeUpdate: (id: string, data: any) => window.electronAPI.nodeUpdate(id, data),
  nodeDelete: (id: string) => window.electronAPI.nodeDelete(id),

  // ============ Workflow ============
  workflowCreate: (data: { name: string; description?: string }) =>
    window.electronAPI.workflowCreate(data),
  workflowList: () => window.electronAPI.workflowList(),
  workflowGet: (id: string) => window.electronAPI.workflowGet(id),
  workflowAddNode: (workflowId: string, nodeId: string) =>
    window.electronAPI.workflowAddNode(workflowId, nodeId),
  workflowRemoveNode: (workflowId: string, nodeId: string) =>
    window.electronAPI.workflowRemoveNode(workflowId, nodeId),
  workflowConnect: (workflowId: string, sourceNodeId: string, sourceField: string, targetNodeId: string, targetField: string) =>
    window.electronAPI.workflowConnect(workflowId, sourceNodeId, sourceField, targetNodeId, targetField),
  workflowDisconnect: (workflowId: string, edgeId: string) =>
    window.electronAPI.workflowDisconnect(workflowId, edgeId),
  workflowValidate: (workflowId: string) => window.electronAPI.workflowValidate(workflowId),
  workflowExecute: (workflowId: string, input: any) =>
    window.electronAPI.workflowExecute(workflowId, input),
  workflowUpdate: (id: string, data: any) => window.electronAPI.workflowUpdate(id, data),
  workflowDelete: (id: string) => window.electronAPI.workflowDelete(id),
  workflowGetNodes: (workflowId: string) => window.electronAPI.workflowGetNodes(workflowId),
};
