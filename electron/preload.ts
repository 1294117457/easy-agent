import { contextBridge, ipcRenderer } from 'electron';

// IPC 事件监听器 - 使用 removeAllListeners 防止累积
// 参考: docs/0529/Electron IPC 监听器累积问题.md
const IPC_CHANNELS = {
  TOKEN: 'agent:token',
  DONE: 'agent:done',
  ERROR: 'agent:error',
  MESSAGES_SYNCED: 'agent:messages-synced',  // ✅ 新增：消息同步事件
} as const;

// 监听器注册计数（用于调试）
let tokenRegistrationCount = 0;
let doneRegistrationCount = 0;
let errorRegistrationCount = 0;
let messagesSyncedCount = 0;

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => 'pong',
  getConfig: () => ipcRenderer.invoke('config:get'),
  createApiKey: (data: { provider: string; key: string; model: string; baseURL?: string }) =>
    ipcRenderer.invoke('config:apiKey:create', data),
  deleteApiKey: (id: string) => ipcRenderer.invoke('config:apiKey:delete', id),
  createPrompt: (data: { name: string; description?: string; systemPrompt: string }) =>
    ipcRenderer.invoke('config:prompt:create', data),
  deletePrompt: (id: string) => ipcRenderer.invoke('config:prompt:delete', id),
  setActivePrompt: (id: string) => ipcRenderer.invoke('config:prompt:setActive', id),
  getActivePrompt: () => ipcRenderer.invoke('config:prompt:getActive'),
  sendMessage: (conversationId: string, message: string) =>
    ipcRenderer.invoke('chat:send', conversationId, message),
  getHistory: (conversationId: string) => ipcRenderer.invoke('chat:history', conversationId),
  getConversations: () => ipcRenderer.invoke('chat:conversations'),
  newConversation: () => ipcRenderer.invoke('chat:new'),
  deleteConversation: (conversationId: string) =>
    ipcRenderer.invoke('chat:delete', conversationId),
  compressConversation: (conversationId: string) =>
    ipcRenderer.invoke('chat:compress', conversationId),
  endConversation: (conversationId: string) =>
    ipcRenderer.invoke('chat:end', conversationId),
  onToken: (callback: (data: { conversationId: string; token: string }) => void) => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.TOKEN);
    ipcRenderer.on(IPC_CHANNELS.TOKEN, (_, data) => callback(data));
    tokenRegistrationCount++;
    const count = ipcRenderer.listenerCount(IPC_CHANNELS.TOKEN);
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;
    if (isDev) {
      console.log(`[Preload] onToken #${tokenRegistrationCount}, listener count: ${count}`);
    }
  },
  onDone: (callback: (data: { conversationId: string }) => void) => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.DONE);
    ipcRenderer.on(IPC_CHANNELS.DONE, (_, data) => callback(data));
    doneRegistrationCount++;
    const count = ipcRenderer.listenerCount(IPC_CHANNELS.DONE);
    console.log(`[Preload] onDone #${doneRegistrationCount}, listener count: ${count}`);
  },
  onError: (callback: (data: { conversationId: string; error: string }) => void) => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.ERROR);
    ipcRenderer.on(IPC_CHANNELS.ERROR, (_, data) => callback(data));
    errorRegistrationCount++;
    const count = ipcRenderer.listenerCount(IPC_CHANNELS.ERROR);
    console.log(`[Preload] onError #${errorRegistrationCount}, listener count: ${count}`);
  },

  // ✅ 新增：消息同步事件
  onMessagesSynced: (callback: (data: { conversationId: string; newMessages: unknown[] }) => void) => {
    ipcRenderer.removeAllListeners(IPC_CHANNELS.MESSAGES_SYNCED);
    ipcRenderer.on(IPC_CHANNELS.MESSAGES_SYNCED, (_, data) => callback(data));
    messagesSyncedCount++;
    const count = ipcRenderer.listenerCount(IPC_CHANNELS.MESSAGES_SYNCED);
    console.log(`[Preload] onMessagesSynced #${messagesSyncedCount}, listener count: ${count}`);
  },

  // LLM 相关 API
  setActiveKey: (keyId: string) =>
    ipcRenderer.invoke('config:llm:setActiveKey', keyId),
  getActiveLLMConfig: () =>
    ipcRenderer.invoke('config:llm:getActiveConfig'),
  listLLMProviders: () =>
    ipcRenderer.invoke('config:llm:listProviders'),
  testLLMConnection: (data: { provider: string; apiKey: string; model: string; baseURL?: string }) =>
    ipcRenderer.invoke('config:llm:testConnection', data),

  // 测试用：获取当前监听器数量
  getListenerCount: () => ({
    token: ipcRenderer.listenerCount(IPC_CHANNELS.TOKEN),
    done: ipcRenderer.listenerCount(IPC_CHANNELS.DONE),
    error: ipcRenderer.listenerCount(IPC_CHANNELS.ERROR),
    messagesSynced: ipcRenderer.listenerCount(IPC_CHANNELS.MESSAGES_SYNCED),
  }),

  // 重置计数器（测试用）
  resetListenerCounters: () => {
    tokenRegistrationCount = 0;
    doneRegistrationCount = 0;
    errorRegistrationCount = 0;
    messagesSyncedCount = 0;
    console.log('[Preload] Counters reset');
  },

  // MCP 相关 API
  mcpConnect: (server: any) => ipcRenderer.invoke('mcp:connect', server),
  mcpDisconnect: (serverId: string) => ipcRenderer.invoke('mcp:disconnect', serverId),
  mcpIsConnected: (serverId: string) => ipcRenderer.invoke('mcp:isConnected', serverId),
  mcpListTools: (serverId: string) => ipcRenderer.invoke('mcp:listTools', serverId),
  mcpCallTool: (serverId: string, toolName: string, args: any) =>
    ipcRenderer.invoke('mcp:callTool', serverId, toolName, args),
  mcpParseConfig: (configText: string) => ipcRenderer.invoke('mcp:parseConfig', configText),
  mcpConnectWithConfig: (configText: string, inputValues: Record<string, string>) =>
    ipcRenderer.invoke('mcp:connectWithConfig', configText, inputValues),

  // Plugin 相关 API
  pluginCreate: (data: any) => ipcRenderer.invoke('plugin:create', data),
  pluginList: () => ipcRenderer.invoke('plugin:list'),
  pluginGet: (id: string) => ipcRenderer.invoke('plugin:get', id),
  pluginDelete: (id: string) => ipcRenderer.invoke('plugin:delete', id),

  // WorkflowNode 相关 API
  nodeCreate: (data: any) => ipcRenderer.invoke('node:create', data),
  nodeExecute: (nodeId: string, input: any) => ipcRenderer.invoke('node:execute', nodeId, input),
  nodeList: () => ipcRenderer.invoke('node:list'),
  nodeListByPlugin: (pluginId: string) => ipcRenderer.invoke('node:listByPlugin', pluginId),
  nodeUpdate: (id: string, data: any) => ipcRenderer.invoke('node:update', id, data),
  nodeDelete: (id: string) => ipcRenderer.invoke('node:delete', id),

  // Workflow 相关 API
  workflowCreate: (data: any) => ipcRenderer.invoke('workflow:create', data),
  workflowList: () => ipcRenderer.invoke('workflow:list'),
  workflowGet: (id: string) => ipcRenderer.invoke('workflow:get', id),
  workflowAddNode: (workflowId: string, nodeId: string) =>
    ipcRenderer.invoke('workflow:addNode', workflowId, nodeId),
  workflowRemoveNode: (workflowId: string, nodeId: string) =>
    ipcRenderer.invoke('workflow:removeNode', workflowId, nodeId),
  workflowConnect: (workflowId: string, sourceNodeId: string, sourceField: string, targetNodeId: string, targetField: string) =>
    ipcRenderer.invoke('workflow:connect', workflowId, sourceNodeId, sourceField, targetNodeId, targetField),
  workflowDisconnect: (workflowId: string, edgeId: string) =>
    ipcRenderer.invoke('workflow:disconnect', workflowId, edgeId),
  workflowValidate: (workflowId: string) => ipcRenderer.invoke('workflow:validate', workflowId),
  workflowExecute: (workflowId: string, input: any) =>
    ipcRenderer.invoke('workflow:execute', workflowId, input),
  workflowUpdate: (id: string, data: any) => ipcRenderer.invoke('workflow:update', id, data),
  workflowDelete: (id: string) => ipcRenderer.invoke('workflow:delete', id),
  workflowGetNodes: (workflowId: string) => ipcRenderer.invoke('workflow:getNodes', workflowId),
});
