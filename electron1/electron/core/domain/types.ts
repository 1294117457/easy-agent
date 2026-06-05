export type MessageRole = 'user' | 'assistant' | 'system';
export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
export type AgentStatus = 'idle' | 'thinking' | 'working' | 'happy' | 'error';
export type NodeType = 'input' | 'llm' | 'mcp_tool' | 'output' | 'condition';

export interface Position {
  x: number;
  y: number;
}

export interface NodeConfig {
  mcpServerId?: string;
  toolName?: string;
  model?: string;
  systemPrompt?: string;
  condition?: string;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  position: Position;
  config: NodeConfig;
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
  isCompressed?: boolean;
}

export interface Conversation {
  id: string;
  name: string;
  workflowId?: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
}

export interface Prompt {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  isBuiltin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// MCP Config 解析类型（对应 .mcp.json 格式）
export interface McpConfigServer {
  type?: 'stdio' | 'http';
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface McpConfigInput {
  type: 'promptString';
  id: string;
  description: string;
  password?: boolean;
}

export interface McpConfig {
  servers: Record<string, McpConfigServer>;
  inputs?: McpConfigInput[];
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
  baseURL?: string;
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
