import type { ILLMPort } from './ports/llm.port.js';
import type { IStoragePort } from './ports/storage.port.js';
import { AgentService } from './application/AgentService.js';
import { OpenAIAdapter } from './adapters/llm/openai.adapter.js';

export class EasyAgentCore {
  private llmPort: ILLMPort;
  private storagePort: IStoragePort;
  private agentService: AgentService;

  constructor(storage: IStoragePort) {
    this.storagePort = storage;

    const keys = this.storagePort.listApiKeys();
    const activeKey = keys.find((k) => k.enabled) || keys[0];

    if (!activeKey) {
      console.warn('No API Key configured. Please add one in settings.');
      this.llmPort = null as unknown as ILLMPort;
      this.agentService = null as unknown as AgentService;
      return;
    }

    const decryptedKey = this.storagePort.getDecryptedKey(activeKey.id);
    if (!decryptedKey) {
      throw new Error('Failed to decrypt API Key');
    }

    this.llmPort = new OpenAIAdapter(activeKey.model, decryptedKey);
    this.agentService = new AgentService(this.llmPort, this.storagePort);
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
    return this.agentService.sendMessage(conversationId, userInput, callbacks);
  }

  getStorage(): IStoragePort {
    return this.storagePort;
  }

  reloadLLM(provider: string, model: string, apiKey: string) {
    this.llmPort = new OpenAIAdapter(model, apiKey);
    this.agentService = new AgentService(this.llmPort, this.storagePort);
  }
}

export type { ILLMPort, LLMResponse } from './ports/llm.port.js';
export type { IStoragePort } from './ports/storage.port.js';
export type { SendMessageCallbacks } from './application/AgentService.js';
export * from './domain/types.js';
