# EasyAgent 后端开发指南

> 版本: v0.1.0 MVP
> 日期: 2026-05-25
> 目标: 搭建 Node.js + TypeScript + LangGraph + MCP 的 Agent 后端服务

---

## 0. 架构概览（与 Java 后端的对比）

你熟悉 Java Spring Boot 后端，本项目的 Node.js 后端在架构思路上高度一致：

| Java 生态 | Node.js 生态（本项目） | 说明 |
|-----------|----------------------|------|
| Spring Boot | Express.js | HTTP 框架 |
| `@Service` | `services/*.ts` | 业务逻辑层 |
| `@RestController` | `routes/*.ts` | 请求入口 |
| MySQL + JPA | better-sqlite3 + 原生 SQL | 数据库（文件数据库） |
| Redis | — | MVP 暂不需要缓存 |
| IOC / @Autowired | 直接 import（Node.js 单例模式） | 依赖注入 |

整体分层：**Routes（入口）→ Services（逻辑）→ Storage（DB）→ Types（类型）**，和你写 Java 分层是一样的思路。

---

## 1. 项目初始化

### 1.1 创建目录

```bash
mkdir -p packages/server/src/{routes,services,graph/nodes,db,types,utils,adapters}
mkdir -p packages/server/data

cd packages/server
npm init -y
```

### 1.2 安装依赖

```bash
# 运行时依赖
npm install \
  express \
  cors \
  ws \
  better-sqlite3 \
  @langchain/langgraph \
  @langchain/core \
  @langchain/openai \
  @langchain/anthropic \
  @modelcontextprotocol/sdk \
  zod \
  uuid \
  dotenv

# 开发依赖
npm install -D \
  typescript \
  tsx \
  @types/node \
  @types/express \
  @types/cors \
  @types/ws \
  @types/better-sqlite3 \
  @types/uuid \
  eslint \
  prettier
```

### 1.3 TypeScript 配置

```bash
npx tsc --init
```

编辑 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.4 配置 package.json

```json
{
  "name": "easy-agent-server",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  }
}
```

### 1.5 环境变量

`.env`（不提交）：

```bash
PORT=3000
NODE_ENV=development
DB_PATH=./data/easy-agent.db
DEFAULT_MODEL=gpt-4o
```

---

## 2. 目录结构

```
server/src/
├── index.ts              # main() 入口
├── app.ts               # Express App
├── config.ts            # 环境变量
│
├── routes/              # @RestController — 接收请求，调用 Service
│   ├── keys.ts         # /api/keys       — API Key 管理
│   ├── mcp.ts          # /api/mcp        — MCP Server 管理
│   ├── workflow.ts       # /api/workflows  — 工作流 CRUD
│   ├── chat.ts          # /api/chat       — 对话 + SSE 流式
│   ├── conversation.ts   # /api/conversations — 对话历史
│   └── prompt.ts         # /api/prompts    — Prompt 模板
│
├── services/            # @Service — 业务逻辑
│   ├── storage.ts        # MyBatis Mapper，直接操作 DB
│   ├── key-manager.ts   # API Key 加密
│   ├── agent.ts         # Agent 核心（LangGraph 封装）
│   ├── mcp-client.ts    # MCP 客户端
│   └── sse-emitter.ts   # SSE 事件推送
│
├── adapters/             # 模型适配器（新增）
│   ├── base.ts          # 适配器接口定义
│   ├── openai-adapter.ts
│   └── anthropic-adapter.ts
│
├── graph/               # LangGraph 图定义（项目核心）
│   ├── compiler.ts
│   └── nodes/
│       ├── llm-router.ts
│       ├── tool-executor.ts
│       └── response-builder.ts
│
├── db/
│   ├── index.ts
│   └── schema.ts       # 建表 SQL（包含对话历史和 Prompt 表）
│
├── types/
│   ├── workflow.ts
│   ├── mcp.ts
│   ├── api-key.ts
│   ├── conversation.ts   # 对话类型（新增）
│   └── prompt.ts         # Prompt 类型（新增）
│
└── utils/
    └── id.ts
```

---

## 3. 分步实现

### Step 1: 环境配置和工具函数

**`src/config.ts`**：

