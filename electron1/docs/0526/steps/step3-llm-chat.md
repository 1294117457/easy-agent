# Step 3: LLM 对话

> 版本: v0.2.0 MVP
> 日期: 2026-05-26
> 前置：Step 2 Storage 已完成
> 目标：能调用 OpenAI API，AI 能回复
> 架构: electron-vite，文件位于 `electron/core/`

---

## 1. 安装依赖

```bash
npm install @langchain/langgraph @langchain/core @langchain/openai
```

---

## 2. 创建 ports/llm.port.ts

**`electron/core/ports/llm.port.ts`**：

```typescript
import type { BaseMessage } from '@langchain/core/messages';

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ILLMPort {
  readonly provider: string;
  readonly model: string;
  invoke(messages: BaseMessage[]): Promise<LLMResponse>;
  invokeStream(
    messages: BaseMessage[],
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse>;
}
```

---

## 3. 创建 adapters/llm/openai.adapter.ts

**`electron/core/adapters/llm/openai.adapter.ts`**：

```typescript
import { ChatOpenAI } from '@langchain/openai';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort, LLMResponse } from '../../ports/llm.port.js';

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

---

## 4. 创建 application/AgentService.ts

**`electron/core/application/AgentService.ts`**：

```typescript
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort } from '../../ports/llm.port.js';
import type { IStoragePort } from '../../ports/storage.port.js';

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
    this.storagePort.appendMessage({
      conversationId,
      role: 'user',
      content: userInput,
    });

    const history = this.storagePort.getMessages(conversationId);
    const langchainMessages: BaseMessage[] = history.map((m) =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    );

    const prompts = this.storagePort.listPrompts();
    const systemPrompt =
      prompts[0]?.systemPrompt || '你是 EasyAgent，智能助手。';
    const allMessages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      ...langchainMessages,
      new HumanMessage(userInput),
    ];

    try {
      const result = await this.llmPort.invokeStream(
        allMessages,
        callbacks.onToken
      );

      this.storagePort.appendMessage({
        conversationId,
        role: 'assistant',
        content: result.content,
        model: this.llmPort.model,
      });

      callbacks.onDone();
    } catch (err: unknown) {
      callbacks.onError(err instanceof Error ? err.message : String(err));
    }
  }
}
```

---

## 5. 更新 core/index.ts

**`electron/core/index.ts`**：

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

  reloadLLM(model: string, apiKey: string) {
    this.llmPort = new OpenAIAdapter(model, apiKey);
    this.agentService = new AgentService(this.llmPort, this.storagePort);
  }
}

export type { ILLMPort, LLMResponse } from './ports/llm.port.js';
export type { IStoragePort } from './ports/storage.port.js';
export type { SendMessageCallbacks } from './application/AgentService.js';
export * from './domain/types.js';
```

---

## 6. 验证

### 先确保有 API Key

```javascript
const storage = core.getStorage();
storage.createApiKey({
  provider: 'openai',
  key: 'sk-your-actual-api-key',  // 替换成真实 key
  model: 'gpt-4o'
});
```

### 测试对话

```javascript
let response = '';
core.sendMessage(
  'test-conv-id',
  '你好',
  {
    onToken: (token) => { response += token; process.stdout.write(token); },
    onDone: () => { console.log('\n完成！'); },
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
  ...

  完成！
```

---

## 完成后检查清单

```
✅ @langchain/openai 已安装
✅ electron/core/ports/llm.port.ts 已创建
✅ electron/core/adapters/llm/openai.adapter.ts 已创建
✅ electron/core/application/AgentService.ts 已创建
✅ electron/core/index.ts 已更新
✅ sendMessage 能调用 OpenAI
✅ 回调 onToken 能逐字收到回复
✅ 消息能保存到数据库
```

---

*文档版本: v0.2.0 | 最后更新: 2026-05-26*
