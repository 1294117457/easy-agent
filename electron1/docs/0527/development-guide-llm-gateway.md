# 模型网关与 API Key 配置 - MVP 开发设计文档

## 1. 概述

### 1.1 目标
实现模型网关的 MVP 版本，支持多 Provider（OpenAI、Claude）的 API Key 配置管理和对话功能。

### 1.2 范围
- 定义 `ILLMAdapter` 接口抽象
- 实现 `OpenAIAdapter`（已有）和 `ClaudeAdapter`
- 支持前端配置多个 API Key 并切换使用
- 支持对话功能（发送消息、接收流式响应）

### 1.3 非范围
- 模型路由器（Router）- 单用户场景不需要
- 多租户隔离
- 限流和配额管理

---

## 2. 当前架构分析

### 2.1 现有代码结构

```
electron/
├── core/
│   ├── index.ts                    # EasyAgentCore 入口
│   ├── ports/
│   │   └── llm.port.ts             # ILLMPort 接口（已有）
│   ├── adapters/
│   │   ├── llm/
│   │   │   └── openai.adapter.ts   # OpenAIAdapter（已有）
│   │   └── storage/
│   │       └── sqlite.adapter.ts    # SQLiteAdapter
│   ├── domain/
│   │   └── types.ts                # 类型定义
│   └── application/
│       └── AgentService.ts         # Agent 服务
├── ipc/
│   ├── chat.handler.ts             # 聊天 IPC 处理
│   └── config.handler.ts           # 配置 IPC 处理
├── preload.ts                      # Context Bridge
└── main.ts                         # Electron 主进程
```

### 2.2 现有实现

| 模块 | 状态 | 说明 |
|------|------|------|
| `ILLMPort` | ✅ 已有 | 接口已定义 |
| `OpenAIAdapter` | ✅ 已有 | 只支持 OpenAI |
| `EasyAgentCore` | ⚠️ 部分 | 硬编码使用 OpenAI |
| SQLite `api_keys` 表 | ✅ 已有 | 存储 API Key |
| IPC Handler | ✅ 已有 | 基本的 CRUD |
| 前端配置页面 | ❌ 缺失 | 需要新建 |

### 2.3 现有数据模型

```typescript
// electron/core/domain/types.ts
interface ApiKey {
  id: string;
  provider: 'openai' | 'anthropic';
  model: string;
  enabled: boolean;
}
```

```sql
-- SQLite schema
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,      -- 'openai' | 'anthropic'
    encrypted_key TEXT NOT NULL,
    model TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

---

## 3. 设计方案

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Renderer)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ ChatView    │  │SettingsView │  │   Stores    │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                │                │                      │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐          │
│  │ chatApi     │  │ configApi   │  │ llmStore    │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         └─────────────────┼─────────────────┘                   │
└───────────────────────────┼─────────────────────────────────────┘
                            │ IPC
┌───────────────────────────▼─────────────────────────────────────┐
│                    Preload Bridge                               │
│              window.electronAPI (contextBridge)                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     Electron Main Process                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  IPC Handlers                                            │   │
│  │  chat.handler.ts  ──→  config.handler.ts  ──→  llm.handler.ts │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  EasyAgentCore                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │ LLM Manager │  │AgentService │  │StoragePort  │     │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │   │
│  └─────────┼─────────────────┼─────────────────┼─────────────┘   │
│  ┌─────────▼─────────────────▼─────────────────▼─────────────┐   │
│  │  LLM Adapters (六边形边缘)                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │ OpenAI      │  │ Claude      │  │ 更多...     │      │   │
│  │  │ Adapter     │  │ Adapter     │  │             │      │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 核心变更

#### 3.2.1 新增 `LLMManager` 模块

```typescript
// electron/core/application/LLMManager.ts
export class LLMManager {
  private adapters: Map<string, ILLMPort> = new Map();
  private activeAdapter: ILLMPort | null = null;

  registerAdapter(key: ApiKey, decryptedKey: string): void;
  setActiveAdapter(keyId: string): void;
  getActiveAdapter(): ILLMPort | null;
  removeAdapter(keyId: string): void;
  hasAdapter(keyId: string): boolean;
}
```

#### 3.2.2 新增 `ClaudeAdapter`

```typescript
// electron/core/adapters/llm/claude.adapter.ts
export class ClaudeAdapter implements ILLMPort {
  readonly provider = 'anthropic';
  model: string;
  private client: Anthropic;

