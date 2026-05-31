export const workflowApi = {
  // MCP 相关
  mcpConnect: (server: any) => window.electronAPI.mcpConnect(server),
  mcpDisconnect: (serverId: string) => window.electronAPI.mcpDisconnect(serverId),
  mcpIsConnected: (serverId: string) => window.electronAPI.mcpIsConnected(serverId),
  mcpListTools: (serverId: string) => window.electronAPI.mcpListTools(serverId),
  mcpCallTool: (serverId: string, toolName: string, args: any) =>
    window.electronAPI.mcpCallTool(serverId, toolName, args),
  mcpParseConfig: (configText: string) => window.electronAPI.mcpParseConfig(configText),
  mcpConnectWithConfig: (configText: string, inputValues: Record<string, string>) =>
    window.electronAPI.mcpConnectWithConfig(configText, inputValues),

  // Plugin 相关
  pluginCreate: (data: { name: string; description: string; serverId: string; toolNames: string[] }) =>
    window.electronAPI.pluginCreate(data),
  pluginList: () => window.electronAPI.pluginList(),
  pluginGet: (id: string) => window.electronAPI.pluginGet(id),
  pluginDelete: (id: string) => window.electronAPI.pluginDelete(id),

  // WorkflowNode 相关
  nodeCreate: (data: any) => window.electronAPI.nodeCreate(data),
  nodeExecute: (nodeId: string, input: any) => window.electronAPI.nodeExecute(nodeId, input),
  nodeList: () => window.electronAPI.nodeList(),
  nodeListByPlugin: (pluginId: string) => window.electronAPI.nodeListByPlugin(pluginId),
  nodeUpdate: (id: string, data: any) => window.electronAPI.nodeUpdate(id, data),
  nodeDelete: (id: string) => window.electronAPI.nodeDelete(id),

  // Workflow 相关
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
