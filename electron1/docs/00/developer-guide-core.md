# EasyAgent 后端（Core）开发指南

> 版本: v0.2.0 MVP
> 日期: 2026-05-26
> 说明: 后端指 Electron Main Process 内的 Hexagonal Core
> 前置: 你有 Node.js/TS 后端经验，熟悉六边形架构概念
> 架构: electron-vite 单项目，Core 代码位于 `electron/core/`

---

## 0. 架构概览

```
easy-agent/
├── electron/                      # Electron 主进程源码
│   ├── main.ts                  # Electron 入口 + IPC 注册
│   ├── preload.ts               # Context Bridge（electron-vite 编译为 CJS）
│   ├── core/                     # 六边形架构核心
│   │   ├── index.ts             # 核心导出
│   │   ├── domain/               # 领域模型（纯业务，无外部依赖）
│   │   │   └── types.ts
│   │   ├── ports/                # 端口接口（定义核心需要什么能力）
│   │   │   ├── llm.port.ts
│   │   │   ├── storage.port.ts
│   │   │   └── mcp.port.ts
│   │   ├── adapters/             # 适配器实现（具体怎么做到）
│   │   │   ├── llm/
│   │   │   │   └── openai.adapter.ts
│   │   │   └── storage/
│   │   │       └── sqlite.adapter.ts
│   │   └── application/         # 应用逻辑（编排业务流程）
│   │       └── AgentService.ts
│   └── ipc/                      # IPC 处理器黏合层
│       ├── chat.handler.ts
│       └── config.handler.ts
│
├── src/                          # Electron 渲染进程（Vue 3 前端）
│   ├── main.ts
│   ├── App.vue
│   ├── components/
│   ├── views/
│   ├── stores/
│   └── api/
│
├── dist/                         # electron-vite 编译产物
│   ├── main/                     # 主进程 CJS
│   ├── preload/                   # preload CJS
│   └── renderer/                  # Vite 打包产物
│
├── index.html                    # 渲染进程 HTML 入口
├── electron.vite.config.ts        # electron-vite 配置
├── tsconfig.json                 # 项目引用配置
├── tsconfig.node.json            # 主进程/ preload TypeScript 配置
├── tsconfig.web.json             # 渲染进程 TypeScript 配置
└── package.json                  # 统一依赖（"type": "module"）
```

**与之前 packages 结构的根本差异**：

| 对比项 | 旧架构（packages/） | 新架构（electron-vite） |
|--------|-------------------|----------------------|
| 包管理 | 两个独立 `package.json` | 单一 `package.json` |
| 主进程入口 | `main.mjs`（纯 ESM JS） | `electron/main.ts`（TypeScript） |
| Preload | `preload.cjs`（纯 CJS JS） | `electron/preload.ts`（TypeScript） |
| 编译 | `tsc` + `esbuild` 分别运行 | `electron-vite build` 统一打包 |
| 开发模式 | 两个终端，分别运行 `npm run dev` | 一个命令 `electron-vite dev` |
| ESM 兼容性 | 需要手动处理 ESM/CJS 边界 | electron-vite 自动处理 |

---

## 1. 项目初始化

### 1.1 目录结构

```
electron/
├── main.ts                 # Electron 入口
├── preload.ts              # Preload 脚本
│
├── core/
│   ├── index.ts           # 核心导出
│   ├── domain/
│   │   └── types.ts
│   ├── ports/
│   │   ├── llm.port.ts
│   │   ├── storage.port.ts
│   │   └── mcp.port.ts
│   ├── adapters/
│   │   ├── llm/
│   │   │   └── openai.adapter.ts
│   │   └── storage/
│   │       └── sqlite.adapter.ts
│   └── application/
│       └── AgentService.ts
│
└── ipc/
    ├── chat.handler.ts
    └── config.handler.ts
```

### 1.2 安装依赖

```bash
npm install

# 核心依赖
npm install \
  @langchain/langgraph \
  @langchain/core \
  @langchain/openai \
  @modelcontextprotocol/sdk \
  better-sqlite3 \
  uuid

# 桌面端依赖
npm install electron

# 开发依赖
npm install -D \
  electron-vite \
  electron-builder \
  typescript \
  @types/node \
  @types/better-sqlite3 \
  @types/uuid
```

### 1.3 TypeScript 配置

