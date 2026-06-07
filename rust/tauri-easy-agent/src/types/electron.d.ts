// ============ Tauri 类型定义 ============
// 迁移自 electron.d.ts，将 Electron IPC API 替换为 Tauri invoke + listen

// ============ 事件 Payload 类型 ============
export interface TokenPayload {
  conversationId: string;
  token: string;
}

export interface DonePayload {
  conversationId: string;
}

export interface ErrorPayload {
  conversationId: string;
  error: string;
}

export interface MessagesSyncedPayload {
  conversationId: string;
  newMessages: unknown[];
}

export interface ToolCallPayload {
  serverId: string;
  toolName: string;
  args: unknown;
}

// ============ Tauri Commands 返回类型 ============

// 通用响应
export interface ApiResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============ 聊天模块 ============
export interface ConversationRecord {
  id: string;
  name: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  isCompressed?: boolean;
}

export interface CompressResult {
  summary: string;
  title: string;
}

// ============ 配置模块 ============
export interface ApiKeyRecord {
  id: string;
  provider: string;
  model: string;
  key: string;
  baseURL?: string;
  enabled: boolean;
  createdAt: string;
}

export interface PromptRecord {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  isBuiltin: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface LLMConfigRecord {
  keyId: string;
  provider: string;
  model: string;
}

export interface LLMProviderRecord {
  id: string;
  name: string;
  models: string[];
}

export interface TestConnectionResult {
  success: boolean;
  message?: string;
}

// ============ MCP 模块 ============
export interface McpServerRecord {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  enabled: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  createdAt: string;
}

export interface McpToolRecord {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpListServersResult {
  success: boolean;
  servers: McpServerRecord[];
}

export interface McpParseConfigResult {
  success: boolean;
  servers?: Record<string, unknown>;
  inputs?: unknown[];
  error?: string;
}

export interface McpConnectWithConfigResult {
  success: boolean;
  server?: McpServerRecord;
  results?: Array<{ name?: string; success: boolean; error?: string }>;
  error?: string;
}

// ============ Plugin 模块 ============
export interface PluginRecord {
  id: string;
  name: string;
  description: string;
  serverId: string;
  toolNames: string[];
}

// ============ Workflow 模块 ============
export interface StandardSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    required?: boolean;
    default?: unknown;
  }>;
  required?: string[];
}

export interface WorkflowNodeRecord {
  id: string;
  name: string;
  description?: string;
  pluginId: string;
  toolName: string;
  inputSchema: StandardSchema;
  outputSchema: StandardSchema;
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
}

export interface WorkflowEdgeRecord {
  id: string;
  sourceNodeId: string;
  sourceField: string;
  targetNodeId: string;
  targetField: string;
}

export interface WorkflowRecord {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

// ============ 全局窗口接口 ============
// 定义 window.tauriAPI，供前端代码使用
// 注意：这些是前端期望调用的接口签名，实际 Tauri 后端命令名可能不同
// 后端实现时请按这些接口签名来实现 #[tauri::command]
export interface TauriAPI {
  // ============ 调试命令 ============
  ping(): Promise<string>;

  // ============ 聊天命令 ============
  sendMessage(conversationId: string, message: string): Promise<void>;
  getHistory(conversationId: string): Promise<MessageRecord[]>;
  getConversations(): Promise<ConversationRecord[]>;
  newConversation(): Promise<{ id: string; name: string }>;
  deleteConversation(conversationId: string): Promise<boolean>;
  compressConversation(conversationId: string): Promise<CompressResult | null>;
  endConversation(conversationId: string): Promise<void>;

  // ============ 配置命令 ============
  getConfig(): Promise<{
    apiKeys: ApiKeyRecord[];
    prompts: PromptRecord[];
    llmConfig: LLMConfigRecord | null;
  }>;
  createApiKey(data: { provider: string; key: string; model: string; baseURL?: string }): Promise<ApiKeyRecord>;
  deleteApiKey(id: string): Promise<boolean>;
  createPrompt(data: { name: string; description?: string; systemPrompt: string }): Promise<PromptRecord>;
  deletePrompt(id: string): Promise<boolean>;
  setActivePrompt(id: string): Promise<boolean>;
  getActivePrompt(): Promise<PromptRecord | null>;