  constructor(model: string, apiKey: string);
  async invoke(messages: BaseMessage[]): Promise<LLMResponse>;
  async invokeStream(messages: BaseMessage[], onChunk: (chunk: string) => void): Promise<LLMResponse>;
}
```

#### 3.2.3 重构 `EasyAgentCore`

```typescript
// electron/core/index.ts (变更后)
export class EasyAgentCore {
  private storagePort: IStoragePort;
  private llmManager: LLMManager;
  private agentService: AgentService;

  constructor(storage: IStoragePort);

  // 新增方法
  getLLMManager(): LLMManager;
  reloadLLM(keyId: string): void;

  // 现有方法
  sendMessage(conversationId: string, userInput: string, callbacks: Callbacks): void;
  getStorage(): IStoragePort;
}
```

---

## 4. 接口定义

### 4.1 `ILLMPort` 接口（现有，扩展）

```typescript
// electron/core/ports/llm.port.ts

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ILLMPort {
  /** 提供商名称: 'openai' | 'anthropic' */
  readonly provider: string;
  /** 模型名称 */
  readonly model: string;
  /** 同步调用（非流式） */
  invoke(messages: BaseMessage[]): Promise<LLMResponse>;
  /** 流式调用 */
  invokeStream(messages: BaseMessage[], onChunk: (chunk: string) => void): Promise<LLMResponse>;
}
```

### 4.2 `LLMManager` 接口

```typescript
// electron/core/application/LLMManager.ts

export interface LLMConfig {
  keyId: string;
  provider: 'openai' | 'anthropic';
  model: string;
  decryptedKey: string;
}

export class LLMManager {
  /** 注册/更新一个 LLM Adapter */
  registerAdapter(config: LLMConfig): void;

  /** 设置当前使用的 API Key */
  setActiveKey(keyId: string): void;

  /** 获取当前使用的 Adapter */
  getActiveAdapter(): ILLMPort | null;

  /** 获取当前配置 */
  getActiveConfig(): { keyId: string; provider: string; model: string } | null;

  /** 移除一个 Adapter */
  removeAdapter(keyId: string): void;

  /** 获取已注册的所有 Adapter 信息 */
  listAdapters(): Array<{ keyId: string; provider: string; model: string }>;
}
```

### 4.3 IPC 接口（扩展 preload）

```typescript
// electron/preload.ts (新增)

interface ElectronAPI {
  // 现有...
  ping(): string;
  getConfig(): Promise<Config>;
  createApiKey(data: CreateApiKeyDTO): Promise<ApiKey>;
  deleteApiKey(id: string): Promise<boolean>;
  // ...

  // 新增
  setActiveKey(keyId: string): Promise<void>;           // 设置当前使用的 Key
  getActiveLLMConfig(): Promise<LLMConfig | null>;       // 获取当前 LLM 配置
  listLLMProviders(): Promise<LLMProvider[]>;           // 获取支持的 Provider 列表
  testConnection(data: TestConnectionDTO): Promise<boolean>;  // 测试连接
}

interface LLMProvider {
  id: string;        // 'openai' | 'anthropic'
  name: string;      // 'OpenAI' | 'Claude'
  models: string[];  // ['gpt-4o', 'gpt-4o-mini', ...]
}

interface TestConnectionDTO {
  provider: string;
  apiKey: string;
  model: string;
}
```

---

## 5. 数据库变更

### 5.1 现有 Schema（无需变更）

`api_keys` 表已支持多 Provider，`provider` 字段可存储 `'openai'` 或 `'anthropic'`。

### 5.2 建议新增表（可选，当前 MVP 可省略）

```sql
-- LLM 配置表（存储默认/上次使用的配置）
CREATE TABLE IF NOT EXISTS llm_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    active_key_id TEXT REFERENCES api_keys(id),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

---

## 6. 前端变更

### 6.1 新增文件

| 文件 | 说明 |
|------|------|
| `src/stores/llm.ts` | LLM 配置状态管理（Pinia） |
| `src/views/SettingsView.vue`（扩展） | 添加 API Key 管理 UI |
| `src/api/llm.ts` | LLM 相关 API 调用封装 |

### 6.2 `src/stores/llm.ts`

