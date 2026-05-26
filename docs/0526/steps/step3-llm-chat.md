# Step 3: LLM 对话

> 版本: v0.1.0 MVP
> 日期: 2026-05-26
> 前置：Step 2 Storage 已完成
> 目标：能调用 OpenAI API，AI 能回复

---

## 1. 安装依赖

```bash
cd electron

npm install @langchain/langgraph @langchain/core @langchain/openai
```

## 2. 创建 ports/llm.port.ts

```typescript
// electron/core/ports/llm.port.ts
import type { BaseMessage } from '@langchain/core/messages';

// LLM 返回结果
export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// LLM 端口接口
export interface ILLMPort {
  readonly provider: string;
  readonly model: string;

  // 普通调用
  invoke(messages: BaseMessage[]): Promise<LLMResponse>;

  // 流式调用
  invokeStream(
    messages: BaseMessage[],
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse>;
}
```

## 3. 创建 adapters/http/openai.adapter.ts

```typescript
// electron/core/adapters/http/openai.adapter.ts
import { ChatOpenAI } from '@langchain/openai';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort, LLMResponse } from '../../../ports/llm.port.js';

export class OpenAIAdapter implements ILLMPort {
  readonly provider = 'openai';
  model: string;
  private llm: ChatOpenAI;

  constructor(model: string, apiKey: string) {
    this.model = model;
    this.llm = new ChatOpenAI({
      model,
      apiKey,
      temperature: 0,
      streaming: true,
    });
  }

  async invoke(messages: BaseMessage[]): Promise<LLMResponse> {
    const result = await this.llm.invoke(messages);
    return { content: result.content as string };
  }

  async invokeStream(
    messages: BaseMessage[],
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    const stream = await this.llm.stream(messages);
    let full = '';
    for await (const chunk of stream) {
      full += chunk.content;
      onChunk(chunk.content as string);
    }
    return { content: full };
  }
}
```

## 4. 创建 application/AgentService.ts

```typescript
// electron/core/application/AgentService.ts
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort } from '../ports/llm.port.js';
import type { IStoragePort } from '../ports/storage.port.js';

export interface SendMessageCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export class AgentService {
  constructor(
    private llmPort: ILLMPort,
    private storagePort: IStoragePort
  ) {}

  async sendMessage(
    conversationId: string,
    userInput: string,
    callbacks: SendMessageCallbacks
  ) {
    // 1. 保存用户消息
    this.storagePort.appendMessage({
      conversationId,
      role: 'user',
      content: userInput,
    });

    // 2. 加载对话历史
    const history = this.storagePort.getMessages(conversationId);
    const langchainMessages: BaseMessage[] = history.map((m) =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    );

    // 3. 获取 System Prompt（如果有）
    const prompts = this.storagePort.listPrompts();
    const systemPrompt = prompts[0]?.systemPrompt || '你是 EasyAgent，智能助手。';
    const allMessages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...langchainMessages,
      new HumanMessage(userInput),
    ];

    // 4. 调用 LLM
    try {
      const result = await this.llmPort.invokeStream(
        allMessages,
        callbacks.onToken
      );

      // 5. 保存 AI 回复
      this.storagePort.appendMessage({
        conversationId,
        role: 'assistant',
        content: result.content,
        model: this.llmPort.model,
      });

      callbacks.onDone();
    } catch (err: any) {
      callbacks.onError(err.message);
    }
  }
}
```

## 5. 更新 core/index.ts

```typescript
// electron/core/index.ts
import type { ILLMPort } from './ports/llm.port.js';
import type { IStoragePort } from './ports/storage.port.js';
import { AgentService } from './application/AgentService.js';
import { OpenAIAdapter } from './adapters/http/openai.adapter.js';

export class EasyAgentCore {
  private llmPort: ILLMPort;
  private storagePort: IStoragePort;
  private agentService: AgentService;

  constructor(storagePort: IStoragePort) {
    this.storagePort = storagePort;

    // 从 Storage 获取 API Key 并初始化 LLM
    const keys = this.storagePort.listApiKeys();
    const activeKey = keys.find((k) => k.enabled) || keys[0];

    if (!activeKey) {
      throw new Error('请先配置 API Key');
    }

    const decryptedKey = this.storagePort.getDecryptedKey(activeKey.id);
    if (!decryptedKey) {
      throw new Error('API Key 解密失败');
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

  getLLM(): ILLMPort {
    return this.llmPort;
  }
}

export type { ILLMPort, LLMResponse } from './ports/llm.port.js';
export type { IStoragePort } from './ports/storage.port.js';
export type { SendMessageCallbacks } from './application/AgentService.js';
export * from './domain/types.js';
```

## 6. 更新 main.ts

```typescript
// electron/main.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { EasyAgentCore } from './core/index.js';
import { SQLiteAdapter } from './core/adapters/storage/sqlite.adapter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow;
let core: EasyAgentCore;

function getDbPath() {
  const base = app.getPath('userData');
  return path.join(base, 'data', 'easy-agent.db');
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  // 初始化 Storage
  const storage = new SQLiteAdapter(getDbPath(), 'easy-agent-master-key');

  // 初始化 Core（此时会读取 API Key 并初始化 LLM）
  core = new EasyAgentCore(storage);

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 导出 core 供 IPC 使用（临时方案，后续用 IPC）
(globalThis as any).core = core;
```

## 7. 验证

### 先确保有 API Key

```javascript
// DevTools 中
const storage = core.getStorage();

// 如果没有，先添加
storage.createApiKey({
  provider: 'openai',
  key: 'sk-your-actual-api-key',  // 替换成真实 key
  model: 'gpt-4o'
});
```

### 测试对话

```javascript
// DevTools 中

// 收集 token
let response = '';
core.sendMessage(
  'test-conv-id',  // 随便一个 id
  '你好',
  {
    onToken: (token) => { response += token; console.log(token); },
    onDone: () => { console.log('\n完成！完整回复：', response); },
    onError: (err) => { console.error('错误：', err); }
  }
);
```

### 预期结果

```
控制台输出：
  你
  好
  ，
  我
  是
  ...

  完成！完整回复： 你好！有什么可以帮你的？
```

---

## 完成后检查清单

```
✅ @langchain/openai 已安装
✅ ports/llm.port.ts 已创建
✅ adapters/http/openai.adapter.ts 已创建
✅ application/AgentService.ts 已创建
✅ core/index.ts 已更新（组合 LLM + Storage + AgentService）
✅ main.ts 已更新（创建 EasyAgentCore）
✅ sendMessage 能调用 OpenAI
✅ 回调 onToken 能逐字收到回复
✅ 消息能保存到数据库
```

---

*文档版本: v0.1.0 | 最后更新: 2026-05-26*
