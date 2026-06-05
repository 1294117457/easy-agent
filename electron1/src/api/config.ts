export const configApi = {
  // 基础配置
  getConfig: () => window.electronAPI.getConfig(),
  createApiKey: (data: { provider: string; key: string; model: string; baseURL?: string }) =>
    window.electronAPI.createApiKey(data),
  deleteApiKey: (id: string) => window.electronAPI.deleteApiKey(id),

  // Prompt CRUD
  createPrompt: (data: { name: string; description?: string; systemPrompt: string }) =>
    window.electronAPI.createPrompt(data),
  deletePrompt: (id: string) => window.electronAPI.deletePrompt(id),
  setActivePrompt: (id: string) => window.electronAPI.setActivePrompt(id),
  getActivePrompt: () => window.electronAPI.getActivePrompt(),

  // LLM 相关
  setActiveKey: (keyId: string) => window.electronAPI.setActiveKey(keyId),
  getActiveLLMConfig: () => window.electronAPI.getActiveLLMConfig(),
  listProviders: () => window.electronAPI.listLLMProviders(),
  testConnection: (data: { provider: string; apiKey: string; model: string; baseURL?: string }) =>
    window.electronAPI.testLLMConnection(data),

  // MCP 相关
  mcpConnect: (server: any) => window.electronAPI.mcpConnect(server),
  mcpDisconnect: (serverId: string) => window.electronAPI.mcpDisconnect(serverId),
  mcpIsConnected: (serverId: string) => window.electronAPI.mcpIsConnected(serverId),
  mcpListTools: (serverId: string) => window.electronAPI.mcpListTools(serverId),
  mcpCallTool: (serverId: string, toolName: string, args: any) =>
    window.electronAPI.mcpCallTool(serverId, toolName, args),

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
  workflowExecute: (workflowId: string, input: any) => window.electronAPI.workflowExecute(workflowId, input),
  workflowUpdate: (id: string, data: any) => window.electronAPI.workflowUpdate(id, data),
  workflowDelete: (id: string) => window.electronAPI.workflowDelete(id),
  workflowGetNodes: (workflowId: string) => window.electronAPI.workflowGetNodes(workflowId),
};
