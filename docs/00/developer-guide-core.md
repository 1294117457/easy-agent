# EasyAgent 后端（Core）开发指南

> 版本: v0.1.0 MVP
> 日期: 2026-05-26
> 说明: 后端指 Electron Main Process 内的 Hexagonal Core
> 前置: 你有 Node.js/TS/Java 后端经验，熟悉六边形架构概念

---

## 0. 架构概览

```
Electron Main Process
└── Hexagonal Core
    ├── domain/          # 领域模型（纯业务，无外部依赖）
    ├── ports/           # 端口接口（定义核心需要什么能力）
    ├── adapters/         # 适配器实现（具体怎么做到）
    └── application/      # 应用逻辑（编排业务流程）
```

**与之前 Web 版的根本差异**：
- 不再有 Express HTTP 服务
- 不再有 REST API 路由
- 核心通过 IPC 接收渲染进程的调用
- 数据库和 MCP 子进程都在本地

---

## 1. 项目初始化

### 1.1 创建项目结构

```bash
# 在 easy-agent 根目录
mkdir -p electron/core/{ports,adapters/{llm,storage,mcp},domain,application}
mkdir -p electron/ipc
mkdir -p electron/data

# 初始化 package.json（electron 作为 workspace）
npm init -y
```

### 1.2 安装依赖

```bash
cd electron
npm init -y

# 核心依赖
npm install \
  @langchain/langgraph \
  @langchain/core \
  @langchain/openai \
  @langchain/anthropic \
  @modelcontextprotocol/sdk \
  better-sqlite3 \
  zod \
  uuid \
  dotenv

# Electron 运行时依赖
npm install -D \
  electron \
  electron-builder

# 开发依赖
npm install -D \
  typescript \
  tsx \
  @types/node \
  @types/better-sqlite3 \
  @types/uuid \
  ts-node-dev
```

### 1.3 TypeScript 配置

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./core",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["core/**/*", "ipc/**/*", "shared/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.4 Electron 配置

```json
// package.json 添加
{
  "main": "dist/main.js",
  "type": "module",
  "scripts": {
    "dev": "tsx watch electron/main.ts",
    "build": "tsc",
    "start": "electron .",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## 2. 目录结构

```
electron/
├── main.ts                # Electron 入口（启动主进程）
├── preload.ts             # Context Bridge（暴露安全 API）
│
├── ipc/                  # IPC 处理器（对接 Core 和 Renderer）
│   ├── chat.handler.ts
│   ├── config.handler.ts
│   ├── mcp.handler.ts
│   └── workflow.handler.ts
│
├── core/                  # 六边形架构核心
│   ├── index.ts          # 核心导出（供 IPC Handler 调用）
│   │
│   ├── ports/            # 端口接口定义（核心说话的地方）
│   │   ├── llm.port.ts
│   │   ├── storage.port.ts
│   │   └── mcp.port.ts
│   │
│   ├── adapters/         # 适配器实现（具体怎么做）
│   │   ├── llm/
│   │   │   ├── openai.adapter.ts
│   │   │   └── anthropic.adapter.ts
│   │   ├── storage/
│   │   │   └── sqlite.adapter.ts
│   │   └── mcp/
│   │       ├── stdio.adapter.ts
│   │       └── sse.adapter.ts
│   │
│   ├── domain/           # 领域模型（纯业务概念）
│   │   ├── types.ts
│   │   ├── Workflow.ts
│   │   ├── Conversation.ts
│   │   ├── Message.ts
│   │   └── Prompt.ts
│   │
│   └── application/      # 应用逻辑（编排业务流程）
│       ├── AgentService.ts
│       ├── WorkflowService.ts
│       └── PluginService.ts
│
├── data/                  # SQLite 数据库目录
└── dist/                  # 编译输出
```

---

## 3. 分步实现

### Step 1: 领域模型（domain/）

领域模型是**纯业务概念**，没有任何外部依赖（不 import 数据库、不 import SDK）。

**`core/domain/types.ts`**：

```typescript
// core/domain/types.ts

export type NodeType = 'input' | 'llm' | 'mcp_tool' | 'output' | 'condition';
export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
export type AgentStatus = 'idle' | 'thinking' | 'working' | 'happy' | 'error';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  position: { x: number; y: number };
  config: NodeConfig;
}

