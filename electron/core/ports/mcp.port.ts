import type { McpTool } from '../domain/types.js';

export interface ToolCallEvent {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface McpConnectionConfig {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface IMcpPort {
  connect(server: McpConnectionConfig): Promise<void>;
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