**`tsconfig.node.json`**（主进程/preload）：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["electron.vite.config.ts", "electron/**/*.ts"]
}
```

---

## 2. 分步实现

### Step 1: 领域模型（domain/types.ts）

领域模型是**纯业务概念**，没有任何外部依赖（不 import 数据库、不 import SDK）。

**`electron/core/domain/types.ts`**：

```typescript
export type MessageRole = 'user' | 'assistant' | 'system';
export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
export type AgentStatus = 'idle' | 'thinking' | 'working' | 'happy' | 'error';
export type NodeType = 'input' | 'llm' | 'mcp_tool' | 'output' | 'condition';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  position: { x: number; y: number };
  config: NodeConfig;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  name: string;
  workflowId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  model?: string;
  createdAt: string;
}

export interface Prompt {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface McpServer {
  id: string;
  name: string;
  type: 'stdio' | 'sse';
  command?: string;
  url?: string;
  enabled: boolean;
}

export interface McpTool {
  id: string;
  serverId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  enabled: boolean;
}

export interface ApiKey {
  id: string;
  provider: string;
  model: string;
  enabled: boolean;
}
```

### Step 2: 端口定义（ports/）

**`electron/core/ports/storage.port.ts`**：

```typescript
import type { ApiKey, Conversation, Message, Prompt, McpServer, McpTool, Workflow } from '../domain/types.js';

export interface IStoragePort {
  createApiKey(data: { provider: string; key: string; model: string }): ApiKey;
  listApiKeys(): ApiKey[];
  getDecryptedKey(id: string): string | null;
  deleteApiKey(id: string): boolean;

  createConversation(data?: { name?: string }): Conversation;
  listConversations(): Conversation[];
  getMessages(convId: string): Message[];
  appendMessage(data: { conversationId: string; role: string; content: string; model?: string }): Message;
  deleteConversation(id: string): boolean;
  renameConversation(id: string, name: string): boolean;

  createPrompt(data: { name: string; description?: string; systemPrompt: string; isBuiltin?: boolean }): Prompt;
  listPrompts(): Prompt[];
  updatePrompt(id: string, data: Partial<Prompt>): boolean;
  deletePrompt(id: string): boolean;

  createWorkflow(data: { name: string; description?: string; nodes: unknown[]; edges: unknown[] }): Workflow;
  listWorkflows(): Workflow[];
  getWorkflow(id: string): Workflow | null;
  updateWorkflow(id: string, data: Partial<Workflow>): Workflow | null;
  deleteWorkflow(id: string): boolean;

  createMcpServer(data: Omit<McpServer, 'id'>): McpServer;
  listMcpServers(): McpServer[];
  deleteMcpServer(id: string): boolean;
  saveMcpTools(serverId: string, tools: McpTool[]): void;
  listMcpTools(serverId: string): McpTool[];
}
```

**`electron/core/ports/llm.port.ts`**：

```typescript
import type { BaseMessage } from '@langchain/core/messages';

export interface LLMResponse {
  content: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface ILLMPort {
  readonly provider: string;
  readonly model: string;
  invoke(messages: BaseMessage[]): Promise<LLMResponse>;
  invokeStream(messages: BaseMessage[], onChunk: (chunk: string) => void): Promise<LLMResponse>;
}
```

**`electron/core/ports/mcp.port.ts`**：

```typescript
import type { McpServer, McpTool } from '../domain/types.js';

export interface ToolCallEvent {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface IMcpPort {
  connect(server: McpServer): Promise<void>;
  disconnect(serverId: string): Promise<void>;
  isConnected(serverId: string): boolean;
  listTools(serverId: string): Promise<McpTool[]>;
  callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown>;
  onToolCall(callback: (event: ToolCallEvent) => void): void;
  onDisconnect(callback: (serverId: string) => void): void;
}
```

### Step 3: 适配器实现（adapters/）

#### 3.1 SQLite 适配器

**`electron/core/adapters/storage/sqlite.adapter.ts`**（完整实现见 `docs/0526/steps/step2-storage.md`）：

核心要点：
- 实现 `IStoragePort` 接口
- 使用 `better-sqlite3`（同步 API，Electron 主进程推荐）
- API Key 使用 AES-256-GCM + scrypt 密钥派生加密
- 建表语句在 `SCHEMA` 常量中，构造函数执行

#### 3.2 LLM 适配器

**`electron/core/adapters/llm/openai.adapter.ts`**：

```typescript
import { ChatOpenAI } from '@langchain/openai';
import type { ILLMPort, LLMResponse } from '../../ports/llm.port.js';

export class OpenAIAdapter implements ILLMPort {
  readonly provider = 'openai';
  model: string;
  private llm: ChatOpenAI;

