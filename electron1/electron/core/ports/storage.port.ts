import type { Database } from 'better-sqlite3';
import type {
  ApiKey,
  Conversation,
  Message,
  Prompt,
  McpServer,
  McpTool,
  Workflow,
} from '../domain/types.js';

export interface CreateApiKeyDTO {
  provider: string;
  key: string;
  model: string;
  baseURL?: string;
}

export interface CreateConversationDTO {
  name?: string;
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
  // 数据库访问（供 Repository Adapter 使用）
  getDatabase(): Database;
  getDecryptor(): (encrypted: string) => string;

  createApiKey(data: CreateApiKeyDTO): ApiKey;
  listApiKeys(): ApiKey[];
  getDecryptedKey(id: string): string | null;
  deleteApiKey(id: string): boolean;

  createConversation(data?: CreateConversationDTO): Conversation;
  listConversations(): Conversation[];
  getMessages(convId: string): Message[];
  appendMessage(data: AppendMessageDTO): Message;
  deleteConversation(id: string): boolean;
  renameConversation(id: string, name: string): boolean;
  touchConversation(id: string): void;
  compressConversation(id: string, summary: string): boolean;
  endConversation(id: string, title: string): boolean;
  getMessageCount(convId: string): number;
  updateMessageCompressed(messageId: string, isCompressed: boolean): boolean;

  createPrompt(data: CreatePromptDTO): Prompt;
  listPrompts(): Prompt[];
  getActivePrompt(): Prompt | null;
  setActivePrompt(id: string): void;
  updatePrompt(id: string, data: Partial<Prompt>): boolean;
  deletePrompt(id: string): boolean;

  createWorkflow(data: {
    name: string;
    description?: string;
    nodes: unknown[];
    edges: unknown[];
  }): Workflow;
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
