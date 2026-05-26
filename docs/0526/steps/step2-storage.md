# Step 2: Storage 存储

> 版本: v0.1.0 MVP
> 日期: 2026-05-26
> 前置：Step 1 Electron 骨架已完成
> 目标：能添加 API Key，能保存对话历史，数据重启后还在

---

## 1. 安装依赖

```bash
cd electron
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

## 2. 创建目录结构

```bash
cd electron/core
mkdir -p domain ports adapters/storage adapters/http
```

## 3. 创建 domain/types.ts

```typescript
// electron/core/domain/types.ts

// ========== 枚举 ==========

export type MessageRole = 'user' | 'assistant' | 'system';
export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed';
export type NodeType = 'input' | 'llm' | 'mcp_tool' | 'output' | 'condition';

// ========== 基础类型 ==========

export interface Position {
  x: number;
  y: number;
}

// ========== 值对象（接口，无行为）==========

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  position: Position;
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

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  model?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  name: string;
  workflowId?: string;
  createdAt: string;
  updatedAt: string;
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

// ========== DTO ==========

export interface CreateConversationDTO {
  name?: string;
}

export interface AppendMessageDTO {
  conversationId: string;
  role: MessageRole;
  content: string;
  model?: string;
}

export interface CreateApiKeyDTO {
  provider: string;
  key: string;
  model: string;
}

export interface CreatePromptDTO {
  name: string;
  description?: string;
  systemPrompt: string;
  isBuiltin?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}
```

## 4. 创建 ports/storage.port.ts

```typescript
// electron/core/ports/storage.port.ts
import type {
  ApiKey,
  Conversation,
  Message,
  Prompt,
  CreateApiKeyDTO,
  CreateConversationDTO,
  AppendMessageDTO,
  CreatePromptDTO,
} from '../domain/types.js';

export interface IStoragePort {
  // ========== API Key ==========
  createApiKey(data: CreateApiKeyDTO): ApiKey;
  listApiKeys(): ApiKey[];
  getDecryptedKey(id: string): string | null;
  deleteApiKey(id: string): boolean;

  // ========== Conversation ==========
  createConversation(data?: CreateConversationDTO): Conversation;
  listConversations(): Conversation[];
  getMessages(convId: string): Message[];
  appendMessage(data: AppendMessageDTO): Message;
  deleteConversation(id: string): boolean;
  renameConversation(id: string, name: string): boolean;

  // ========== Prompt ==========
  createPrompt(data: CreatePromptDTO): Prompt;
  listPrompts(): Prompt[];
  updatePrompt(id: string, data: Partial<Prompt>): boolean;
  deletePrompt(id: string): boolean;

  // ========== Workflow ==========
  createWorkflow(data: { name: string; description?: string; nodes: any[]; edges: any[] }): Workflow;
  listWorkflows(): Workflow[];
  getWorkflow(id: string): Workflow | null;
  updateWorkflow(id: string, data: Partial<Workflow>): Workflow | null;
  deleteWorkflow(id: string): boolean;

  // ========== MCP ==========
  createMcpServer(data: Omit<McpServer, 'id'>): McpServer;
  listMcpServers(): McpServer[];
  deleteMcpServer(id: string): boolean;
  saveMcpTools(serverId: string, tools: McpTool[]): void;
  listMcpTools(serverId: string): McpTool[];
}
```

## 5. 创建 adapters/storage/sqlite.adapter.ts

```typescript
// electron/core/adapters/storage/sqlite.adapter.ts
import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { IStoragePort } from '../../../ports/storage.port.js';
import type {
  ApiKey,
  Conversation,
  Message,
  Prompt,
  McpServer,
  McpTool,
  CreateApiKeyDTO,
  CreateConversationDTO,
  AppendMessageDTO,
  CreatePromptDTO,
} from '../../../domain/types.js';

// ========== API Key 加密工具 ==========

class KeyEncryptor {
  private key: Buffer;

