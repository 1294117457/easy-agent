import { contextBridge, ipcRenderer } from 'electron';

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
  onToken: (callback: (token: string) => void) =>
    ipcRenderer.on('agent:token', (_, token) => callback(token)),
  onDone: (callback: () => void) => ipcRenderer.on('agent:done', () => callback()),
  onError: (callback: (error: string) => void) =>
    ipcRenderer.on('agent:error', (_, error) => callback(error)),

  // LLM 相关 API
  setActiveKey: (keyId: string) =>
    ipcRenderer.invoke('config:llm:setActiveKey', keyId),
  getActiveLLMConfig: () =>
    ipcRenderer.invoke('config:llm:getActiveConfig'),
  listLLMProviders: () =>
    ipcRenderer.invoke('config:llm:listProviders'),
  testLLMConnection: (data: { provider: string; apiKey: string; model: string; baseURL?: string }) =>
    ipcRenderer.invoke('config:llm:testConnection', data),
});
