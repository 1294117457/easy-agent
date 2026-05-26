export const configApi = {
  getConfig: () => window.electronAPI.getConfig(),
  createApiKey: (data: { provider: string; key: string; model: string }) =>
    window.electronAPI.createApiKey(data),
  deleteApiKey: (id: string) => window.electronAPI.deleteApiKey(id),
  createPrompt: (data: { name: string; description?: string; systemPrompt: string }) =>
    window.electronAPI.createPrompt(data),
  deletePrompt: (id: string) => window.electronAPI.deletePrompt(id),
};
