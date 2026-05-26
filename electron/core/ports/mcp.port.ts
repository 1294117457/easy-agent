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
