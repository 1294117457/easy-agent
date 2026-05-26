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

  createPrompt(data: CreatePromptDTO): Prompt;
  listPrompts(): Prompt[];
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
