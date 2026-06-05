# API Key 配置功能 - 分步实现文档

## 概述

本文档详细说明如何实现多模型厂商的 API Key 配置功能。包含每个步骤需要修改的代码位置、具体内容，以及操作顺序。

---

## 目录

1. [当前架构分析](#1-当前架构分析)
2. [步骤 1：新增 Claude Adapter](#步骤-1新增-claude-adapter)
3. [步骤 2：新增 LLM Manager（工厂模式）](#步骤-2新增-llm-manager工厂模式)
4. [步骤 3：修改 EasyAgentCore 集成 LLMManager](#步骤-3修改-easyagentcore-集成-llmmanager)
5. [步骤 4：扩展 IPC Handler（新增 LLM 操作）](#步骤-4扩展-ipc-handler新增-llm-操作)
6. [步骤 5：扩展 Preload（新增 API）](#步骤-5扩展-preload新增-api)
7. [步骤 6：扩展前端 API 封装](#步骤-6扩展前端-api-封装)
8. [步骤 7：扩展前端 Store](#步骤-7扩展前端-store)
9. [步骤 8：优化设置页面 UI](#步骤-8优化设置页面-ui)
10. [步骤 9：添加依赖](#步骤-9添加依赖)
11. [测试验证](#测试验证)

---

## 1. 当前架构分析

### 1.1 现有代码状态

| 模块 | 文件 | 状态 |
|------|------|------|
| 存储层 | `electron/core/adapters/storage/sqlite.adapter.ts` | ✅ 已支持多 Provider |
| 类型定义 | `electron/core/domain/types.ts` | ✅ `ApiKey` 接口已有 |
| OpenAI Adapter | `electron/core/adapters/llm/openai.adapter.ts` | ✅ 已有 |
| IPC Handler | `electron/ipc/config.handler.ts` | ✅ 已有 CRUD |
| Preload | `electron/preload.ts` | ✅ 已有基础 API |
| 前端 API | `src/api/config.ts` | ✅ 已有 |
| 设置页面 | `src/views/SettingsView.vue` | ✅ 已有基础 UI |

### 1.2 需要新增/修改的内容

```
新增文件:
├── electron/core/adapters/llm/claude.adapter.ts   [新增]
├── electron/core/application/LLMManager.ts       [新增]
└── electron/ipc/llm.handler.ts                  [新增]

修改文件:
├── electron/core/index.ts                         [修改]
├── electron/preload.ts                            [修改]
├── electron/main.ts                              [修改]
├── src/api/config.ts                             [修改]
├── src/stores/agent.ts                           [修改]
└── src/views/SettingsView.vue                    [修改]
```

---

## 步骤 1：新增 Claude Adapter

### 目标
创建 `ClaudeAdapter`，实现 `ILLMPort` 接口，支持 Claude 模型调用。

### 文件位置
```
electron/core/adapters/llm/claude.adapter.ts
```

### 代码内容

```typescript
import { Anthropic } from '@anthropic-ai/sdk';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort, LLMResponse } from '../../ports/llm.port.js';

export class ClaudeAdapter implements ILLMPort {
  readonly provider = 'anthropic';
  model: string;
  private client: Anthropic;

  constructor(model: string, apiKey: string) {
    this.model = model;
    this.client = new Anthropic({ apiKey });
  }

  async invoke(messages: BaseMessage[]): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: this.toClaudeFormat(messages),
    });

    const content = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    return {
      content,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async invokeStream(
    messages: BaseMessage[],
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: 4096,
      messages: this.toClaudeFormat(messages),
    });

    let full = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        full += event.delta.text;
        onChunk(event.delta.text);
      }
    }

    return { content: full };
  }

  private toClaudeFormat(messages: BaseMessage[]): Array<{ role: string; content: string }> {
    return messages.map(m => ({
      role: m.getType() === 'human' ? 'user' : 'assistant',
      content: m.content as string,
    }));
  }
}
```

### 操作步骤

1. 在 `electron/core/adapters/llm/` 目录下新建 `claude.adapter.ts`
2. 粘贴上述代码
3. 保存文件

---

## 步骤 2：新增 LLM Manager（工厂模式）

### 目标
创建 `LLMManager`，实现工厂模式，根据 Provider 动态创建对应的 Adapter。

### 文件位置
```
electron/core/application/LLMManager.ts
```

### 代码内容

```typescript
import type { ILLMPort } from '../ports/llm.port.js';
import { OpenAIAdapter } from '../adapters/llm/openai.adapter.js';
import { ClaudeAdapter } from '../adapters/llm/claude.adapter.js';

export interface LLMConfig {
  keyId: string;
  provider: 'openai' | 'anthropic';
  model: string;
  decryptedKey: string;
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
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
}
```

### 操作步骤

1. 在 `electron/core/application/` 目录下新建 `LLMManager.ts`
2. 粘贴上述代码
3. 保存文件

---

## 步骤 3：修改 EasyAgentCore 集成 LLMManager

### 目标
修改 `EasyAgentCore`，使用 `LLMManager` 替代硬编码的 `OpenAIAdapter`。

### 文件位置
```
electron/core/index.ts
```

### 当前代码（第 1-53 行）

```typescript
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

    this.llmPort = new OpenAIAdapter(activeKey.model, decryptedKey);  // ← 硬编码
    this.agentService = new AgentService(this.llmPort, this.storagePort);
  }

  sendMessage(conversationId: string, userInput: string, callbacks: ...) {
    return this.agentService.sendMessage(conversationId, userInput, callbacks);
  }

  getStorage(): IStoragePort {
    return this.storagePort;
  }

  reloadLLM(provider: string, model: string, apiKey: string) {  // ← 只支持 OpenAI
    this.llmPort = new OpenAIAdapter(model, apiKey);
    this.agentService = new AgentService(this.llmPort, this.storagePort);
  }
}
```

### 修改后代码

```typescript
import type { ILLMPort } from './ports/llm.port.js';
import type { IStoragePort } from './ports/storage.port.js';
import { AgentService } from './application/AgentService.js';
import { LLMManager } from './application/LLMManager.js';

export class EasyAgentCore {
  private llmPort: ILLMPort | null = null;
  private storagePort: IStoragePort;
  private llmManager: LLMManager;
  private agentService: AgentService | null = null;

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
      provider: activeKey.provider as 'openai' | 'anthropic',
      model: activeKey.model,
      decryptedKey,
    });

    this.llmPort = this.llmManager.getActiveAdapter();
    if (this.llmPort) {
      this.agentService = new AgentService(this.llmPort, this.storagePort);
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
      provider: keyRecord.provider as 'openai' | 'anthropic',
      model: keyRecord.model,
      decryptedKey,
    });

    this.llmPort = this.llmManager.getActiveAdapter();
    if (this.llmPort) {
      this.agentService = new AgentService(this.llmPort, this.storagePort);
    }
  }

  hasLLMConfigured(): boolean {
    return this.llmManager.hasActiveAdapter();
  }
}
```

### 操作步骤

1. 打开 `electron/core/index.ts`
2. 修改 import 语句（删除 `OpenAIAdapter`，添加 `LLMManager`）
3. 替换整个类实现
4. 保存文件

---

## 步骤 4：扩展 IPC Handler（新增 LLM 操作）

### 目标
在 `config.handler.ts` 中添加 LLM 相关的 IPC 处理。

### 文件位置
```
electron/ipc/config.handler.ts
```

### 当前代码

```typescript
import type { IpcMain } from 'electron';
import type { IStoragePort } from '../core/index.js';

export function registerConfigHandlers(
  ipcMain: IpcMain,
  storage: IStoragePort
) {
  ipcMain.handle('config:get', () => {
    return {
      apiKeys: storage.listApiKeys(),
      prompts: storage.listPrompts(),
    };
  });

  ipcMain.handle('config:apiKey:create', (_, data) => {
    return storage.createApiKey(data);
  });

  ipcMain.handle('config:apiKey:delete', (_, id) => {
    return storage.deleteApiKey(id);
  });

  ipcMain.handle('config:prompt:create', (_, data) => {
    return storage.createPrompt(data);
  });

  ipcMain.handle('config:prompt:delete', (_, id) => {
    return storage.deletePrompt(id);
  });
}
```

### 修改后代码

```typescript
import type { IpcMain } from 'electron';
import type { IStoragePort } from '../core/index.js';
import type { EasyAgentCore } from '../core/index.js';
import { OpenAIAdapter } from '../core/adapters/llm/openai.adapter.js';
import { ClaudeAdapter } from '../core/adapters/llm/claude.adapter.js';
import type { BaseMessage } from '@langchain/core/messages';

export function registerConfigHandlers(
  ipcMain: IpcMain,
  storage: IStoragePort,
  core?: EasyAgentCore
) {
  // 现有 handlers...
  ipcMain.handle('config:get', () => {
    return {
      apiKeys: storage.listApiKeys(),
      prompts: storage.listPrompts(),
      llmConfig: core?.getLLMManager().getActiveConfig() || null,
    };
  });

  ipcMain.handle('config:apiKey:create', (_, data) => {
    return storage.createApiKey(data);
  });

  ipcMain.handle('config:apiKey:delete', (_, id) => {
    return storage.deleteApiKey(id);
  });

  ipcMain.handle('config:prompt:create', (_, data) => {
    return storage.createPrompt(data);
  });

  ipcMain.handle('config:prompt:delete', (_, id) => {
    return storage.deletePrompt(id);
  });

  // ========== 新增 LLM 相关 handlers ==========

  // 设置当前使用的 API Key
  ipcMain.handle('config:llm:setActiveKey', (_, keyId: string) => {
    if (core) {
      core.reloadLLM(keyId);
    }
    return true;
  });

  // 获取 LLM 配置
  ipcMain.handle('config:llm:getActiveConfig', () => {
    if (core) {
      return core.getLLMManager().getActiveConfig();
    }
    return null;
  });

  // 获取支持的 Provider 列表
  ipcMain.handle('config:llm:listProviders', () => {
    return [
      {
        id: 'openai',
        name: 'OpenAI',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      },
      {
        id: 'anthropic',
        name: 'Claude',
        models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-3-20250714'],
      },
    ];
  });

  // 测试连接
  ipcMain.handle('config:llm:testConnection', async (_, data) => {
    try {
      let adapter: OpenAIAdapter | ClaudeAdapter;

      if (data.provider === 'openai') {
        adapter = new OpenAIAdapter(data.model, data.apiKey);
      } else if (data.provider === 'anthropic') {
        adapter = new ClaudeAdapter(data.model, data.apiKey);
      } else {
        return { success: false, error: `Unsupported provider: ${data.provider}` };
      }

      // 发送一条测试消息
      const testMessage: BaseMessage = {
        getType: () => 'human',
        content: 'Hi',
        additional_kwargs: {},
        name: '',
      } as any;

      await adapter.invoke([testMessage]);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
```

### 操作步骤

1. 打开 `electron/ipc/config.handler.ts`
2. 修改函数签名，添加 `core` 参数
3. 在 `config:get` handler 中添加 `llmConfig`
4. 在文件末尾添加新的 LLM handlers
5. 保存文件

---

## 步骤 5：扩展 Preload（新增 API）

### 目标
在 `preload.ts` 中暴露新的 LLM 相关 API 给前端。

### 文件位置
```
electron/preload.ts
```

### 当前代码

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => 'pong',
  getConfig: () => ipcRenderer.invoke('config:get'),
  createApiKey: (data) => ipcRenderer.invoke('config:apiKey:create', data),
  deleteApiKey: (id) => ipcRenderer.invoke('config:apiKey:delete', id),
  createPrompt: (data) => ipcRenderer.invoke('config:prompt:create', data),
  deletePrompt: (id) => ipcRenderer.invoke('config:prompt:delete', id),
  sendMessage: (conversationId, message) =>
    ipcRenderer.invoke('chat:send', conversationId, message),
  getHistory: (conversationId) => ipcRenderer.invoke('chat:history', conversationId),
  getConversations: () => ipcRenderer.invoke('chat:conversations'),
  newConversation: () => ipcRenderer.invoke('chat:new'),
  deleteConversation: (conversationId) =>
    ipcRenderer.invoke('chat:delete', conversationId),
  onToken: (callback) =>
    ipcRenderer.on('agent:token', (_, token) => callback(token)),
  onDone: (callback) => ipcRenderer.on('agent:done', () => callback()),
  onError: (callback) =>
    ipcRenderer.on('agent:error', (_, error) => callback(error)),
});
```

### 修改后代码

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 现有 API...
  ping: () => 'pong',
  getConfig: () => ipcRenderer.invoke('config:get'),
  createApiKey: (data) => ipcRenderer.invoke('config:apiKey:create', data),
  deleteApiKey: (id) => ipcRenderer.invoke('config:apiKey:delete', id),
  createPrompt: (data) => ipcRenderer.invoke('config:prompt:create', data),
  deletePrompt: (id) => ipcRenderer.invoke('config:prompt:delete', id),
  sendMessage: (conversationId, message) =>
    ipcRenderer.invoke('chat:send', conversationId, message),
  getHistory: (conversationId) => ipcRenderer.invoke('chat:history', conversationId),
  getConversations: () => ipcRenderer.invoke('chat:conversations'),
  newConversation: () => ipcRenderer.invoke('chat:new'),
  deleteConversation: (conversationId) =>
    ipcRenderer.invoke('chat:delete', conversationId),
  onToken: (callback) =>
    ipcRenderer.on('agent:token', (_, token) => callback(token)),
  onDone: (callback) => ipcRenderer.on('agent:done', () => callback()),
  onError: (callback) =>
    ipcRenderer.on('agent:error', (_, error) => callback(error)),

  // ========== 新增 LLM 相关 API ==========

  // 设置当前使用的 API Key
  setActiveKey: (keyId: string) =>
    ipcRenderer.invoke('config:llm:setActiveKey', keyId),

  // 获取当前 LLM 配置
  getActiveLLMConfig: () =>
    ipcRenderer.invoke('config:llm:getActiveConfig'),

  // 获取支持的 Provider 列表
  listLLMProviders: () =>
    ipcRenderer.invoke('config:llm:listProviders'),

  // 测试连接
  testLLMConnection: (data: { provider: string; apiKey: string; model: string }) =>
    ipcRenderer.invoke('config:llm:testConnection', data),
});
```

### 操作步骤

1. 打开 `electron/preload.ts`
2. 在文件末尾添加新的 API 方法
3. 保存文件

---

## 步骤 6：扩展前端 API 封装

### 目标
在 `src/api/config.ts` 中添加 LLM 相关的 API 调用封装。

### 文件位置
```
src/api/config.ts
```

### 当前代码

```typescript
export const configApi = {
  getConfig: () => window.electronAPI.getConfig(),
  createApiKey: (data) => window.electronAPI.createApiKey(data),
  deleteApiKey: (id) => window.electronAPI.deleteApiKey(id),
  createPrompt: (data) => window.electronAPI.createPrompt(data),
  deletePrompt: (id) => window.electronAPI.deletePrompt(id),
};
```

### 修改后代码

```typescript
export const configApi = {
  // 现有 API...
  getConfig: () => window.electronAPI.getConfig(),
  createApiKey: (data) => window.electronAPI.createApiKey(data),
  deleteApiKey: (id) => window.electronAPI.deleteApiKey(id),
  createPrompt: (data) => window.electronAPI.createPrompt(data),
  deletePrompt: (id) => window.electronAPI.deletePrompt(id),

  // ========== 新增 LLM 相关 API ==========

  // 设置当前使用的 API Key
  setActiveKey: (keyId: string) => window.electronAPI.setActiveKey(keyId),

  // 获取当前 LLM 配置
  getActiveLLMConfig: () => window.electronAPI.getActiveLLMConfig(),

  // 获取支持的 Provider 列表
  listProviders: () => window.electronAPI.listLLMProviders(),

  // 测试连接
  testConnection: (data: { provider: string; apiKey: string; model: string }) =>
    window.electronAPI.testLLMConnection(data),
};
```

### 操作步骤

1. 打开 `src/api/config.ts`
2. 在文件末尾添加新的 API 方法
3. 保存文件

---

## 步骤 7：扩展前端 Store

### 目标
在 `src/stores/agent.ts` 中添加 LLM 配置相关的状态管理。

### 文件位置
```
src/stores/agent.ts
```

### 当前代码（部分）

```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { chatApi, setupChatListeners } from '@/api/chat';

export const useAgentStore = defineStore('agent', () => {
  const messages = ref<any[]>([]);
  const isLoading = ref(false);
  const currentConversationId = ref<string | null>(null);
  const conversations = ref<any[]>([]);

  // ... 现有方法

  return {
    messages,
    isLoading,
    currentConversationId,
    conversations,
    // ... 现有返回值
  };
});
```

### 修改后代码

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { chatApi, setupChatListeners } from '@/api/chat';
import { configApi } from '@/api/config';

export interface LLMProvider {
  id: string;
  name: string;
  models: string[];
}

export interface LLMConfig {
  keyId: string;
  provider: string;
  model: string;
}

export const useAgentStore = defineStore('agent', () => {
  const messages = ref<any[]>([]);
  const isLoading = ref(false);
  const currentConversationId = ref<string | null>(null);
  const conversations = ref<any[]>([]);

  // ========== 新增 LLM 配置相关状态 ==========
  const providers = ref<LLMProvider[]>([]);
  const llmConfig = ref<LLMConfig | null>(null);
  const isLLMConfigured = computed(() => llmConfig.value !== null);

  async function loadLLMConfig() {
    try {
      const [providerList, config] = await Promise.all([
        configApi.listProviders(),
        configApi.getActiveLLMConfig(),
      ]);
      providers.value = providerList;
      llmConfig.value = config;
    } catch (error) {
      console.error('Failed to load LLM config:', error);
    }
  }

  async function setActiveKey(keyId: string) {
    await configApi.setActiveKey(keyId);
    await loadLLMConfig();
  }

  // ... 现有方法保持不变

  return {
    messages,
    isLoading,
    currentConversationId,
    conversations,
    // 新增返回值
    providers,
    llmConfig,
    isLLMConfigured,
    loadLLMConfig,
    setActiveKey,
    // ... 现有返回值
  };
});
```

### 操作步骤

1. 打开 `src/stores/agent.ts`
2. 添加类型定义
3. 在 `defineStore` 中添加新的状态和方法
4. 在返回值中添加新状态
5. 保存文件

---

## 步骤 8：优化设置页面 UI

### 目标
增强 `SettingsView.vue`，添加更好的 API Key 管理功能（设置默认、测试连接）。

### 文件位置
```
src/views/SettingsView.vue
```

### 当前代码

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { configApi } from '@/api/config';

const apiKeys = ref<any[]>([]);
const prompts = ref<any[]>([]);
const newKeyForm = ref({ provider: 'openai', key: '', model: 'gpt-4o' });
const newPromptForm = ref({ name: '', description: '', systemPrompt: '' });

onMounted(async () => {
  const config = await configApi.getConfig();
  apiKeys.value = config.apiKeys;
  prompts.value = config.prompts;
});

async function handleAddKey() {
  if (!newKeyForm.value.key.trim()) return;
  const created = await configApi.createApiKey(newKeyForm.value);
  apiKeys.value.push(created);
  newKeyForm.value = { provider: 'openai', key: '', model: 'gpt-4o' };
}

async function handleDeleteKey(id: string) {
  await configApi.deleteApiKey(id);
  apiKeys.value = apiKeys.value.filter((k) => k.id !== id);
}

async function handleAddPrompt() {
  if (!newPromptForm.value.name.trim() || !newPromptForm.value.systemPrompt.trim()) return;
  const created = await configApi.createPrompt(newPromptForm.value);
  prompts.value.push(created);
  newPromptForm.value = { name: '', description: '', systemPrompt: '' };
}
</script>

<template>
  <div class="settings-view">
    <h2>设置</h2>

    <section class="section">
      <h3>API Key 配置</h3>
      <div v-for="key in apiKeys" :key="key.id" class="item-row">
        <span>{{ key.provider }} / {{ key.model }}</span>
        <button class="danger" @click="handleDeleteKey(key.id)">删除</button>
      </div>
      <div class="form-row">
        <select v-model="newKeyForm.provider">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
        <input v-model="newKeyForm.key" placeholder="sk-..." />
        <input v-model="newKeyForm.model" placeholder="gpt-4o" style="width: 120px" />
        <button @click="handleAddKey">添加</button>
      </div>
    </section>
    <!-- ... -->
  </div>
</template>
```

### 修改后代码

```vue
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { configApi } from '@/api/config';

interface LLMProvider {
  id: string;
  name: string;
  models: string[];
}

const apiKeys = ref<any[]>([]);
const prompts = ref<any[]>([]);
const providers = ref<LLMProvider[]>([]);
const llmConfig = ref<{ keyId: string; provider: string; model: string } | null>(null);

const newKeyForm = ref({ provider: 'openai', key: '', model: 'gpt-4o' });
const newPromptForm = ref({ name: '', description: '', systemPrompt: '' });

// 测试连接状态
const testingKey = ref<string | null>(null);
const testResult = ref<{ success: boolean; message: string } | null>(null);

// 模型列表根据选择的 Provider 动态变化
const currentModels = computed(() => {
  const provider = providers.value.find((p) => p.id === newKeyForm.value.provider);
  return provider?.models || [];
});

onMounted(async () => {
  const config = await configApi.getConfig();
  const [providerList, activeConfig] = await Promise.all([
    configApi.listProviders(),
    configApi.getActiveLLMConfig(),
  ]);
  apiKeys.value = config.apiKeys;
  prompts.value = config.prompts;
  providers.value = providerList;
  llmConfig.value = activeConfig;

  // 默认选中第一个 Provider
  if (providerList.length > 0 && !newKeyForm.value.model) {
    newKeyForm.value.provider = providerList[0].id;
    newKeyForm.value.model = providerList[0].models[0];
  }
});

async function handleAddKey() {
  if (!newKeyForm.value.key.trim()) return;
  const created = await configApi.createApiKey(newKeyForm.value);
  apiKeys.value.push(created);
  // 自动设为默认
  await handleSetDefault(created.id);
  newKeyForm.value = { provider: 'openai', key: '', model: 'gpt-4o' };
}

async function handleDeleteKey(id: string) {
  await configApi.deleteApiKey(id);
  apiKeys.value = apiKeys.value.filter((k) => k.id !== id);
  // 如果删除的是当前默认，需要刷新配置
  if (llmConfig.value?.keyId === id) {
    llmConfig.value = await configApi.getActiveLLMConfig();
  }
}

async function handleSetDefault(keyId: string) {
  await configApi.setActiveKey(keyId);
  llmConfig.value = await configApi.getActiveLLMConfig();
}

async function handleTestConnection() {
  testingKey.value = 'new';
  testResult.value = null;
  try {
    const result = await configApi.testConnection(newKeyForm.value);
    testResult.value = result;
  } catch (error) {
    testResult.value = { success: false, message: (error as Error).message };
  } finally {
    testingKey.value = null;
  }
}

async function handleAddPrompt() {
  if (!newPromptForm.value.name.trim() || !newPromptForm.value.systemPrompt.trim()) return;
  const created = await configApi.createPrompt(newPromptForm.value);
  prompts.value.push(created);
  newPromptForm.value = { name: '', description: '', systemPrompt: '' };
}

function isDefaultKey(keyId: string) {
  return llmConfig.value?.keyId === keyId;
}
</script>

<template>
  <div class="settings-view">
    <h2>设置</h2>

    <!-- API Key 配置 -->
    <section class="section">
      <h3>API Key 配置</h3>

      <!-- 已配置的 Key 列表 -->
      <div class="api-keys-list">
        <div
          v-for="key in apiKeys"
          :key="key.id"
          class="api-key-item"
          :class="{ active: isDefaultKey(key.id) }"
        >
          <div class="key-info">
            <span class="provider-badge" :class="key.provider">
              {{ key.provider === 'openai' ? '🤖' : '🧠' }}
            </span>
            <span class="key-detail">
              <strong>{{ key.provider === 'openai' ? 'OpenAI' : 'Claude' }}</strong>
              / {{ key.model }}
            </span>
          </div>
          <div class="key-actions">
            <span v-if="isDefaultKey(key.id)" class="active-badge">使用中</span>
            <button v-else @click="handleSetDefault(key.id)">设为默认</button>
            <button class="danger" @click="handleDeleteKey(key.id)">删除</button>
          </div>
        </div>

        <div v-if="apiKeys.length === 0" class="empty-hint">
          暂无配置的 API Key，请添加
        </div>
      </div>

      <!-- 添加新 Key 表单 -->
      <div class="add-key-form">
        <h4>添加新的 API Key</h4>
        <div class="form-row">
          <select v-model="newKeyForm.provider" @change="newKeyForm.model = providers.find(p => p.id === newKeyForm.provider)?.models[0] || ''">
            <option v-for="p in providers" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
          <select v-model="newKeyForm.model">
            <option v-for="m in currentModels" :key="m" :value="m">
              {{ m }}
            </option>
          </select>
        </div>
        <div class="form-row">
          <input
            v-model="newKeyForm.key"
            placeholder="输入 API Key (sk-...)"
            class="key-input"
          />
          <button @click="handleTestConnection" :disabled="testingKey !== null || !newKeyForm.key">
            {{ testingKey === 'new' ? '测试中...' : '测试连接' }}
          </button>
          <button @click="handleAddKey" :disabled="!newKeyForm.key">
            添加
          </button>
        </div>

        <!-- 测试结果 -->
        <div v-if="testResult" class="test-result" :class="{ success: testResult.success, error: !testResult.success }">
          {{ testResult.success ? '✅ 连接成功！' : `❌ 连接失败: ${testResult.message}` }}
        </div>
      </div>
    </section>

    <!-- Prompt 模板 -->
    <section class="section">
      <h3>Prompt 模板</h3>
      <div v-for="p in prompts" :key="p.id" class="item-row">
        <span>{{ p.name }}</span>
        <button class="danger" @click="configApi.deletePrompt(p.id); prompts = prompts.filter(x => x.id !== p.id)">
          删除
        </button>
      </div>
      <div class="form-column">
        <input v-model="newPromptForm.name" placeholder="模板名称" />
        <input v-model="newPromptForm.description" placeholder="描述（可选）" />
        <textarea
          v-model="newPromptForm.systemPrompt"
          placeholder="System Prompt..."
          rows="4"
        />
        <button @click="handleAddPrompt">保存</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-view {
  padding: 24px;
  max-width: 640px;
}
h2 {
  margin-bottom: 24px;
  font-size: 20px;
}
.section {
  margin-bottom: 32px;
}
.section h3 {
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--color-text-secondary, #666);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* API Key 列表 */
.api-keys-list {
  margin-bottom: 16px;
}
.api-key-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  margin-bottom: 8px;
  background: var(--color-bg-surface, #fff);
}
.api-key-item.active {
  border-color: var(--color-primary, #4f46e5);
  background: rgba(79, 70, 229, 0.05);
}
.key-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.provider-badge {
  font-size: 18px;
}
.key-detail strong {
  font-weight: 500;
}
.key-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.active-badge {
  color: var(--color-primary, #4f46e5);
  font-size: 12px;
  font-weight: 500;
}
.empty-hint {
  padding: 16px;
  text-align: center;
  color: #999;
  border: 1px dashed #ddd;
  border-radius: 8px;
}

/* 添加表单 */
.add-key-form {
  padding: 16px;
  background: var(--color-bg-surface, #f9f9f9);
  border-radius: 8px;
}
.add-key-form h4 {
  margin-bottom: 12px;
  font-size: 14px;
  color: #666;
}
.form-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.form-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.key-input {
  flex: 1;
  min-width: 200px;
}
.test-result {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
}
.test-result.success {
  background: #dcfce7;
  color: #166534;
}
.test-result.error {
  background: #fee2e2;
  color: #991b1b;
}

/* 通用样式 */
.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}
input,
select,
textarea {
  padding: 8px 12px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 6px;
  background: var(--color-bg-surface, #fff);
  color: var(--color-text, #1a1a1a);
  font-size: 14px;
}
textarea {
  resize: vertical;
}
button {
  padding: 8px 16px;
  background: var(--color-primary, #4f46e5);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
button.danger {
  background: #dc2626;
}
button:hover:not(:disabled) {
  opacity: 0.9;
}
</style>
```

### 操作步骤

1. 打开 `src/views/SettingsView.vue`
2. 替换整个 `<script setup>` 部分
3. 替换整个 `<template>` 部分
4. 替换整个 `<style>` 部分
5. 保存文件

---

## 步骤 9：修改 main.ts 注册 Handler

### 目标
修改 `main.ts`，传递 `core` 参数给 `registerConfigHandlers`。

### 文件位置
```
electron/main.ts
```

### 当前代码（第 36-39 行）

```typescript
if (core) {
  registerChatHandlers(ipcMain, core, mainWindow);
  registerConfigHandlers(ipcMain, core.getStorage());  // ← 没有传 core
}
```

### 修改后代码

```typescript
if (core) {
  registerChatHandlers(ipcMain, core, mainWindow);
  registerConfigHandlers(ipcMain, core.getStorage(), core);  // ← 添加 core 参数
}
```

### 操作步骤

1. 打开 `electron/main.ts`
2. 找到 `registerConfigHandlers` 调用
3. 添加第三个参数 `core`
4. 保存文件

---

## 步骤 10：添加依赖

### 目标
安装 `@anthropic-ai/sdk` 包。

### 操作步骤

1. 打开终端
2. 进入项目目录：
   ```bash
   cd d:\XMU\3UP\交互设计\codeGithub\easy-agent
   ```
3. 安装依赖：
   ```bash
   npm install @anthropic-ai/sdk
   ```

或者在 `package.json` 中添加：
```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.52.0"
  }
}
```

然后运行 `npm install`。

---

## 测试验证

### 1. 编译检查

```bash
npm run dev
```

检查是否有编译错误。

### 2. 功能测试

1. **添加 OpenAI Key**
   - 打开设置页面
   - 选择 Provider = OpenAI
   - 选择 Model = gpt-4o
   - 输入 API Key
   - 点击「测试连接」- 应该显示「连接成功」
   - 点击「添加」

2. **添加 Claude Key**
   - 同样方式添加 Claude Key
   - 添加后在列表中显示

3. **切换默认**
   - 点击某个 Key 的「设为默认」
   - 确认显示「使用中」

4. **聊天测试**
   - 切换到聊天页面
   - 发送消息
   - 确认能收到响应

5. **删除 Key**
   - 点击「删除」
   - 确认从列表中移除

---

## 完整文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `electron/core/adapters/llm/claude.adapter.ts` | Claude 模型适配器 |
| `electron/core/application/LLMManager.ts` | LLM 适配器管理器（工厂模式） |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `electron/core/index.ts` | 使用 LLMManager 替代硬编码 |
| `electron/ipc/config.handler.ts` | 添加 LLM 相关 IPC handlers |
| `electron/preload.ts` | 暴露新的 API |
| `electron/main.ts` | 传递 core 参数 |
| `src/api/config.ts` | 添加前端 API 封装 |
| `src/stores/agent.ts` | 添加 LLM 配置状态 |
| `src/views/SettingsView.vue` | 增强 UI 功能 |
| `package.json` | 添加 `@anthropic-ai/sdk` 依赖 |

---

## 顺序执行清单

按以下顺序执行：

1. ☐ 步骤 1：新增 `claude.adapter.ts`
2. ☐ 步骤 2：新增 `LLMManager.ts`
3. ☐ 步骤 3：修改 `index.ts`
4. ☐ 步骤 4：修改 `config.handler.ts`
5. ☐ 步骤 5：修改 `preload.ts`
6. ☐ 步骤 6：修改 `src/api/config.ts`
7. ☐ 步骤 7：修改 `src/stores/agent.ts`
8. ☐ 步骤 8：修改 `SettingsView.vue`
9. ☐ 步骤 9：修改 `main.ts`
10. ☐ 步骤 10：安装依赖
11. ☐ 测试验证