  constructor(password: string) {
    const salt = crypto.scryptSync(password, 'easy-agent-salt', 32);
    this.key = crypto.scryptSync(password, salt, 32, { N: 2 ** 14, r: 8, p: 1 });
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(data: string): string {
    const [ivHex, authTagHex, encrypted] = data.split(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }
}

// ========== 建表语句 ==========

const SCHEMA = `
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    model TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '新对话',
    workflow_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    graph_data TEXT NOT NULL,
    status TEXT DEFAULT 'idle',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    command TEXT,
    url TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mcp_tools (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    input_schema TEXT,
    enabled INTEGER DEFAULT 1
);
`;

// ========== SQLite Adapter ==========

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

  // ========== API Key ==========

  createApiKey(data: CreateApiKeyDTO): ApiKey {
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO api_keys (id, provider, encrypted_key, model) VALUES (?, ?, ?, ?)`
      )
      .run(id, data.provider, this.encryptor.encrypt(data.key), data.model);
    return { id, provider: data.provider, model: data.model, enabled: true };
  }

  listApiKeys(): ApiKey[] {
    return this.db
      .prepare(`SELECT id, provider, model, enabled FROM api_keys`)
      .all() as ApiKey[];
  }

  getDecryptedKey(id: string): string | null {
    const row = this.db
      .prepare(`SELECT encrypted_key FROM api_keys WHERE id = ?`)
      .get(id) as any;
    return row ? this.encryptor.decrypt(row.encrypted_key) : null;
  }

  deleteApiKey(id: string): boolean {
    return this.db.prepare(`DELETE FROM api_keys WHERE id = ?`).run(id).changes > 0;
  }

  // ========== Conversation ==========

  createConversation(data?: CreateConversationDTO): Conversation {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO conversations (id, name, workflow_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, data?.name || '新对话', data?.workflowId || null, now, now);
    return { id, name: data?.name || '新对话', workflowId: data?.workflowId, createdAt: now, updatedAt: now };
  }

  listConversations(): Conversation[] {
    return this.db
      .prepare(`SELECT * FROM conversations ORDER BY updated_at DESC`)
      .all() as Conversation[];
  }

  getMessages(convId: string): Message[] {
    return this.db
      .prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`)
      .all(convId) as Message[];
  }