```typescript
// src/config.ts
import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || './data/easy-agent.db',
  defaultModel: process.env.DEFAULT_MODEL || 'gpt-4o',
};
```

**`src/utils/id.ts`**：

```typescript
// src/utils/id.ts
import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}
```

### Step 2: 数据库层（含对话历史和 Prompt 表）

**`src/db/schema.ts`**：

```typescript
// src/db/schema.ts
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    model TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('stdio', 'sse')),
    command TEXT,
    url TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mcp_tools (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES mcp_servers(id),
    name TEXT NOT NULL,
    description TEXT,
    input_schema TEXT,
    enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    graph_data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '新对话',
    workflow_id TEXT REFERENCES workflows(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    is_builtin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS execution_history (
    id TEXT PRIMARY KEY,
    workflow_id TEXT REFERENCES workflows(id),
    input_data TEXT,
    output_data TEXT,
    status TEXT CHECK(status IN ('success', 'failed', 'running')),
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
`;
```

**`src/db/index.ts`**：

```typescript
// src/db/index.ts
import Database from 'better-sqlite3';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { config } from '../config.js';
import { SCHEMA_SQL } from './schema.js';

let db: Database.Database;

export async function initDatabase(): Promise<Database.Database> {
  await mkdir(dirname(config.dbPath), { recursive: true });
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  console.log('[DB] Database initialized at', config.dbPath);
  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized.');
  return db;
}

export function closeDb(): void {
  if (db) db.close();
}
```

### Step 3: 模型适配器（新增）

这是 MVP 的关键设计：上层 Agent 不依赖固定模型厂商，通过适配器接口动态切换。

**`src/adapters/base.ts`** — 适配器接口：

```typescript
// src/adapters/base.ts
import type { BaseMessage } from '@langchain/core/messages';

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMAdapter {
  provider: string;
  model: string;

  invoke(messages: BaseMessage[]): Promise<LLMResponse>;
  invokeStream(messages: BaseMessage[], onChunk: (chunk: string) => void): Promise<LLMResponse>;
}
```

**`src/adapters/openai-adapter.ts`**：

```typescript
// src/adapters/openai-adapter.ts
import { ChatOpenAI } from '@langchain/openai';
import type { BaseMessage } from '@langchain/core/messages';
import type { LLMAdapter, LLMResponse } from './base.js';

export class OpenAIAdapter implements LLMAdapter {
  provider = 'openai';
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

**`src/adapters/anthropic-adapter.ts`**：

```typescript
// src/adapters/anthropic-adapter.ts
import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseMessage } from '@langchain/core/messages';
import type { LLMAdapter, LLMResponse } from './base.js';

export class AnthropicAdapter implements LLMAdapter {
  provider = 'anthropic';
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

**适配器工厂**：

```typescript
// src/adapters/index.ts
import type { LLMAdapter } from './base.js';
import { OpenAIAdapter } from './openai-adapter.js';
import { AnthropicAdapter } from './anthropic-adapter.js';
import { getDecryptedKey, listApiKeys } from '../services/storage.js';

const cache = new Map<string, LLMAdapter>();

export function getAdapter(model?: string): LLMAdapter {
  const apiKeys = listApiKeys();
  const activeKey = apiKeys.find(k => k.enabled) || apiKeys[0];
  const targetModel = model || activeKey?.model || 'gpt-4o';
  const targetProvider = activeKey?.provider || 'openai';
  const cacheKey = `${targetProvider}:${targetModel}`;

  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const decryptedKey = getDecryptedKey(activeKey?.id || '');
  if (!decryptedKey) throw new Error('No valid API key found');

  const adapter: LLMAdapter = targetProvider === 'anthropic'
    ? new AnthropicAdapter(targetModel, decryptedKey)
    : new OpenAIAdapter(targetModel, decryptedKey);

  cache.set(cacheKey, adapter);
  return adapter;
}
```

### Step 4: Key 加密管理

**`src/services/key-manager.ts`**：

```typescript
// src/services/key-manager.ts
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;

export class KeyManager {
  private masterKey: Buffer;

