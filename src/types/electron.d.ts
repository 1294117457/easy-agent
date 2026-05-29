interface ElectronAPI {
  ping?(): string;
  getConfig(): Promise<{ apiKeys: unknown[]; prompts: unknown[]; llmConfig: unknown }>;
  createApiKey(data: { provider: string; key: string; model: string; baseURL?: string }): Promise<unknown>;
  deleteApiKey(id: string): Promise<boolean>;
  createPrompt(data: { name: string; description?: string; systemPrompt: string }): Promise<unknown>;
  deletePrompt(id: string): Promise<boolean>;
  setActivePrompt(id: string): Promise<boolean>;
  getActivePrompt(): Promise<unknown>;
  sendMessage(conversationId: string, message: string): Promise<void>;
  getHistory(conversationId: string): Promise<unknown[]>;
  getConversations(): Promise<unknown[]>;
  newConversation(): Promise<{ id: string; name: string }>;
  deleteConversation(conversationId: string): Promise<boolean>;
  compressConversation(conversationId: string): Promise<{ summary: string; title: string } | null>;
  endConversation(conversationId: string): Promise<void>;
  onToken(callback: (data: { conversationId: string; token: string }) => void): void;
  onDone(callback: (data: { conversationId: string }) => void): void;
  onError(callback: (data: { conversationId: string; error: string }) => void): void;
  onMessagesSynced(callback: (data: { conversationId: string; newMessages: unknown[] }) => void): void;  // ✅ 新增

  // LLM 相关
  setActiveKey(keyId: string): Promise<void>;
  getActiveLLMConfig(): Promise<{ keyId: string; provider: string; model: string } | null>;
  listLLMProviders(): Promise<Array<{ id: string; name: string; models: string[] }>>;
  testLLMConnection(data: { provider: string; apiKey: string; model: string; baseURL?: string }): Promise<{ success: boolean; message?: string }>;

  // 调试用
  getListenerCount(): { token: number; done: number; error: number; messagesSynced: number };
  resetListenerCounters(): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