  // ============ LLM 命令 ============
  setActiveKey(keyId: string): Promise<void>;
  getActiveLLMConfig(): Promise<LLMConfigRecord | null>;
  listLLMProviders(): Promise<LLMProviderRecord[]>;
  testLLMConnection(data: { provider: string; apiKey: string; model: string; baseURL?: string }): Promise<TestConnectionResult>;

  // ============ MCP 命令 ============
  mcpList(): Promise<McpListServersResult>;
  mcpGet(id: string): Promise<McpServerRecord | null>;
  mcpSave(data: {
    id?: string;
    name: string;
    type: 'stdio' | 'sse' | 'http';
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    headers?: Record<string, string>;
    enabled?: boolean;
  }): Promise<ApiResult<McpServerRecord>>;
  mcpUpdate(id: string, updates: Partial<McpServerRecord>): Promise<ApiResult<McpServerRecord>>;
  mcpDelete(id: string): Promise<ApiResult<void>>;
  mcpConnect(id: string): Promise<ApiResult<void>>;
  mcpDisconnect(id: string): Promise<ApiResult<void>>;
  mcpReconnect(id: string): Promise<ApiResult<void>>;
  mcpIsConnected(id: string): Promise<boolean>;
  mcpListTools(id: string): Promise<ApiResult<McpToolRecord[]>>;
  mcpCallTool(id: string, toolName: string, args: unknown): Promise<ApiResult<unknown>>;
  mcpParseConfig(configText: string): Promise<McpParseConfigResult>;
  mcpConnectWithConfig(configText: string, inputValues: Record<string, string>): Promise<McpConnectWithConfigResult>;

  // ============ Plugin 命令 ============
  pluginCreate(data: { name: string; description: string; serverId: string; toolNames: string[] }): Promise<ApiResult<PluginRecord>>;
  pluginList(): Promise<ApiResult<PluginRecord[]>>;
  pluginGet(id: string): Promise<ApiResult<PluginRecord>>;
  pluginDelete(id: string): Promise<ApiResult<void>>;

  // ============ WorkflowNode 命令 ============
  nodeCreate(data: {
    name: string;
    description?: string;
    pluginId: string;
    toolName: string;
    inputSchema: StandardSchema;
    outputSchema: StandardSchema;
    inputMapping: Record<string, string>;
    outputMapping: Record<string, string>;
  }): Promise<ApiResult<WorkflowNodeRecord>>;
  nodeExecute(nodeId: string, input: unknown): Promise<ApiResult<unknown>>;
  nodeList(): Promise<ApiResult<WorkflowNodeRecord[]>>;
  nodeListByPlugin(pluginId: string): Promise<ApiResult<WorkflowNodeRecord[]>>;
  nodeUpdate(id: string, data: Partial<WorkflowNodeRecord>): Promise<ApiResult<WorkflowNodeRecord>>;
  nodeDelete(id: string): Promise<ApiResult<void>>;

  // ============ Workflow 命令 ============
  workflowCreate(data: { name: string; description?: string }): Promise<ApiResult<WorkflowRecord>>;
  workflowList(): Promise<ApiResult<WorkflowRecord[]>>;
  workflowGet(id: string): Promise<ApiResult<WorkflowRecord>>;
  workflowAddNode(workflowId: string, nodeId: string): Promise<ApiResult<void>>;
  workflowRemoveNode(workflowId: string, nodeId: string): Promise<ApiResult<void>>;
  workflowConnect(workflowId: string, sourceNodeId: string, sourceField: string, targetNodeId: string, targetField: string): Promise<ApiResult<WorkflowEdgeRecord>>;
  workflowDisconnect(workflowId: string, edgeId: string): Promise<ApiResult<void>>;
  workflowValidate(workflowId: string): Promise<ApiResult<{ valid: boolean; errors: string[] }>>;
  workflowExecute(workflowId: string, input: unknown): Promise<ApiResult<void>>;
  workflowUpdate(id: string, data: Partial<WorkflowRecord>): Promise<ApiResult<WorkflowRecord>>;
  workflowDelete(id: string): Promise<ApiResult<void>>;
  workflowGetNodes(workflowId: string): Promise<ApiResult<WorkflowNodeRecord[]>>;

  // ============ 调试用 ============
  getListenerCount(): { token: number; done: number; error: number; messagesSynced: number };
  resetListenerCounters(): void;
}

declare global {
  interface Window {
    electronAPI: TauriAPI;
  }
}

export {};
