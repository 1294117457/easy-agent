import type { ILLMPort } from './ports/llm.port.js';
import type { IStoragePort } from './ports/storage.port.js';
import { AgentService } from './application/AgentService.js';
import { CompressionService } from './application/CompressionService.js';
import { LLMManager, type LLMProviderType } from './application/LLMManager.js';

export class EasyAgentCore {
  private llmPort: ILLMPort | null = null;
  private storagePort: IStoragePort;
  private llmManager: LLMManager;
  private agentService: AgentService | null = null;
  private compressionService: CompressionService | null = null;

  constructor(storage: IStoragePort) {
    this.storagePort = storage;
    this.llmManager = new LLMManager();

    this.initializeLLM();
  }

  private initializeLLM(): void {
    const keys = this.storagePort.listApiKeys();
    const activeKey = keys.find((k) => k.enabled) || keys[0];

    if (!activeKey) {
      console.warn('No API Key configured. Please add one in settings.');
      return;
    }

    const decryptedKey = this.storagePort.getDecryptedKey(activeKey.id);
    if (!decryptedKey) {
      console.error('Failed to decrypt API Key:', activeKey.id);
      return;
    }

    this.llmManager.registerAdapter({
      keyId: activeKey.id,
      provider: activeKey.provider as LLMProviderType,
      model: activeKey.model,
      decryptedKey,
    });

    this.llmPort = this.llmManager.getActiveAdapter();
    if (this.llmPort) {
      this.agentService = new AgentService(this.llmPort, this.storagePort);
      this.compressionService = new CompressionService(this.storagePort, this.llmPort);
    }
  }

  sendMessage(
    conversationId: string,
    userInput: string,
    callbacks: {
      onToken: (token: string) => void;
      onDone: () => void;
      onError: (error: string) => void;
    }
  ) {
    if (!this.agentService) {
      callbacks.onError('No LLM configured. Please add an API Key in settings.');
      return;
    }
    return this.agentService.sendMessage(conversationId, userInput, callbacks);
  }

  getStorage(): IStoragePort {
    return this.storagePort;
  }

  getLLMManager(): LLMManager {
    return this.llmManager;
  }

  reloadLLM(keyId: string): void {
    const keys = this.storagePort.listApiKeys();
    const keyRecord = keys.find((k) => k.id === keyId);

    if (!keyRecord) {
      throw new Error(`API Key not found: ${keyId}`);
    }

    const decryptedKey = this.storagePort.getDecryptedKey(keyId);
    if (!decryptedKey) {
      throw new Error('Failed to decrypt API Key');
    }

    this.llmManager.registerAdapter({
      keyId: keyRecord.id,
      provider: keyRecord.provider as LLMProviderType,
      model: keyRecord.model,
      decryptedKey,
      baseURL: keyRecord.baseURL,
    });

    this.llmPort = this.llmManager.getActiveAdapter();
    if (this.llmPort) {
      this.agentService = new AgentService(this.llmPort, this.storagePort);
      this.compressionService = new CompressionService(this.storagePort, this.llmPort);
    }
  }

  hasLLMConfigured(): boolean {
    return this.llmManager.hasActiveAdapter();
  }

  getCompressionService(): CompressionService | null {
    return this.compressionService;
  }

  async compressConversation(conversationId: string) {
    if (!this.compressionService) {
      throw new Error('CompressionService not initialized');
    }
    return this.compressionService.compressConversation(conversationId);
  }

  async endConversation(conversationId: string) {
    if (!this.compressionService) {
      throw new Error('CompressionService not initialized');
    }
    return this.compressionService.endConversation(conversationId);
  }
}

export type { ILLMPort, LLMResponse } from './ports/llm.port.js';
export type { IStoragePort } from './ports/storage.port.js';
export type { SendMessageCallbacks } from './application/AgentService.js';
export * from './domain/types.js';
