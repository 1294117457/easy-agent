interface ElectronAPI {
  ping?(): string;
  getConfig(): Promise<{ apiKeys: unknown[]; prompts: unknown[] }>;
  createApiKey(data: { provider: string; key: string; model: string }): Promise<unknown>;
  deleteApiKey(id: string): Promise<boolean>;
  createPrompt(data: { name: string; description?: string; systemPrompt: string }): Promise<unknown>;
  deletePrompt(id: string): Promise<boolean>;
  sendMessage(conversationId: string, message: string): Promise<void>;
  getHistory(conversationId: string): Promise<unknown[]>;
  getConversations(): Promise<unknown[]>;
  newConversation(): Promise<{ id: string; name: string }>;
  deleteConversation(conversationId: string): Promise<boolean>;
  onToken(callback: (token: string) => void): void;
  onDone(callback: () => void): void;
  onError(callback: (error: string) => void): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