export interface NodeConfig {
  mcpServerId?: string;
  toolName?: string;
  model?: string;
  systemPrompt?: string;
  condition?: string;
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
  role: 'user' | 'assistant' | 'system';
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
```

### Step 2: 端口定义（ports/）

端口是**核心定义的接口**，告诉外部"我需要什么能力"。每个 Port 是一个 TypeScript interface，核心只依赖 Port，不依赖任何 Adapter。

**`core/ports/llm.port.ts`**：

```typescript
// core/ports/llm.port.ts
import type { CoreMessage } from '@langchain/core/messages';

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

  invoke(messages: CoreMessage[]): Promise<LLMResponse>;

  invokeStream(
    messages: CoreMessage[],
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse>;
}
```

**`core/ports/storage.port.ts`**：

```typescript
// core/ports/storage.port.ts
import type { Workflow, Conversation, Message, Prompt, McpServer, McpTool } from '../domain/types.js';

export interface CreateApiKeyDTO {
  provider: string;
  key: string;
  model: string;
}

export interface CreateWorkflowDTO {
  name: string;
  description?: string;
  nodes: Workflow['nodes'];
  edges: Workflow['edges'];
}

export interface AppendMessageDTO {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
}

export interface CreatePromptDTO {
  name: string;
  description?: string;
  systemPrompt: string;
  isBuiltin?: boolean;
}

export interface IStoragePort {
  // API Key
  createApiKey(data: CreateApiKeyDTO): { id: string; provider: string; model: string; enabled: boolean };
  listApiKeys(): { id: string; provider: string; model: string; enabled: boolean }[];
  getDecryptedKey(id: string): string | null;
  deleteApiKey(id: string): boolean;

  // Workflow
  createWorkflow(data: CreateWorkflowDTO): Workflow;
  listWorkflows(): Workflow[];
  getWorkflow(id: string): Workflow | null;
  updateWorkflow(id: string, data: Partial<Workflow>): Workflow | null;
  deleteWorkflow(id: string): boolean;

  // Conversation & Message
  createConversation(name?: string): Conversation;
  listConversations(): Conversation[];
  getMessages(convId: string): Message[];
  appendMessage(data: AppendMessageDTO): Message;
  deleteConversation(id: string): boolean;
  renameConversation(id: string, name: string): boolean;

  // Prompt
  createPrompt(data: CreatePromptDTO): Prompt;
  listPrompts(): Prompt[];
  updatePrompt(id: string, data: Partial<Prompt>): boolean;
  deletePrompt(id: string): boolean;

  // MCP Server
  createMcpServer(data: Omit<McpServer, 'id'>): McpServer;
  listMcpServers(): McpServer[];
  deleteMcpServer(id: string): boolean;

  // MCP Tool
  saveMcpTools(serverId: string, tools: McpTool[]): void;
  listMcpTools(serverId: string): McpTool[];
}
```

**`core/ports/mcp.port.ts`**：

```typescript
// core/ports/mcp.port.ts
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
  callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown>;

