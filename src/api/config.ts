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
};