  constructor(password: string) {
    const salt = crypto.scryptSync(password, 'easy-agent-salt', SALT_LENGTH);
    this.masterKey = crypto.scryptSync(password, salt, KEY_LENGTH, { N: 2 ** 14, r: 8, p: 1 });
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

let keyManager: KeyManager | null = null;

export function getKeyManager(): KeyManager {
  if (!keyManager) {
    keyManager = new KeyManager(process.env.MASTER_KEY || 'easy-agent-default-master-key');
  }
  return keyManager;
}
```

### Step 5: Storage 服务（完整 CRUD）

**`src/services/storage.ts`**：

```typescript
// src/services/storage.ts
import { getDb } from '../db/index.js';
import { getKeyManager } from './key-manager.js';
import { generateId } from '../utils/id.js';
import type {
  Workflow, ApiKey, McpServer,
  Conversation, Message, Prompt
} from '../types/index.js';

// ==================== API Key ====================

export function createApiKey(data: { provider: string; key: string; model: string }): ApiKey {
  const db = getDb();
  const keyManager = getKeyManager();
  const id = generateId();
  db.prepare(`INSERT INTO api_keys (id, provider, encrypted_key, model) VALUES (?, ?, ?, ?)`)
    .run(id, data.provider, keyManager.encrypt(data.key), data.model);
  return { id, provider: data.provider, model: data.model, enabled: true };
}

export function listApiKeys(): Omit<ApiKey, 'encryptedKey'>[] {
  return getDb().prepare('SELECT id, provider, model, enabled FROM api_keys').all() as Omit<ApiKey, 'encryptedKey'>[];
}

export function getDecryptedKey(id: string): string | null {
  const row = getDb().prepare('SELECT encrypted_key FROM api_keys WHERE id = ?').get(id) as { encrypted_key: string } | undefined;
  return row ? getKeyManager().decrypt(row.encrypted_key) : null;
}

export function deleteApiKey(id: string): boolean {
  return getDb().prepare('DELETE FROM api_keys WHERE id = ?').run(id).changes > 0;
}

// ==================== Workflow ====================

export function createWorkflow(data: {
  name: string; description?: string;
  nodes: Workflow['nodes']; edges: Workflow['edges'];
}): Workflow {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO workflows (id, name, description, graph_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, data.name, data.description || '', JSON.stringify({ nodes: data.nodes, edges: data.edges }), now, now);
  return { id, name: data.name, description: data.description, nodes: data.nodes, edges: data.edges, createdAt: now, updatedAt: now };
}

export function listWorkflows(): Workflow[] {
  const rows = getDb().prepare('SELECT * FROM workflows ORDER BY updated_at DESC').all() as any[];
  return rows.map(row => ({ id: row.id, name: row.name, description: row.description, ...JSON.parse(row.graph_data), createdAt: row.created_at, updatedAt: row.updated_at }));
}

export function getWorkflow(id: string): Workflow | null {
  const row = getDb().prepare('SELECT * FROM workflows WHERE id = ?').get(id) as any;
  return row ? { id: row.id, name: row.name, description: row.description, ...JSON.parse(row.graph_data), createdAt: row.created_at, updatedAt: row.updated_at } : null;
}

export function deleteWorkflow(id: string): boolean {
  return getDb().prepare('DELETE FROM workflows WHERE id = ?').run(id).changes > 0;
}

// ==================== MCP ====================

export function createMcpServer(data: Omit<McpServer, 'id'>): McpServer {
  const db = getDb();
  const id = generateId();
  db.prepare(`INSERT INTO mcp_servers (id, name, type, command, url, enabled) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, data.name, data.type, data.command || null, data.url || null, data.enabled ? 1 : 0);
  return { id, ...data };
}

export function listMcpServers(): McpServer[] {
  return getDb().prepare('SELECT * FROM mcp_servers').all() as McpServer[];
}

export function deleteMcpServer(id: string): boolean {
  return getDb().prepare('DELETE FROM mcp_servers WHERE id = ?').run(id).changes > 0;
}

// ==================== Conversation（新增）====================

export function createConversation(name?: string): Conversation {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO conversations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run(id, name || '新对话', now, now);
  return { id, name: name || '新对话', createdAt: now, updatedAt: now };
}

export function listConversations(): Conversation[] {
  const rows = getDb().prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as any[];
  return rows.map(r => ({ id: r.id, name: r.name, workflowId: r.workflow_id, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export function getMessages(conversationId: string): Message[] {
  return getDb().prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conversationId) as Message[];
}

export function appendMessage(data: { conversationId: string; role: 'user' | 'assistant' | 'system'; content: string; model?: string }): Message {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO messages (id, conversation_id, role, content, model, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, data.conversationId, data.role, data.content, data.model || null, now);
  // 更新对话的 updated_at
  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, data.conversationId);
  return { id, conversationId: data.conversationId, role: data.role, content: data.content, model: data.model, createdAt: now };
}

export function deleteConversation(id: string): boolean {
  return getDb().prepare('DELETE FROM conversations WHERE id = ?').run(id).changes > 0;
}

export function updateConversationName(id: string, name: string): boolean {
  const now = new Date().toISOString();
  return getDb().prepare(`UPDATE conversations SET name = ?, updated_at = ? WHERE id = ?`).run(name, now, id).changes > 0;
}

// ==================== Prompt（新增）====================

export function createPrompt(data: { name: string; description?: string; systemPrompt: string; isBuiltin?: boolean }): Prompt {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO prompts (id, name, description, system_prompt, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, data.name, data.description || '', data.systemPrompt, data.isBuiltin ? 1 : 0, now, now);
  return { id, name: data.name, description: data.description, systemPrompt: data.systemPrompt, isBuiltin: !!data.isBuiltin, createdAt: now, updatedAt: now };
}

export function listPrompts(): Prompt[] {
  const rows = getDb().prepare('SELECT * FROM prompts ORDER BY is_builtin DESC, created_at DESC').all() as any[];
  return rows.map(r => ({ id: r.id, name: r.name, description: r.description, systemPrompt: r.system_prompt, isBuiltin: !!r.is_builtin, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export function deletePrompt(id: string): boolean {
  return getDb().prepare('DELETE FROM prompts WHERE id = ?').run(id).changes > 0;
}

export function updatePrompt(id: string, data: Partial<{ name: string; description: string; systemPrompt: string }>): boolean {
  const sets: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description); }
  if (data.systemPrompt !== undefined) { sets.push('system_prompt = ?'); values.push(data.systemPrompt); }
  if (sets.length === 0) return false;
  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  return getDb().prepare(`UPDATE prompts SET ${sets.join(', ')} WHERE id = ?`).run(...values).changes > 0;
}
```

### Step 6: MCP 客户端

**`src/services/mcp-client.ts`**：

```typescript
// src/services/mcp-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { McpServer } from '../types/mcp.js';

export class MCPClientManager {
  private connections = new Map<string, Client>();

  async addServer(config: McpServer): Promise<any[]> {
    if (this.connections.has(config.id)) await this.removeServer(config.id);

    const transport = config.type === 'stdio'
      ? new StdioClientTransport({ command: config.command!, args: config.command!.split(' ').slice(1) })
      : new SSEClientTransport(new URL(config.url!));

    const client = new Client({ name: 'easy-agent', version: '0.1.0' }, { capabilities: { tools: {} } });
    await client.connect(transport);
    this.connections.set(config.id, client);

    const listResult = await client.request({ method: 'tools/list' }, { _tag: 'tools/list' } as any);
    return listResult.tools || [];
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const client = this.connections.get(serverId);
    if (!client) throw new Error(`MCP Server ${serverId} not connected`);
    const result = await client.request(
      { method: 'tools/call', params: { name: toolName, arguments: args } },
      { _tag: 'tools/call' } as any
    );
    return result.content;
  }

  async removeServer(serverId: string): Promise<void> {
    const client = this.connections.get(serverId);
    if (client) { await client.close(); this.connections.delete(serverId); }
  }
}

export const mcpClientManager = new MCPClientManager();
```

### Step 7: SSE 事件推送（新增）

**`src/services/sse-emitter.ts`**：

```typescript
// src/services/sse-emitter.ts
import type { Response } from 'express';

export type SSEEventType = 'token' | 'tool_call' | 'tool_result' | 'done' | 'error';

export interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
}

export class SSEEmitter {
  constructor(private res: Response) {}

  emit(event: SSEEvent): void {
    this.res.write(`event: ${event.type}\n`);
    this.res.write(`data: ${JSON.stringify(event.data)}\n\n`);
  }

  end(): void {
    this.res.end();
  }
}
```

### Step 8: LangGraph 图定义

**`src/graph/nodes/llm-router.ts`**：

```typescript
// src/graph/nodes/llm-router.ts
import { BaseMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { RouterState } from '../types/agent-state.js';
import { getAdapter } from '../../adapters/index.js';

export async function llmRouterNode(state: RouterState): Promise<Partial<RouterState>> {
  const adapter = getAdapter(state.activeModel);
  const response = await adapter.invoke([
    new SystemMessage(state.systemPrompt),
    ...state.messages,
  ]);

  if (response.content.startsWith('TOOL_CALL|')) {
    const [, name, argsJson] = response.content.split('|');
    return { toolCall: { name, args: JSON.parse(argsJson || '{}') }, finalResponse: '' };
  }

  return { toolCall: null, finalResponse: response.content };
}
```

**`src/graph/nodes/tool-executor.ts`**：

```typescript
// src/graph/nodes/tool-executor.ts
import { AIMessage } from '@langchain/core/messages';
import type { RouterState } from '../types/agent-state.js';
import { mcpClientManager } from '../../services/mcp-client.js';

export async function toolExecutorNode(state: RouterState): Promise<Partial<RouterState>> {
  if (!state.toolCall) return {};

  const [serverId, toolName] = state.toolCall.name.split(':');
  const result = await mcpClientManager.callTool(serverId, toolName, state.toolCall.args);

  return {
    messages: [...state.messages, new AIMessage({ content: `[${toolName}] 结果: ${JSON.stringify(result)}` })],
    toolResult: result,
  };
}
```

**`src/graph/compiler.ts`**：

```typescript
// src/graph/compiler.ts
import { StateGraph } from '@langchain/langgraph';
import type { RouterState } from '../types/agent-state.js';
import { llmRouterNode } from './nodes/llm-router.js';
import { toolExecutorNode } from './nodes/tool-executor.js';

export function createAgentGraph() {
  const workflow = new StateGraph<RouterState>({
    channels: {
      messages: { value: (x: unknown[], y: unknown[]) => [...x, ...y], default: () => [] },
      activeModel: null,
      systemPrompt: null,
      toolCall: null,
      toolResult: null,
      finalResponse: null,
    },
  });

  workflow.addNode('route', llmRouterNode);
  workflow.addNode('execute_tool', toolExecutorNode);
  workflow.addEntryPoint('route');

  workflow.addConditionalEdges(
    'route',
    (state) => (state.toolCall ? 'execute_tool' : '__end__'),
    { execute_tool: 'execute_tool', __end__: '__end__' }
  );

  workflow.addEdge('execute_tool', 'route');
  return workflow.compile();
}
```

### Step 9: Agent 服务（含 SSE 集成）

**`src/services/agent.ts`**：

```typescript
// src/services/agent.ts
import { HumanMessage } from '@langchain/core/messages';
import { createAgentGraph } from '../graph/compiler.js';
import { listApiKeys, getMessages, appendMessage, listPrompts } from './storage.js';
import { getAdapter } from '../adapters/index.js';
import { mcpClientManager } from './mcp-client.js';
import type { SSEEmitter } from './sse-emitter.js';

const graph = createAgentGraph();

export async function runAgent(
  conversationId: string,
  userInput: string,
  emitter: SSEEmitter,
  model?: string
) {
  // 1. 保存用户消息
  appendMessage({ conversationId, role: 'user', content: userInput, model });

  // 2. 加载对话历史
  const history = getMessages(conversationId);
  const langchainMessages = history.map(m => {
    if (m.role === 'user') return new HumanMessage(m.content);
    return new AIMessage(m.content);
  });

  // 3. 获取 system prompt
  const prompts = listPrompts();
  const systemPrompt = prompts[0]?.systemPrompt || '你是 EasyAgent，一个智能助手。';

  // 4. 执行 Agent
  const activeModel = model || listApiKeys()[0]?.model || 'gpt-4o';

  try {
    const result = await graph.invoke({
      messages: langchainMessages,
      activeModel,
      systemPrompt,
      toolCall: null,
      toolResult: null,
      finalResponse: '',
    });

    const finalText = result.finalResponse || result.messages.at(-1)?.content as string || '';

    // 5. 保存助手回复
    appendMessage({ conversationId, role: 'assistant', content: finalText, model: activeModel });

    emitter.emit({ type: 'token', data: { content: finalText } });
    emitter.emit({ type: 'done', data: { conversationId } });
    emitter.end();

  } catch (err: any) {
    emitter.emit({ type: 'error', data: { message: err.message } });
    emitter.end();
  }
}
```

### Step 10: API 路由

**`src/routes/chat.ts`** — SSE 流式对话（核心路由）：

```typescript
// src/routes/chat.ts
import { Router } from 'express';
import { runAgent } from '../services/agent.js';
import { createConversation } from '../services/storage.js';
import { SSEEmitter } from '../services/sse-emitter.js';

const router = Router();

router.post('/', async (req, res) => {
  const { conversationId, message, model } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  const convId = conversationId || createConversation().id;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const emitter = new SSEEmitter(res);
  await runAgent(convId, message, emitter, model);
});

export default router;
```

**`src/routes/conversation.ts`** — 对话历史路由（新增）：

```typescript
// src/routes/conversation.ts
import { Router } from 'express';
import * as storage from '../services/storage.js';

const router = Router();

router.get('/', (_req, res) => res.json(storage.listConversations()));

router.post('/', (req, res) => {
  const { name } = req.body;
  res.status(201).json(storage.createConversation(name));
});

router.get('/:id/messages', (req, res) => {
  res.json(storage.getMessages(req.params.id));
});

router.patch('/:id', (req, res) => {
  const { name } = req.body;
  storage.updateConversationName(req.params.id, name)
    ? res.json({ ok: true })
    : res.status(404).json({ error: 'Not found' });
});

router.delete('/:id', (req, res) => {
  storage.deleteConversation(req.params.id) ? res.status(204).send() : res.status(404).json({ error: 'Not found' });
});

export default router;
```

**`src/routes/prompt.ts`** — Prompt 模板路由（新增）：

```typescript
// src/routes/prompt.ts
import { Router } from 'express';
import * as storage from '../services/storage.js';

const router = Router();

router.get('/', (_req, res) => res.json(storage.listPrompts()));

router.post('/', (req, res) => {
  const { name, description, systemPrompt, isBuiltin } = req.body;
  if (!name || !systemPrompt) return res.status(400).json({ error: 'name and systemPrompt required' });
  res.status(201).json(storage.createPrompt({ name, description, systemPrompt, isBuiltin }));
});

router.put('/:id', (req, res) => {
  const { name, description, systemPrompt } = req.body;
  storage.updatePrompt(req.params.id, { name, description, systemPrompt })
    ? res.json({ ok: true })
    : res.status(404).json({ error: 'Not found' });
});

router.delete('/:id', (req, res) => {
  storage.deletePrompt(req.params.id) ? res.status(204).send() : res.status(404).json({ error: 'Not found' });
});

export default router;
```

**`src/routes/keys.ts`**、`src/routes/mcp.ts`**、`src/routes/workflow.ts`** — 与前一版一致：

```typescript
// src/routes/keys.ts
import { Router } from 'express';
import * as storage from '../services/storage.js';

const router = Router();
router.get('/', (_req, res) => res.json(storage.listApiKeys()));
router.post('/', (req, res) => {
  const { provider, key, model } = req.body;
  if (!provider || !key || !model) return res.status(400).json({ error: 'required fields missing' });
  res.status(201).json(storage.createApiKey({ provider, key, model }));
});
router.delete('/:id', (req, res) => {
  storage.deleteApiKey(req.params.id) ? res.status(204).send() : res.status(404).json({ error: 'Not found' });
});
export default router;

// src/routes/mcp.ts
import { Router } from 'express';
import * as storage from '../services/storage.js';
import { mcpClientManager } from '../services/mcp-client.js';

const router = Router();
router.get('/servers', (_req, res) => res.json(storage.listMcpServers()));
router.post('/servers', async (req, res) => {
  const { name, type, command, url } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type required' });
  const server = storage.createMcpServer({ name, type, command, url, enabled: true });
  try { await mcpClientManager.addServer(server); res.status(201).json(server); }
  catch (e: any) { storage.deleteMcpServer(server.id); res.status(400).json({ error: e.message }); }
});
router.delete('/servers/:id', async (req, res) => {
  await mcpClientManager.removeServer(req.params.id);
  storage.deleteMcpServer(req.params.id) ? res.status(204).send() : res.status(404).json({ error: 'Not found' });
});
export default router;

// src/routes/workflow.ts
import { Router } from 'express';
import * as storage from '../services/storage.js';

const router = Router();
router.get('/', (_req, res) => res.json(storage.listWorkflows()));
router.post('/', (req, res) => {
  const { name, description, nodes, edges } = req.body;
  if (!name || !nodes || !edges) return res.status(400).json({ error: 'required fields missing' });
  res.status(201).json(storage.createWorkflow({ name, description, nodes, edges }));
});
router.get('/:id', (req, res) => {
  const wf = storage.getWorkflow(req.params.id);
  wf ? res.json(wf) : res.status(404).json({ error: 'Not found' });
});
router.delete('/:id', (req, res) => {
  storage.deleteWorkflow(req.params.id) ? res.status(204).send() : res.status(404).json({ error: 'Not found' });
});
export default router;
```

### Step 11: Express App 和入口

**`src/app.ts`**：

```typescript
// src/app.ts
import express from 'express';
import cors from 'cors';
import keysRouter from './routes/keys.js';
import mcpRouter from './routes/mcp.js';
import workflowRouter from './routes/workflow.js';
import chatRouter from './routes/chat.js';
import conversationRouter from './routes/conversation.js';
import promptRouter from './routes/prompt.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.use('/api/keys', keysRouter);
  app.use('/api/mcp', mcpRouter);
  app.use('/api/workflows', workflowRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/conversations', conversationRouter);
  app.use('/api/prompts', promptRouter);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Error]', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}
```

**`src/index.ts`**：

```typescript
// src/index.ts
import { createApp } from './app.js';
import { initDatabase, closeDb } from './db/index.js';
import { config } from './config.js';

async function main() {
  console.log('[Server] Starting EasyAgent Server...');
  await initDatabase();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[Server] http://localhost:${config.port}`);
    console.log(`[Server] Health: http://localhost:${config.port}/health`);
  });