```typescript
// src/stores/llm.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { llmApi } from '@/api/llm';

export const useLLMStore = defineStore('llm', () => {
  const providers = ref<LLMProvider[]>([]);
  const activeConfig = ref<LLMConfig | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const currentProvider = computed(() =>
    providers.value.find(p => p.id === activeConfig.value?.provider)
  );

  async function loadConfig() {
    isLoading.value = true;
    error.value = null;
    try {
      const [providerList, config] = await Promise.all([
        llmApi.listProviders(),
        llmApi.getActiveConfig(),
      ]);
      providers.value = providerList;
      activeConfig.value = config;
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      isLoading.value = false;
    }
  }

  async function setActiveKey(keyId: string) {
    await llmApi.setActiveKey(keyId);
    await loadConfig();
  }

  async function testConnection(data: TestConnectionDTO) {
    return await llmApi.testConnection(data);
  }

  return { providers, activeConfig, currentProvider, isLoading, error, loadConfig, setActiveKey, testConnection };
});
```

### 6.3 `src/api/llm.ts`

```typescript
// src/api/llm.ts
export const llmApi = {
  setActiveKey: (keyId: string) =>
    window.electronAPI.setActiveKey(keyId),

  getActiveConfig: () =>
    window.electronAPI.getActiveLLMConfig(),

  listProviders: () =>
    window.electronAPI.listLLMProviders(),

  testConnection: (data: TestConnectionDTO) =>
    window.electronAPI.testConnection(data),
};
```

### 6.4 设置页面 UI 设计

```
┌─────────────────────────────────────────────────────────────┐
│  设置                                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔑 API Keys                                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ + 添加 API Key                                        │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ ● OpenAI - gpt-4o                    [使用中] [删除] │  │
│  │ ○ Claude - claude-sonnet-4-20250514    [设为默认]     │  │
│  │ ○ OpenAI - gpt-4o-mini                  [设为默认]   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  模型配置                                                   │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Provider: [OpenAI ▼]                                 │  │
│  │ Model:   [gpt-4o ▼]                                 │  │
│  │ API Key: [••••••••••••••••••••] [测试连接]          │  │
│  │                      [保存配置]                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 后端变更

### 7.1 新增文件

| 文件 | 说明 |
|------|------|
| `electron/core/application/LLMManager.ts` | LLM 管理器 |
| `electron/core/adapters/llm/claude.adapter.ts` | Claude 适配器 |
| `electron/ipc/llm.handler.ts` | LLM IPC 处理器 |

### 7.2 `electron/core/adapters/llm/claude.adapter.ts`

```typescript
// Claude Adapter 实现
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
      messages: toClaudeFormat(messages),
    });
    return {
      content: response.content[0].type === 'text' ? response.content[0].text : '',
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
      messages: toClaudeFormat(messages),
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
}

function toClaudeFormat(messages: BaseMessage[]): AnthropicMessage[] {
  return messages.map(m => ({
    role: m LC _getType() === 'human' ? 'user' : 'assistant',
    content: m.content as string,
  }));
}
```

### 7.3 `electron/core/application/LLMManager.ts`

```typescript
// LLM Manager 实现
import type { ILLMPort } from '../ports/llm.port.js';
import { OpenAIAdapter } from '../adapters/llm/openai.adapter.js';
import { ClaudeAdapter } from '../adapters/llm/claude.adapter.js';

export interface LLMConfig {
  keyId: string;
  provider: 'openai' | 'anthropic';
  model: string;
  decryptedKey: string;
}

export class LLMManager {
  private adapters: Map<string, ILLMPort> = new Map();
  private activeKeyId: string | null = null;

