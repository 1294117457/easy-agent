import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => 'pong',
  getConfig: () => ipcRenderer.invoke('config:get'),
  createApiKey: (data: { provider: string; key: string; model: string }) =>
    ipcRenderer.invoke('config:apiKey:create', data),
  deleteApiKey: (id: string) => ipcRenderer.invoke('config:apiKey:delete', id),
  createPrompt: (data: { name: string; description?: string; systemPrompt: string }) =>
    ipcRenderer.invoke('config:prompt:create', data),
  deletePrompt: (id: string) => ipcRenderer.invoke('config:prompt:delete', id),
  sendMessage: (conversationId: string, message: string) =>
    ipcRenderer.invoke('chat:send', conversationId, message),
  getHistory: (conversationId: string) => ipcRenderer.invoke('chat:history', conversationId),
  getConversations: () => ipcRenderer.invoke('chat:conversations'),
  newConversation: () => ipcRenderer.invoke('chat:new'),
  deleteConversation: (conversationId: string) =>
    ipcRenderer.invoke('chat:delete', conversationId),
  onToken: (callback: (token: string) => void) =>
    ipcRenderer.on('agent:token', (_, token) => callback(token)),
  onDone: (callback: () => void) => ipcRenderer.on('agent:done', () => callback()),
  onError: (callback: (error: string) => void) =>
    ipcRenderer.on('agent:error', (_, error) => callback(error)),
});
