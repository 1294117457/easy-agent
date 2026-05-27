import type { ILLMPort } from '../ports/llm.port.js';
import { OpenAIAdapter } from '../adapters/llm/openai.adapter.js';
import { ClaudeAdapter } from '../adapters/llm/claude.adapter.js';
import { QwenAdapter } from '../adapters/llm/qwen.adapter.js';
import { GroqAdapter } from '../adapters/llm/groq.adapter.js';
import { DeepSeekAdapter } from '../adapters/llm/deepseek.adapter.js';
import { GeminiAdapter } from '../adapters/llm/gemini.adapter.js';
import { XiaomiAdapter } from '../adapters/llm/xiaomi.adapter.js';

export type LLMProviderType = 'openai' | 'anthropic' | 'qwen' | 'groq' | 'deepseek' | 'gemini' | 'xiaomi';

export interface LLMConfig {
  keyId: string;
  provider: LLMProviderType;
  model: string;
  decryptedKey: string;
  baseURL?: string;
}

export interface LLMAdapterInfo {
  keyId: string;
  provider: string;
  model: string;
}

export class LLMManager {
  private adapters: Map<string, ILLMPort> = new Map();
  private adapterInfos: Map<string, LLMAdapterInfo> = new Map();
  private activeKeyId: string | null = null;

  registerAdapter(config: LLMConfig): void {
    const adapter = this.createAdapter(config);
    this.adapters.set(config.keyId, adapter);
    this.adapterInfos.set(config.keyId, {
      keyId: config.keyId,
      provider: config.provider,
      model: config.model,
    });
    this.activeKeyId = config.keyId;
  }

  setActiveKey(keyId: string): void {
    if (!this.adapters.has(keyId)) {
      throw new Error(`Adapter not found: ${keyId}`);
    }
    this.activeKeyId = keyId;
  }

  getActiveAdapter(): ILLMPort | null {
    if (!this.activeKeyId) return null;
    return this.adapters.get(this.activeKeyId) || null;
  }

  getActiveConfig(): LLMAdapterInfo | null {
    if (!this.activeKeyId) return null;
    const info = this.adapterInfos.get(this.activeKeyId);
    if (!info) return null;
    return {
      keyId: this.activeKeyId,
      provider: info.provider,
      model: info.model,
    };
  }

  removeAdapter(keyId: string): void {
    this.adapters.delete(keyId);
    this.adapterInfos.delete(keyId);
    if (this.activeKeyId === keyId) {
      this.activeKeyId = this.adapters.keys().next().value || null;
    }
  }

  listAdapters(): LLMAdapterInfo[] {
    return Array.from(this.adapterInfos.values());
  }

  hasActiveAdapter(): boolean {
    return this.activeKeyId !== null && this.adapters.has(this.activeKeyId);
  }

  private createAdapter(config: LLMConfig): ILLMPort {
    switch (config.provider) {
      case 'openai':
        return new OpenAIAdapter(config.model, config.decryptedKey);
      case 'anthropic':
        return new ClaudeAdapter(config.model, config.decryptedKey);
      case 'qwen':
        return new QwenAdapter(config.model, config.decryptedKey, config.baseURL);
      case 'groq':
        return new GroqAdapter(config.model, config.decryptedKey);
      case 'deepseek':
        return new DeepSeekAdapter(config.model, config.decryptedKey);
      case 'gemini':
        return new GeminiAdapter(config.model, config.decryptedKey);
      case 'xiaomi':
        return new XiaomiAdapter(config.model, config.decryptedKey, config.baseURL);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
}