  onToolCall(callback: (event: ToolCallEvent) => void): void;
  onDisconnect(callback: (serverId: string) => void): void;
}
```

### Step 3: 适配器实现（adapters/）

适配器**实现 Port 接口**，把 Port 的抽象能力翻译成具体的技术实现。适配器在核心外部，可以自由替换。

#### 3.1 SQLite 适配器

**`core/adapters/storage/sqlite.adapter.ts`**：

```typescript
// core/adapters/storage/sqlite.adapter.ts
import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { IStoragePort } from '../../ports/storage.port.js';
import type { Workflow, Conversation, Message, Prompt, McpServer, McpTool } from '../../domain/types.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY, provider TEXT NOT NULL,
    encrypted_key TEXT NOT NULL, model TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
    graph_data TEXT NOT NULL, status TEXT DEFAULT 'idle',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '新对话',
    workflow_id TEXT REFERENCES workflows(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, content TEXT NOT NULL, model TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
    system_prompt TEXT NOT NULL, is_builtin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
    command TEXT, url TEXT, enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mcp_tools (
    id TEXT PRIMARY KEY, server_id TEXT NOT NULL,
    name TEXT NOT NULL, description TEXT, input_schema TEXT,
    enabled INTEGER DEFAULT 1
);
`;

// AES-256-GCM 加密
class KeyEncryptor {
  private key: Buffer;
  constructor(password: string) {
    const salt = crypto.scryptSync(password, 'easy-agent-salt', 32);
    this.key = crypto.scryptSync(password, salt, 32, { N: 2 ** 14, r: 8, p: 1 });
  }
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
  }
  decrypt(data: string): string {
    const [ivHex, authTagHex, encrypted] = data.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString('utf8');
  }
}

export class SQLiteAdapter implements IStoragePort {
  private db: Database.Database;
  private encryptor: KeyEncryptor;

  constructor(dbPath: string, masterPassword: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(SCHEMA);
    this.encryptor = new KeyEncryptor(masterPassword);
  }

  // API Key
  createApiKey(data: { provider: string; key: string; model: string }) {
    const id = uuidv4();
    this.db.prepare(`INSERT INTO api_keys (id, provider, encrypted_key, model) VALUES (?, ?, ?, ?)`)
      .run(id, data.provider, this.encryptor.encrypt(data.key), data.model);
    return { id, provider: data.provider, model: data.model, enabled: true };
  }
  listApiKeys() { return this.db.prepare(`SELECT id, provider, model, enabled FROM api_keys`).all() as any[]; }
  getDecryptedKey(id: string) {
    const row = this.db.prepare(`SELECT encrypted_key FROM api_keys WHERE id = ?`).get(id) as any;
    return row ? this.encryptor.decrypt(row.encrypted_key) : null;
  }
  deleteApiKey(id: string) { return this.db.prepare(`DELETE FROM api_keys WHERE id = ?`).run(id).changes > 0; }

  // Workflow
  createWorkflow(data: { name: string; description?: string; nodes: any[]; edges: any[] }) {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO workflows (id, name, description, graph_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, data.name, data.description || '', JSON.stringify({ nodes: data.nodes, edges: data.edges }), now, now);
    return { id, name: data.name, description: data.description, nodes: data.nodes, edges: data.edges, status: 'idle' as const, createdAt: now, updatedAt: now };
  }
  listWorkflows() {
    return this.db.prepare(`SELECT * FROM workflows ORDER BY updated_at DESC`).all() as any[];
  }
  getWorkflow(id: string) { return this.db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(id) as any; }
  updateWorkflow(id: string, data: Partial<Workflow>) {
    const sets: string[] = [], vals: any[] = [];
    if (data.name) { sets.push('name = ?'); vals.push(data.name); }
    if (data.status) { sets.push('status = ?'); vals.push(data.status); }
    if (data.nodes) { sets.push('graph_data = ?'); vals.push(JSON.stringify({ nodes: data.nodes, edges: data.edges })); }
    if (!sets.length) return null;
    sets.push('updated_at = ?'); vals.push(new Date().toISOString());
    vals.push(id);
    this.db.prepare(`UPDATE workflows SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.getWorkflow(id);
  }
  deleteWorkflow(id: string) { return this.db.prepare(`DELETE FROM workflows WHERE id = ?`).run(id).changes > 0; }

  // Conversation
  createConversation(name?: string) {
    const id = uuidv4(), now = new Date().toISOString();
    this.db.prepare(`INSERT INTO conversations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(id, name || '新对话', now, now);
    return { id, name: name || '新对话', createdAt: now, updatedAt: now };
  }
  listConversations() { return this.db.prepare(`SELECT * FROM conversations ORDER BY updated_at DESC`).all() as any[]; }
  getMessages(convId: string) { return this.db.prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`).all(convId) as any[]; }
  appendMessage(data: { conversationId: string; role: string; content: string; model?: string }) {
    const id = uuidv4(), now = new Date().toISOString();
    this.db.prepare(`INSERT INTO messages (id, conversation_id, role, content, model, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, data.conversationId, data.role, data.content, data.model || null, now);
    this.db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, data.conversationId);
    return { id, ...data, createdAt: now };
  }
  deleteConversation(id: string) { return this.db.prepare(`DELETE FROM conversations WHERE id = ?`).run(id).changes > 0; }
  renameConversation(id: string, name: string) {
    return this.db.prepare(`UPDATE conversations SET name = ?, updated_at = ? WHERE id = ?`).run(name, new Date().toISOString(), id).changes > 0;
  }

  // Prompt
  createPrompt(data: { name: string; description?: string; systemPrompt: string; isBuiltin?: boolean }) {
    const id = uuidv4(), now = new Date().toISOString();
    this.db.prepare(`INSERT INTO prompts (id, name, description, system_prompt, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.name, data.description || '', data.systemPrompt, data.isBuiltin ? 1 : 0, now, now);
    return { id, ...data, isBuiltin: !!data.isBuiltin, createdAt: now, updatedAt: now };
  }
  listPrompts() { return this.db.prepare(`SELECT * FROM prompts ORDER BY is_builtin DESC, created_at DESC`).all() as any[]; }
  updatePrompt(id: string, data: Partial<Prompt>) {
    const sets: string[] = [], vals: any[] = [];
    if (data.name) { sets.push('name = ?'); vals.push(data.name); }
    if (data.systemPrompt) { sets.push('system_prompt = ?'); vals.push(data.systemPrompt); }
    if (!sets.length) return false;
    sets.push('updated_at = ?'); vals.push(new Date().toISOString()); vals.push(id);
    return this.db.prepare(`UPDATE prompts SET ${sets.join(', ')} WHERE id = ?`).run(...vals).changes > 0;
  }
  deletePrompt(id: string) { return this.db.prepare(`DELETE FROM prompts WHERE id = ?`).run(id).changes > 0; }

  // MCP
  createMcpServer(data: Omit<McpServer, 'id'>) {
    const id = uuidv4();
    this.db.prepare(`INSERT INTO mcp_servers (id, name, type, command, url, enabled) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, data.name, data.type, data.command || null, data.url || null, data.enabled ? 1 : 0);
    return { id, ...data };
  }
  listMcpServers() { return this.db.prepare(`SELECT * FROM mcp_servers`).all() as any[]; }
  deleteMcpServer(id: string) { return this.db.prepare(`DELETE FROM mcp_servers WHERE id = ?`).run(id).changes > 0; }
  saveMcpTools(serverId: string, tools: McpTool[]) {
    this.db.prepare(`DELETE FROM mcp_tools WHERE server_id = ?`).run(serverId);
    const stmt = this.db.prepare(`INSERT INTO mcp_tools (id, server_id, name, description, input_schema, enabled) VALUES (?, ?, ?, ?, ?, ?)`);
    for (const t of tools) stmt.run(uuidv4(), serverId, t.name, t.description, JSON.stringify(t.inputSchema), t.enabled ? 1 : 0);
  }
  listMcpTools(serverId: string) { return this.db.prepare(`SELECT * FROM mcp_tools WHERE server_id = ?`).all(serverId) as any[]; }

  close() { this.db.close(); }
}
```

#### 3.2 LLM 适配器

**`core/adapters/llm/openai.adapter.ts`**：

```typescript
// core/adapters/llm/openai.adapter.ts
import { ChatOpenAI } from '@langchain/openai';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort, LLMResponse } from '../../../ports/llm.port.js';

export class OpenAIAdapter implements ILLMPort {
  readonly provider = 'openai';
  model: string;
  private llm: ChatOpenAI;

  constructor(model: string, apiKey: string) {
    this.model = model;
    this.llm = new ChatOpenAI({ model, apiKey, temperature: 0, streaming: true });
  }

  async invoke(messages: BaseMessage[]): Promise<LLMResponse> {
    const result = await this.llm.invoke(messages);
    return { content: result.content as string };
  }

  async invokeStream(messages: BaseMessage[], onChunk: (chunk: string) => void): Promise<LLMResponse> {
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

**`core/adapters/llm/anthropic.adapter.ts`**：

```typescript
// core/adapters/llm/anthropic.adapter.ts
import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseMessage } from '@langchain/core/messages';
import type { ILLMPort, LLMResponse } from '../../../ports/llm.port.js';

export class AnthropicAdapter implements ILLMPort {
  readonly provider = 'anthropic';
  model: string;
  private llm: ChatAnthropic;

  constructor(model: string, apiKey: string) {
    this.model = model;
    this.llm = new ChatAnthropic({ model, apiKey, streaming: true });
  }

  async invoke(messages: BaseMessage[]): Promise<LLMResponse> {
    const result = await this.llm.invoke(messages);
    return { content: result.content as string };
  }

  async invokeStream(messages: BaseMessage[], onChunk: (chunk: string) => void): Promise<LLMResponse> {
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

**LLM 适配器工厂**：

```typescript
// core/adapters/llm/index.ts
import type { ILLMPort } from '../../ports/llm.port.js';
import { OpenAIAdapter } from './openai.adapter.js';
import { AnthropicAdapter } from './anthropic.adapter.js';

export function createLLMAdapter(
  provider: string,
  model: string,
  apiKey: string
): ILLMPort {
  if (provider === 'anthropic') return new AnthropicAdapter(model, apiKey);
  return new OpenAIAdapter(model, apiKey);
}
```

#### 3.3 MCP 适配器

**`core/adapters/mcp/stdio.adapter.ts`**：

```typescript
// core/adapters/mcp/stdio.adapter.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { IMcpPort, ToolCallEvent } from '../../../ports/mcp.port.js';
import type { McpServer, McpTool } from '../../../domain/types.js';

export class StdioMCPAdapter implements IMcpPort {
  private connections = new Map<string, Client>();
  private toolCallCallbacks: ((event: ToolCallEvent) => void)[] = [];
  private disconnectCallbacks: ((serverId: string) => void)[] = [];

  async connect(server: McpServer): Promise<void> {
    if (this.connections.has(server.id)) await this.disconnect(server.id);

    const [command, ...args] = (server.command || '').split(' ');
    const transport = new StdioClientTransport({ command, args });
    const client = new Client({ name: 'easy-agent', version: '0.1.0' }, { capabilities: { tools: {} } });
    await client.connect(transport);
    this.connections.set(server.id, client);
  }

  disconnect(serverId: string): Promise<void> {
    const client = this.connections.get(serverId);
    if (client) {
      client.close();
      this.connections.delete(serverId);
      this.disconnectCallbacks.forEach(cb => cb(serverId));
    }
    return Promise.resolve();
  }

  isConnected(serverId: string) { return this.connections.has(serverId); }

  async listTools(serverId: string): Promise<McpTool[]> {
    const client = this.connections.get(serverId);
    if (!client) return [];
    const result = await client.request({ method: 'tools/list' }, { _tag: 'tools/list' } as any);
    return (result.tools || []).map((t: any, i: number) => ({
      id: `tool-${serverId}-${i}`, serverId, name: t.name,
      description: t.description || '', inputSchema: t.inputSchema || {}, enabled: true,
    }));
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const client = this.connections.get(serverId);
    if (!client) throw new Error(`MCP Server ${serverId} not connected`);
    this.toolCallCallbacks.forEach(cb => cb({ serverId, toolName, arguments: args }));
    const result = await client.request(
      { method: 'tools/call', params: { name: toolName, arguments: args } },
      { _tag: 'tools/call' } as any
    );
    return result.content;
  }

  onToolCall(callback: (event: ToolCallEvent) => void) { this.toolCallCallbacks.push(callback); }
  onDisconnect(callback: (serverId: string) => void) { this.disconnectCallbacks.push(callback); }
}
```

### Step 4: 应用逻辑（application/）

应用层**组合 Port**，通过依赖注入拿到具体 Adapter 实例，编排业务流程。

**`core/application/AgentService.ts`**：

```typescript
// core/application/AgentService.ts
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { StateGraph } from '@langchain/langgraph';
import type { ILLMPort } from '../ports/llm.port.js';
import type { IStoragePort } from '../ports/storage.port.js';
import type { IMcpPort } from '../ports/mcp.port.js';
import type { CoreMessage } from '@langchain/core/messages';

interface AgentState {
  messages: CoreMessage[];
  activeModel: string;
  systemPrompt: string;
  toolCall: { name: string; args: Record<string, unknown> } | null;
  toolResult: unknown;
  finalResponse: string;
}

export class AgentService {
  constructor(
    private llmPort: ILLMPort,
    private storagePort: IStoragePort,
    private mcpPort: IMcpPort
  ) {}

  async sendMessage(
    conversationId: string,
    userInput: string,
    callbacks: {
      onToken: (token: string) => void;
      onToolCall: (serverId: string, toolName: string, args: any) => void;
      onDone: () => void;
      onError: (error: string) => void;
    }
  ) {
    // 1. 保存用户消息
    this.storagePort.appendMessage({ conversationId, role: 'user', content: userInput });

    // 2. 加载对话历史
    const history = this.storagePort.getMessages(conversationId);
    const langchainMessages: CoreMessage[] = history.map(m =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    );

    // 3. 获取 system prompt
    const prompts = this.storagePort.listPrompts();
    const systemPrompt = prompts[0]?.system_prompt || prompts[0]?.systemPrompt || '你是 EasyAgent，智能助手。';

    // 4. 构建 LangGraph
    const graph = this.buildGraph();

    // 5. 执行
    try {
      const result = await graph.invoke({
        messages: [new HumanMessage(userInput)],
        activeModel: this.llmPort.model,
        systemPrompt,
        toolCall: null,
        toolResult: null,
        finalResponse: '',
      }, {
        callbacks: [{
          onChainEnd: (output) => {
            const lastMsg = output.output?.messages?.at(-1);
            if (lastMsg?.content) {
              callbacks.onToken(lastMsg.content as string);
            }
          }
        }]
      });

      const response = result.finalResponse || '';
      this.storagePort.appendMessage({ conversationId, role: 'assistant', content: response, model: this.llmPort.model });
      callbacks.onDone();

    } catch (err: any) {
      callbacks.onError(err.message);
    }
  }

  private buildGraph() {
    const channels = {
      messages: { value: (x: CoreMessage[], y: CoreMessage[]) => [...x, ...y], default: () => [] },
      activeModel: null, systemPrompt: null,
      toolCall: null, toolResult: null, finalResponse: null,
    };

    const workflow = new StateGraph<AgentState>({ channels });

    // LLM 路由节点
    workflow.addNode('route', async (state) => {
      const response = await this.llmPort.invokeStream(
        [new SystemMessage(state.systemPrompt), ...state.messages],
        (chunk) => { /* streaming handled in callback */ }
      );

      const content = response.content.trim();
      if (content.startsWith('TOOL_CALL|')) {
        const [, name, argsJson] = content.split('|');
        return { toolCall: { name, args: JSON.parse(argsJson || '{}') }, finalResponse: '' };
      }
      return { toolCall: null, finalResponse: content };
    });

    // 工具执行节点
    workflow.addNode('execute_tool', async (state) => {
      if (!state.toolCall) return {};
      const [serverId, toolName] = state.toolCall.name.split(':');
      callbacks.onToolCall?.(serverId, toolName, state.toolCall.args);
      const result = await this.mcpPort.callTool(serverId, toolName, state.toolCall.args);
      return {
        messages: [...state.messages, new AIMessage({ content: `[${toolName}] 结果: ${JSON.stringify(result)}` })],
      };
    });

    workflow.addEntryPoint('route');
    workflow.addConditionalEdges('route',
      (state) => state.toolCall ? 'execute_tool' : '__end__',
      { execute_tool: 'execute_tool', __end__: '__end__' }
    );
    workflow.addEdge('execute_tool', 'route');

    return workflow.compile();
  }
}
```

### Step 5: 核心导出（core/index.ts）

核心的统一导出，供 IPC Handler 调用。**IPC Handler 只依赖核心，不直接依赖任何 Adapter**。

**`core/index.ts`**：

```typescript
// core/index.ts
import type { ILLMPort } from './ports/llm.port.js';
import type { IStoragePort } from './ports/storage.port.js';
import type { IMcpPort } from './ports/mcp.port.js';
import { AgentService } from './application/AgentService.js';
import { createLLMAdapter } from './adapters/llm/index.js';

export class EasyAgentCore {
  private llmPort: ILLMPort;
  private storagePort: IStoragePort;
  private mcpPort: IMcpPort;
  private agentService: AgentService;

  constructor(storageAdapter: IStoragePort, mcpAdapter: IMcpPort) {
    this.storagePort = storageAdapter;
    this.mcpPort = mcpAdapter;
    // 默认用第一个可用的 API Key 初始化 LLM
    const keys = storageAdapter.listApiKeys();
    const activeKey = keys.find(k => k.enabled) || keys[0];
    if (!activeKey) throw new Error('No API Key configured');
    const decryptedKey = storageAdapter.getDecryptedKey(activeKey.id);
    if (!decryptedKey) throw new Error('Failed to decrypt API Key');
    this.llmPort = createLLMAdapter(activeKey.provider, activeKey.model, decryptedKey);
    this.agentService = new AgentService(this.llmPort, this.storagePort, this.mcpPort);
  }

  // 对话
  sendMessage(conversationId: string, userInput: string, callbacks: Parameters<AgentService['sendMessage']>[2]) {
    return this.agentService.sendMessage(conversationId, userInput, callbacks);
  }

  // Storage 代理
  getStorage(): IStoragePort { return this.storagePort; }

  // MCP 代理
  getMcp(): IMcpPort { return this.mcpPort; }

  // LLM 重载（切换模型）
  reloadLLM(provider: string, model: string, apiKey: string) {
    this.llmPort = createLLMAdapter(provider, model, apiKey);
    this.agentService = new AgentService(this.llmPort, this.storagePort, this.mcpPort);
  }
}
```

### Step 6: IPC 处理器（ipc/）

IPC Handler 是**六边形架构外的黏合层**，把渲染进程的 IPC 调用翻译成核心的能力调用。

**`electron/ipc/chat.handler.ts`**：

```typescript
// electron/ipc/chat.handler.ts
import type { IpcMainInvokeEvent } from 'electron';
import type { EasyAgentCore } from '../core/index.js';

export function registerChatHandlers(
  ipcMain: any,
  core: EasyAgentCore
) {
  ipcMain.handle('chat:send', async (_event: IpcMainInvokeEvent, message: string) => {
    const conversationId = core.getStorage().createConversation().id;

    return new Promise((resolve, reject) => {
      core.sendMessage(conversationId, message, {
        onToken: (token) => { /* 通过 IPC 推送到渲染进程 */ },
        onToolCall: (serverId, toolName, args) => { /* 推送工具调用事件 */ },
        onDone: () => resolve(conversationId),
        onError: (error) => reject(new Error(error)),
      });
    });
  });
}
```

**`electron/ipc/config.handler.ts`**：

```typescript
// electron/ipc/config.handler.ts
export function registerConfigHandlers(ipcMain: any, storage: any) {
  ipcMain.handle('config:get', () => ({
    apiKeys: storage.listApiKeys(),
    prompts: storage.listPrompts(),
    mcpServers: storage.listMcpServers(),
  }));

  ipcMain.handle('config:apiKey:create', (_, data) => storage.createApiKey(data));
  ipcMain.handle('config:apiKey:delete', (_, id) => storage.deleteApiKey(id));
  ipcMain.handle('config:prompt:create', (_, data) => storage.createPrompt(data));
  ipcMain.handle('config:prompt:delete', (_, id) => storage.deletePrompt(id));
}
```

**`electron/ipc/mcp.handler.ts`**：

```typescript
// electron/ipc/mcp.handler.ts
export function registerMcpHandlers(ipcMain: any, core: any) {
  const mcp = core.getMcp();

  ipcMain.handle('mcp:connect', async (_, server) => {
    await mcp.connect(server);
    const tools = await mcp.listTools(server.id);
    core.getStorage().saveMcpTools(server.id, tools);
    return { id: server.id, name: server.name };
  });

  ipcMain.handle('mcp:disconnect', async (_, serverId) => {
    await mcp.disconnect(serverId);
  });

  ipcMain.handle('mcp:list', () => core.getStorage().listMcpServers());
  ipcMain.handle('mcp:tools', (_, serverId) => core.getStorage().listMcpTools(serverId));
}
```

**`electron/ipc/workflow.handler.ts`**：

```typescript
// electron/ipc/workflow.handler.ts
export function registerWorkflowHandlers(ipcMain: any, core: any) {
  const storage = core.getStorage();

  ipcMain.handle('workflow:list', () => storage.listWorkflows());
  ipcMain.handle('workflow:save', (_, data) => storage.createWorkflow(data));
  ipcMain.handle('workflow:delete', (_, id) => storage.deleteWorkflow(id));
  ipcMain.handle('workflow:execute', (_, workflowId, input) => {
    // TODO: 执行工作流
  });
}
```

### Step 7: Electron 入口（main.ts）

**`electron/main.ts`**：

```typescript
// electron/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { EasyAgentCore } from './core/index.js';
import { SQLiteAdapter } from './core/adapters/storage/sqlite.adapter.js';
import { StdioMCPAdapter } from './core/adapters/mcp/stdio.adapter.js';
import { registerChatHandlers } from './ipc/chat.handler.js';
import { registerConfigHandlers } from './ipc/config.handler.js';
import { registerMcpHandlers } from './ipc/mcp.handler.js';
import { registerWorkflowHandlers } from './ipc/workflow.handler.js';

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

  // 开发模式加载 Vite Dev Server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  // 初始化核心
  const storage = new SQLiteAdapter(getDbPath(), 'easy-agent-master-key');
  const mcpAdapter = new StdioMCPAdapter();
  core = new EasyAgentCore(storage, mcpAdapter);

  // 注册 IPC Handler
  registerChatHandlers(ipcMain, core);
  registerConfigHandlers(ipcMain, storage);
  registerMcpHandlers(ipcMain, core);
  registerWorkflowHandlers(ipcMain, core);

  // 工具调用事件通过 WebContents 推送到渲染进程
  core.getMcp().onToolCall((event) => {
    mainWindow.webContents.send('agent:tool_call', event);
  });

  await createWindow();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

### Step 8: Preload 脚本

**`electron/preload.ts`**：

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 对话
  sendMessage: (message: string) => ipcRenderer.invoke('chat:send', message),

  // 状态推送
  onToken: (cb: (token: string) => void) =>
    ipcRenderer.on('agent:token', (_, token) => cb(token)),
  onToolCall: (cb: (data: any) => void) =>
    ipcRenderer.on('agent:tool_call', (_, data) => cb(data)),
  onDone: (cb: () => void) =>
    ipcRenderer.on('agent:done', () => cb()),
  onError: (cb: (msg: string) => void) =>
    ipcRenderer.on('agent:error', (_, msg) => cb(msg)),
  onStatusChange: (cb: (status: string) => void) =>
    ipcRenderer.on('agent:status', (_, status) => cb(status)),

  // 配置
  getConfig: () => ipcRenderer.invoke('config:get'),
  createApiKey: (data: any) => ipcRenderer.invoke('config:apiKey:create', data),
  deleteApiKey: (id: string) => ipcRenderer.invoke('config:apiKey:delete', id),
  createPrompt: (data: any) => ipcRenderer.invoke('config:prompt:create', data),
  deletePrompt: (id: string) => ipcRenderer.invoke('config:prompt:delete', id),

  // MCP
  connectMcp: (config: any) => ipcRenderer.invoke('mcp:connect', config),
  disconnectMcp: (id: string) => ipcRenderer.invoke('mcp:disconnect', id),
  listMcpServers: () => ipcRenderer.invoke('mcp:list'),
  listMcpTools: (serverId: string) => ipcRenderer.invoke('mcp:tools', serverId),

  // 工作流
  listWorkflows: () => ipcRenderer.invoke('workflow:list'),
  saveWorkflow: (data: any) => ipcRenderer.invoke('workflow:save', data),
  deleteWorkflow: (id: string) => ipcRenderer.invoke('workflow:delete', id),
  executeWorkflow: (id: string, input: any) => ipcRenderer.invoke('workflow:execute', id, input),
});
```

---

## 4. 启动和验证

```bash
# 终端 1：启动 Vite Dev Server（前端）
cd renderer && npm run dev

# 终端 2：启动 Electron
cd electron && npm run dev
```

应用启动后，你应该能看到：
- Electron 窗口打开
- Vue 前端渲染在窗口内
- DevTools 可以看到 Renderer 的控制台
- 主进程的输出在终端 2

---

## 5. 下一步推进顺序

```
1. Step 1    → 领域模型（types.ts）
2. Step 2    → 三个 Port 接口定义（LLM / Storage / MCP）
3. Step 3    → Storage Adapter（SQLite）+ Key 加密
4. Step 4    → LLM Adapter（OpenAI + Anthropic）
5. Step 5    → MCP Adapter（STDIO）
6. Step 6    → AgentService（LangGraph 编排）
7. Step 7    → Core 导出 + IPC Handler
8. Step 8    → main.ts + preload.ts
9. 前端对接  → 渲染进程 Vue 对接 IPC
```

---

*文档版本: v0.1.0 | 最后更新: 2026-05-26*