  constructor(model: string, apiKey: string) {
    this.model = model;
    this.llm = new ChatOpenAI({ model, apiKey, temperature: 0, streaming: true });
  }

  async invoke(messages: any[]): Promise<LLMResponse> {
    const result = await this.llm.invoke(messages);
    return { content: result.content as string };
  }

  async invokeStream(messages: any[], onChunk: (chunk: string) => void): Promise<LLMResponse> {
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

### Step 4: 应用逻辑（application/AgentService.ts）

**`electron/core/application/AgentService.ts`**：

```typescript
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import type { ILLMPort } from '../../ports/llm.port.js';
import type { IStoragePort } from '../../ports/storage.port.js';

export interface SendMessageCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export class AgentService {
  constructor(private llmPort: ILLMPort, private storagePort: IStoragePort) {}

  async sendMessage(conversationId: string, userInput: string, callbacks: SendMessageCallbacks) {
    this.storagePort.appendMessage({ conversationId, role: 'user', content: userInput });

    const history = this.storagePort.getMessages(conversationId);
    const langchainMessages = history.map(m =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    );

    const prompts = this.storagePort.listPrompts();
    const systemPrompt = prompts[0]?.systemPrompt || '你是 EasyAgent，智能助手。';
    const allMessages = [new SystemMessage(systemPrompt), ...langchainMessages, new HumanMessage(userInput)];

    try {
      const result = await this.llmPort.invokeStream(allMessages, callbacks.onToken);
      this.storagePort.appendMessage({ conversationId, role: 'assistant', content: result.content, model: this.llmPort.model });
      callbacks.onDone();
    } catch (err: unknown) {
      callbacks.onError(err instanceof Error ? err.message : String(err));
    }
  }
}
```

### Step 5: 核心导出（core/index.ts）

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
    const activeKey = keys.find(k => k.enabled) || keys[0];
    if (!activeKey) {
      console.warn('No API Key configured.');
      this.llmPort = null as unknown as ILLMPort;
      this.agentService = null as unknown as AgentService;
      return;
    }
    const decryptedKey = this.storagePort.getDecryptedKey(activeKey.id);
    if (!decryptedKey) throw new Error('Failed to decrypt API Key');
    this.llmPort = new OpenAIAdapter(activeKey.model, decryptedKey);
    this.agentService = new AgentService(this.llmPort, this.storagePort);
  }

  sendMessage(conversationId: string, userInput: string, callbacks: Parameters<AgentService['sendMessage']>[2]) {
    return this.agentService.sendMessage(conversationId, userInput, callbacks);
  }

  getStorage(): IStoragePort { return this.storagePort; }

