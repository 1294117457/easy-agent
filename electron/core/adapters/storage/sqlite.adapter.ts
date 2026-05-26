import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { IStoragePort } from '../../ports/storage.port.js';
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
  Workflow,
} from '../../domain/types.js';

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
      .get(id) as { encrypted_key: string } | undefined;
    return row ? this.encryptor.decrypt(row.encrypted_key) : null;
  }

  deleteApiKey(id: string): boolean {
    return this.db.prepare(`DELETE FROM api_keys WHERE id = ?`).run(id).changes > 0;
  }

  createConversation(data?: CreateConversationDTO): Conversation {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO conversations (id, name, workflow_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, data?.name || '新对话', data?.workflowId || null, now, now);
    return {
      id,
      name: data?.name || '新对话',
      workflowId: data?.workflowId,
      createdAt: now,
      updatedAt: now,
    };
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

  createPrompt(data: CreatePromptDTO): Prompt {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO prompts (id, name, description, system_prompt, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.name,
        data.description || '',
        data.systemPrompt,
        data.isBuiltin ? 1 : 0,
        now,
        now
      );
    return {
      id,
      name: data.name,
      description: data.description,
      systemPrompt: data.systemPrompt,
      isBuiltin: !!data.isBuiltin,
      createdAt: now,
      updatedAt: now,
    };
  }

  listPrompts(): Prompt[] {
    return this.db
      .prepare(`SELECT * FROM prompts ORDER BY is_builtin DESC, created_at DESC`)
      .all() as Prompt[];
  }

  updatePrompt(id: string, data: Partial<Prompt>): boolean {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (data.name) { sets.push('name = ?'); vals.push(data.name); }
    if (data.systemPrompt) { sets.push('system_prompt = ?'); vals.push(data.systemPrompt); }
    if (!sets.length) return false;
    sets.push('updated_at = ?');
    vals.push(new Date().toISOString());
    vals.push(id);
    return this.db
      .prepare(`UPDATE prompts SET ${sets.join(', ')} WHERE id = ?`)
      .run(...vals).changes > 0;
  }

  deletePrompt(id: string): boolean {
    return this.db.prepare(`DELETE FROM prompts WHERE id = ?`).run(id).changes > 0;
  }

  createWorkflow(data: {
    name: string;
    description?: string;
    nodes: unknown[];
    edges: unknown[];
  }): Workflow {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO workflows (id, name, description, graph_data, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'idle', ?, ?)`
      )
      .run(
        id,
        data.name,
        data.description || '',
        JSON.stringify({ nodes: data.nodes, edges: data.edges }),
        now,
        now
      );
    return {
      id,
      name: data.name,
      description: data.description,
      nodes: data.nodes as Workflow['nodes'],
      edges: data.edges as Workflow['edges'],
      status: 'idle',
      createdAt: now,
      updatedAt: now,
    };
  }

  listWorkflows(): Workflow[] {
    return this.db
      .prepare(`SELECT * FROM workflows ORDER BY updated_at DESC`)
      .all() as Workflow[];
  }

  getWorkflow(id: string): Workflow | null {
    return this.db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(id) as Workflow | null;
  }

  updateWorkflow(id: string, data: Partial<Workflow>): Workflow | null {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (data.name) { sets.push('name = ?'); vals.push(data.name); }
    if (data.status) { sets.push('status = ?'); vals.push(data.status); }
    if (!sets.length) return null;
    sets.push('updated_at = ?');
    vals.push(new Date().toISOString());
    vals.push(id);
    this.db
      .prepare(`UPDATE workflows SET ${sets.join(', ')} WHERE id = ?`)
      .run(...vals);
    return this.getWorkflow(id);
  }

  deleteWorkflow(id: string): boolean {
    return this.db.prepare(`DELETE FROM workflows WHERE id = ?`).run(id).changes > 0;
  }

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
      stmt.run(
        uuidv4(),
        serverId,
        t.name,
        t.description,
        JSON.stringify(t.inputSchema),
        t.enabled ? 1 : 0
      );
    }
  }

  listMcpTools(serverId: string): McpTool[] {
    return this.db
      .prepare(`SELECT * FROM mcp_tools WHERE server_id = ?`)
      .all(serverId) as McpTool[];
  }

  close(): void {
    this.db.close();
  }
}