  registerAdapter(config: LLMConfig): void {
    const adapter = this.createAdapter(config);
    this.adapters.set(config.keyId, adapter);
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

  getActiveConfig(): { keyId: string; provider: string; model: string } | null {
    if (!this.activeKeyId) return null;
    const adapter = this.adapters.get(this.activeKeyId)!;
    return {
      keyId: this.activeKeyId,
      provider: adapter.provider,
      model: adapter.model,
    };
  }

  removeAdapter(keyId: string): void {
    this.adapters.delete(keyId);
    if (this.activeKeyId === keyId) {
      this.activeKeyId = this.adapters.keys().next().value || null;
    }
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

### 7.4 `electron/ipc/llm.handler.ts`

```typescript
// LLM IPC Handler
import type { IpcMain } from 'electron';
import type { EasyAgentCore } from '../core/index.js';

export function registerLLMHandlers(ipcMain: IpcMain, core: EasyAgentCore) {
  ipcMain.handle('llm:setActiveKey', (_, keyId: string) => {
    core.getLLMManager().setActiveKey(keyId);
  });

  ipcMain.handle('llm:getActiveConfig', () => {
    return core.getLLMManager().getActiveConfig();
  });

  ipcMain.handle('llm:listProviders', () => {
    return [
      { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
      { id: 'anthropic', name: 'Claude', models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-3-20250714'] },
    ];
  });

  ipcMain.handle('llm:testConnection', async (_, data: TestConnectionDTO) => {
    try {
      // 创建临时 Adapter 测试连接
      const temp = data.provider === 'openai'
        ? new (await import('../core/adapters/llm/openai.adapter.js')).OpenAIAdapter(data.model, data.apiKey)
        : new (await import('../core/adapters/llm/claude.adapter.js')).ClaudeAdapter(data.model, data.apiKey);

      await temp.invoke([{ _getType: () => 'human', content: 'test', additional_kwargs: {}, name: '' } as any]);
      return true;
    } catch {
      return false;
    }
  });
}
```

### 7.5 `electron/main.ts` 变更

```typescript
// main.ts 新增注册
import { registerLLMHandlers } from './ipc/llm.handler.js';

app.whenReady().then(async () => {
  const storage = new SQLiteAdapter(getDbPath(), 'easy-agent-master-key');
  core = new EasyAgentCore(storage);

  // 注册 IPC Handlers
  registerChatHandlers(ipcMain, core, mainWindow);
  registerConfigHandlers(ipcMain, core.getStorage());
  registerLLMHandlers(ipcMain, core);  // 新增

  await createWindow();
});
```

---

## 8. preload.ts 更新

```typescript
// electron/preload.ts 新增方法

// 新增 LLM 相关
setActiveKey: (keyId: string) =>
  ipcRenderer.invoke('llm:setActiveKey', keyId),

getActiveLLMConfig: () =>
  ipcRenderer.invoke('llm:getActiveConfig'),

listLLMProviders: () =>
  ipcRenderer.invoke('llm:listProviders'),

testConnection: (data: { provider: string; apiKey: string; model: string }) =>
  ipcRenderer.invoke('llm:testConnection', data),
```

---

## 9. 文件变更清单

### 新增文件

```
electron/
├── core/
│   ├── application/
│   │   └── LLMManager.ts          # [新增] LLM 管理器
│   └── adapters/
│       └── llm/
│           └── claude.adapter.ts  # [新增] Claude 适配器
└── ipc/
    └── llm.handler.ts             # [新增] LLM IPC 处理器

src/
├── stores/
│   └── llm.ts                     # [新增] LLM 状态管理
└── api/
    └── llm.ts                     # [新增] LLM API 封装
```

### 修改文件

```
electron/
├── preload.ts                     # [修改] 新增 LLM 相关方法
├── main.ts                        # [修改] 注册 LLM Handlers
└── core/
    └── index.ts                   # [修改] 集成 LLMManager

src/
└── types/
    └── electron.d.ts              # [修改] 新增类型定义
```

---

## 10. 测试计划

### 10.1 单元测试

| 测试项 | 说明 |
|--------|------|
| `ClaudeAdapter.invoke()` | 测试同步调用 |
| `ClaudeAdapter.invokeStream()` | 测试流式调用 |
| `LLMManager.registerAdapter()` | 测试注册多个 Adapter |
| `LLMManager.setActiveKey()` | 测试切换 Adapter |

### 10.2 集成测试

| 测试项 | 说明 |
|--------|------|
| 添加 OpenAI Key → 发送消息 | 验证流式响应 |
| 添加 Claude Key → 设为默认 → 发送消息 | 验证 Claude 响应 |
| 切换 Key → 发送消息 | 验证切换生效 |
| 删除 Key → 验证自动切换 | 验证异常处理 |

### 10.3 手动测试场景

1. 首次启动，无 Key → 提示配置
2. 添加 OpenAI Key → 测试连接 → 保存 → 发送消息
3. 添加 Claude Key → 设为默认 → 发送消息
4. 切换默认 Key → 发送消息 → 验证不同模型响应

---

## 11. 后续迭代

### MVP 完成后可添加

1. **流式 Token 计数** - 显示当前消耗 Token 数
2. **模型参数配置** - temperature、max_tokens 等
3. **历史模型切换** - 查看每条消息使用的模型
4. **更多 Provider** - Google Gemini、Azure OpenAI 等
5. **成本统计** - 按模型统计使用量和费用

---

## 12. 依赖

```json
// package.json 新增依赖
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.52.0"
  }
}
```