  reloadLLM(provider: string, model: string, apiKey: string) {
    this.llmPort = new OpenAIAdapter(model, apiKey);
    this.agentService = new AgentService(this.llmPort, this.storagePort);
  }
}

export type { ILLMPort, LLMResponse } from './ports/llm.port.js';
export type { IStoragePort } from './ports/storage.port.js';
export type { SendMessageCallbacks } from './application/AgentService.js';
export * from './domain/types.js';
```

### Step 6: IPC 处理器（ipc/）

IPC Handler 是**六边形架构外的黏合层**，把渲染进程的 IPC 调用翻译成核心的能力调用。

**`electron/ipc/chat.handler.ts`**：

```typescript
import type { IpcMain, BrowserWindow } from 'electron';
import type { EasyAgentCore } from '../core/index.js';

export function registerChatHandlers(ipcMain: IpcMain, core: EasyAgentCore, mainWindow: BrowserWindow) {
  ipcMain.handle('chat:send', async (_, conversationId: string, message: string) => {
    return new Promise<void>((resolve, reject) => {
      core.sendMessage(conversationId, message, {
        onToken: (token) => mainWindow.webContents.send('agent:token', token),
        onDone: () => { mainWindow.webContents.send('agent:done', null); resolve(); },
        onError: (error) => { mainWindow.webContents.send('agent:error', error); reject(new Error(error)); },
      });
    });
  });

  ipcMain.handle('chat:history', (_, conversationId) => core.getStorage().getMessages(conversationId));
  ipcMain.handle('chat:conversations', () => core.getStorage().listConversations());
  ipcMain.handle('chat:new', () => core.getStorage().createConversation({ name: '新对话' }));
  ipcMain.handle('chat:delete', (_, id) => core.getStorage().deleteConversation(id));
}
```

**`electron/ipc/config.handler.ts`**：

```typescript
import type { IpcMain } from 'electron';
import type { IStoragePort } from '../core/index.js';

export function registerConfigHandlers(ipcMain: IpcMain, storage: IStoragePort) {
  ipcMain.handle('config:get', () => ({ apiKeys: storage.listApiKeys(), prompts: storage.listPrompts() }));
  ipcMain.handle('config:apiKey:create', (_, data) => storage.createApiKey(data));
  ipcMain.handle('config:apiKey:delete', (_, id) => storage.deleteApiKey(id));
  ipcMain.handle('config:prompt:create', (_, data) => storage.createPrompt(data));
  ipcMain.handle('config:prompt:delete', (_, id) => storage.deletePrompt(id));
}
```

### Step 7: Electron 入口（electron/main.ts）

**`electron/main.ts`**：

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { EasyAgentCore } from './core/index.js';
import { SQLiteAdapter } from './core/adapters/storage/sqlite.adapter.js';
import { registerChatHandlers } from './ipc/chat.handler.js';
import { registerConfigHandlers } from './ipc/config.handler.js';

let mainWindow: BrowserWindow | null = null;
let core: EasyAgentCore | null = null;

function getDbPath(): string {
  return join(app.getPath('userData'), 'data', 'easy-agent.db');
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  if (core) {
    registerChatHandlers(ipcMain, core, mainWindow);
    registerConfigHandlers(ipcMain, core.getStorage());
  }
}

app.whenReady().then(async () => {
  const storage = new SQLiteAdapter(getDbPath(), 'easy-agent-master-key');
  core = new EasyAgentCore(storage);
  await createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
```

> **electron-vite 优势**：`electron/main.ts` 是纯 TypeScript，不需要手动写 `.mjs`。electron-vite 的 `rollupOptions.output.entryFileNames: '[name]/[name].js'` 保证输出为 `dist/main/main.js`，preload 为 `dist/preload/index.js`。

### Step 8: Preload 脚本

**`electron/preload.ts`**：

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => 'pong',
  sendMessage: (conversationId: string, message: string) =>
    ipcRenderer.invoke('chat:send', conversationId, message),
  getHistory: (conversationId: string) => ipcRenderer.invoke('chat:history', conversationId),
  getConversations: () => ipcRenderer.invoke('chat:conversations'),
  newConversation: () => ipcRenderer.invoke('chat:new'),
  deleteConversation: (id: string) => ipcRenderer.invoke('chat:delete', id),
  getConfig: () => ipcRenderer.invoke('config:get'),
  createApiKey: (data: any) => ipcRenderer.invoke('config:apiKey:create', data),
  deleteApiKey: (id: string) => ipcRenderer.invoke('config:apiKey:delete', id),
  createPrompt: (data: any) => ipcRenderer.invoke('config:prompt:create', data),
  deletePrompt: (id: string) => ipcRenderer.invoke('config:prompt:delete', id),
  onToken: (cb: (token: string) => void) => ipcRenderer.on('agent:token', (_, t) => cb(t)),
  onDone: (cb: () => void) => ipcRenderer.on('agent:done', () => cb()),
  onError: (cb: (msg: string) => void) => ipcRenderer.on('agent:error', (_, m) => cb(m)),
});
```

---

## 3. 启动和验证

```bash
# 单一命令，启动 Vite Dev Server + Electron
npm run dev
```

验证清单：
- [ ] Electron 窗口打开（1200x800）
- [ ] 前端页面渲染正常
- [ ] 打开 DevTools（F12 或 Cmd+Opt+I）
- [ ] 切换到设置页，添加一个 API Key
- [ ] 切换到聊天页，发送消息，确认有回复
- [ ] 重启应用，历史对话还在

---

## 4. 下一步推进顺序

```
1. Step 1    → Electron 骨架 + Preload（electron-vite）
2. Step 2    → 三个 Port 接口 + SQLite 适配器
3. Step 3    → OpenAI LLM 适配器 + AgentService
4. Step 4    → IPC Handler 注册 + 前端对接
5. Phase 2   → MCP 适配器（stdio）、Prompt 模板、对话历史
6. Phase 3   → 工作流编排、Vue Flow 画布
```

---

*文档版本: v0.2.0 | 最后更新: 2026-05-26*