  const shutdown = () => {
    console.log('\n[Server] Shutting down...');
    server.close(() => { closeDb(); process.exit(0); });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => { console.error('[Server] Fatal:', err); process.exit(1); });
```

---

## 4. 启动和验证

```bash
npm run dev
```

```bash
# 健康检查
curl http://localhost:3000/health

# API Key
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{"provider":"openai","key":"sk-xxx","model":"gpt-4o"}'

# 对话历史
curl http://localhost:3000/api/conversations

# 创建对话
curl -X POST http://localhost:3000/api/conversations \
  -H "Content-Type: application/json" \
  -d '{"name":"健身助手"}'

# Prompt 模板
curl http://localhost:3000/api/prompts

# 创建 Prompt
curl -X POST http://localhost:3000/api/prompts \
  -H "Content-Type: application/json" \
  -d '{"name":"健身助手","systemPrompt":"你是一个专业的健身助手，帮助用户制定训练计划。"}'
```

---

## 5. 下一步推进顺序

```
1. Step 1-2  → 项目骨架 + 数据库（包含新表）
2. Step 3     → 验证模型适配器工厂（切换 OpenAI/Claude）
3. Step 4-5  → 验证 CRUD（Key / Workflow / Conversation / Prompt）
4. Step 6     → 验证 MCP 连接一个真实 Server
5. Step 7-8  → LangGraph 图执行（加日志确认每步）
6. Step 9     → SSE 对话（curl 验证流式响应）
7. Step 10-11 → 串联所有路由，对接前端
```

---

*文档版本: v0.1.0 | 最后更新: 2026-05-25*