  appendMessage(data: AppendMessageDTO): Message {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, model, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, data.conversationId, data.role, data.content, data.model || null, now);
    this.db
      .prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`)
      .run(now, data.conversationId);
    return { id, ...data, createdAt: now };
  }

  deleteConversation(id: string): boolean {
    return this.db.prepare(`DELETE FROM conversations WHERE id = ?`).run(id).changes > 0;
  }

  renameConversation(id: string, name: string): boolean {
    return this.db
      .prepare(`UPDATE conversations SET name = ?, updated_at = ? WHERE id = ?`)
      .run(name, new Date().toISOString(), id).changes > 0;
  }

  // ========== Prompt ==========

  createPrompt(data: CreatePromptDTO): Prompt {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO prompts (id, name, description, system_prompt, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, data.name, data.description || '', data.systemPrompt, data.isBuiltin ? 1 : 0, now, now);
    return { id, name: data.name, description: data.description, systemPrompt: data.systemPrompt, isBuiltin: !!data.isBuiltin, createdAt: now, updatedAt: now };
  }

  listPrompts(): Prompt[] {
    return this.db
      .prepare(`SELECT * FROM prompts ORDER BY is_builtin DESC, created_at DESC`)
      .all() as Prompt[];
  }

  updatePrompt(id: string, data: Partial<Prompt>): boolean {
    const sets: string[] = [];
    const vals: any[] = [];
    if (data.name) { sets.push('name = ?'); vals.push(data.name); }
    if (data.systemPrompt) { sets.push('system_prompt = ?'); vals.push(data.systemPrompt); }
    if (!sets.length) return false;
    sets.push('updated_at = ?'); vals.push(new Date().toISOString()); vals.push(id);
    return this.db.prepare(`UPDATE prompts SET ${sets.join(', ')} WHERE id = ?`).run(...vals).changes > 0;
  }

  deletePrompt(id: string): boolean {
    return this.db.prepare(`DELETE FROM prompts WHERE id = ?`).run(id).changes > 0;
  }

  // ========== Workflow ==========

  createWorkflow(data: { name: string; description?: string; nodes: any[]; edges: any[] }): Workflow {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO workflows (id, name, description, graph_data, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'idle', ?, ?)`
      )
      .run(id, data.name, data.description || '', JSON.stringify({ nodes: data.nodes, edges: data.edges }), now, now);
    return { id, name: data.name, description: data.description, nodes: data.nodes, edges: data.edges, status: 'idle', createdAt: now, updatedAt: now };
  }

  listWorkflows(): Workflow[] {
    return this.db.prepare(`SELECT * FROM workflows ORDER BY updated_at DESC`).all() as Workflow[];
  }

  getWorkflow(id: string): Workflow | null {
    return this.db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(id) as Workflow | null;
  }

  updateWorkflow(id: string, data: Partial<Workflow>): Workflow | null {
    const sets: string[] = [];
    const vals: any[] = [];
    if (data.name) { sets.push('name = ?'); vals.push(data.name); }
    if (data.status) { sets.push('status = ?'); vals.push(data.status); }
    if (data.nodes) { sets.push('graph_data = ?'); vals.push(JSON.stringify({ nodes: data.nodes, edges: data.edges })); }
    if (!sets.length) return null;
    sets.push('updated_at = ?'); vals.push(new Date().toISOString()); vals.push(id);
    this.db.prepare(`UPDATE workflows SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return this.getWorkflow(id);
  }

  deleteWorkflow(id: string): boolean {
    return this.db.prepare(`DELETE FROM workflows WHERE id = ?`).run(id).changes > 0;
  }

  // ========== MCP ==========

  createMcpServer(data: Omit<McpServer, 'id'>): McpServer {
    const id = uuidv4();
    this.db
      .prepare(`INSERT INTO mcp_servers (id, name, type, command, url, enabled) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, data.name, data.type, data.command || null, data.url || null, data.enabled ? 1 : 0);
    return { id, ...data };
  }

  listMcpServers(): McpServer[] {
    return this.db.prepare(`SELECT * FROM mcp_servers`).all() as McpServer[];
  }

  deleteMcpServer(id: string): boolean {
    return this.db.prepare(`DELETE FROM mcp_servers WHERE id = ?`).run(id).changes > 0;
  }

  saveMcpTools(serverId: string, tools: McpTool[]): void {
    this.db.prepare(`DELETE FROM mcp_tools WHERE server_id = ?`).run(serverId);
    const stmt = this.db.prepare(
      `INSERT INTO mcp_tools (id, server_id, name, description, input_schema, enabled) VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const t of tools) {
      stmt.run(uuidv4(), serverId, t.name, t.description, JSON.stringify(t.inputSchema), t.enabled ? 1 : 0);
    }
  }

  listMcpTools(serverId: string): McpTool[] {
    return this.db.prepare(`SELECT * FROM mcp_tools WHERE server_id = ?`).all(serverId) as McpTool[];
  }

  // ========== 关闭数据库 ==========

  close(): void {
    this.db.close();
  }
}
```

## 6. 更新 core/index.ts

```typescript
// electron/core/index.ts
import type { IStoragePort } from './ports/storage.port.js';
import { SQLiteAdapter } from './adapters/storage/sqlite.adapter.js';

export class EasyAgentCore {
  private storage: IStoragePort;

  constructor(storage: IStoragePort) {
    this.storage = storage;
  }

  getStorage(): IStoragePort {
    return this.storage;
  }
}

// 导出类型
export type { IStoragePort } from './ports/storage.port.js';
export * from './domain/types.js';
```

## 7. 更新 main.ts（注入 Storage）

```typescript
// electron/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { EasyAgentCore } from './core/index.js';
import { SQLiteAdapter } from './core/adapters/storage/sqlite.adapter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow;
let core: EasyAgentCore;

function getDbPath() {
  // 数据存到用户目录下
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
  core = new EasyAgentCore(storage);

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

## 8. 验证

### 启动

```bash
cd electron
npm run dev
```

### 测试（打开 DevTools，控制台）

```javascript
// 获取 Storage
const storage = core.getStorage();

// 添加 API Key
storage.createApiKey({ provider: 'openai', key: 'sk-test123456', model: 'gpt-4o' })

// 列出 API Key
storage.listApiKeys()
// 预期：[{ id: 'xxx', provider: 'openai', model: 'gpt-4o', enabled: true }]

// 解密（验证加密是否正确）
storage.getDecryptedKey('xxx')
// 预期：'sk-test123456'

// 创建对话
storage.createConversation({ name: '测试对话' })

// 列出对话
storage.listConversations()
// 预期：[{ id: 'xxx', name: '测试对话', ... }]

// 添加消息
const conv = storage.listConversations()[0]
storage.appendMessage({ conversationId: conv.id, role: 'user', content: '你好' })
storage.appendMessage({ conversationId: conv.id, role: 'assistant', content: '你好！有什么可以帮你的？' })

// 获取消息
storage.getMessages(conv.id)
// 预期：2 条消息
```

### 重启测试（持久化验证）

```bash
# 关闭应用
# 重新启动
npm run dev

# DevTools 中
storage.listApiKeys()
// 预期：API Key 还在
storage.listConversations()
// 预期：对话还在
```

---

## 完成后检查清单

```
✅ better-sqlite3 已安装
✅ domain/types.ts 已创建（所有类型定义）
✅ ports/storage.port.ts 已创建（接口定义）
✅ adapters/storage/sqlite.adapter.ts 已创建（完整实现）
✅ core/index.ts 已更新（EasyAgentCore 注入 Storage）
✅ main.ts 已更新（创建 SQLiteAdapter）
✅ createApiKey / listApiKeys / getDecryptedKey 正常工作
✅ createConversation / appendMessage / getMessages 正常工作
✅ 重启后数据还在（持久化验证）
```

---

*文档版本: v0.1.0 | 最后更新: 2026-05-26*
