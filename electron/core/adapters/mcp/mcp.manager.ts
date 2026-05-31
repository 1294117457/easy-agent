import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { IMcpPort } from '../../ports/mcp.port.js';
import type { McpServer, McpTool, McpConfig, McpConfigServer } from '../types.js';

interface ConnectedServer {
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport;
}

export class McpManager implements IMcpPort {
  private servers: Map<string, ConnectedServer> = new Map();
  private toolCallCallbacks: Set<(event: import('../../ports/mcp.port.js').ToolCallEvent) => void> = new Set();
  private disconnectCallbacks: Set<(serverId: string) => void> = new Set();

  async connect(server: McpServer): Promise<void> {
    if (this.servers.has(server.id)) {
      console.log(`[McpManager] Server ${server.id} already connected`);
      return;
    }

    let client: Client;
    let transport: StdioClientTransport | StreamableHTTPClientTransport;

    if (server.type === 'stdio') {
      if (!server.command) {
        throw new Error(`Server ${server.id} missing command for stdio connection`);
      }

      console.log(`[McpManager] Connecting to ${server.id} via stdio: ${server.command}`);
      transport = new StdioClientTransport({
        command: server.command,
        args: server.args || [],
        env: server.env || {},
      });
    } else if (server.type === 'sse' || server.type === 'http') {
      if (!server.url) {
        throw new Error(`Server ${server.id} missing url for http connection`);
      }

      console.log(`[McpManager] Connecting to ${server.id} via HTTP: ${server.url}`);
      console.log(`[McpManager] Headers:`, server.headers);

      transport = new StreamableHTTPClientTransport(new URL(server.url), {
        requestInit: {
          headers: server.headers || {},
        },
      });
    } else {
      throw new Error(`Unsupported server type: ${server.type}`);
    }

    client = new Client({
      name: 'easy-agent',
      version: '1.0.0',
    });

    try {
      console.log(`[McpManager] Starting connection to ${server.id}...`);
      await client.connect(transport);
      console.log(`[McpManager] Successfully connected to server: ${server.id} (${server.type})`);
      this.servers.set(server.id, { client, transport });
    } catch (error) {
      console.error(`[McpManager] Failed to connect to ${server.id}:`, error);
      throw error;
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      console.log(`[McpManager] Server ${serverId} not connected`);
      return;
    }

    await server.client.close();
    this.servers.delete(serverId);
    this.disconnectCallbacks.forEach(cb => cb(serverId));
    console.log(`[McpManager] Disconnected from server: ${serverId}`);
  }

  isConnected(serverId: string): boolean {
    return this.servers.has(serverId);
  }

  async listTools(serverId: string): Promise<McpTool[]> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not connected`);
    }

    const response = await server.client.listTools();
    return response.tools.map(tool => ({
      id: `${serverId}:${tool.name}`,
      serverId,
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema as Record<string, unknown>,
      enabled: true,
    }));
  }

  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not connected`);
    }

    const toolCallEvent = { serverId, toolName, arguments: args };
    this.toolCallCallbacks.forEach(cb => cb(toolCallEvent));

    const result = await server.client.callTool({
      name: toolName,
      arguments: args,
    });

    // 确保结果是可序列化的（JSON 安全）
    return JSON.parse(JSON.stringify(result));
  }

  onToolCall(callback: (event: import('../../ports/mcp.port.js').ToolCallEvent) => void): void {
    this.toolCallCallbacks.add(callback);
  }

  onDisconnect(callback: (serverId: string) => void): void {
    this.disconnectCallbacks.add(callback);
  }

  async disconnectAll(): Promise<void> {
    const serverIds = Array.from(this.servers.keys());
    await Promise.all(serverIds.map(id => this.disconnect(id)));
  }

  // 解析 MCP Config（.mcp.json 格式）
  parseMcpConfig(configText: string): McpConfig {
    try {
      const config = JSON.parse(configText);

      // 检查是否是完整格式（包含 servers 和 inputs）
      if (config.servers && config.inputs) {
        return config as McpConfig;
      }

      // 检查是否是 servers 格式
      if (config.servers && !config.inputs) {
        return config as McpConfig;
      }

      // 兼容单个 server 格式
      if (config.type || config.url || config.command) {
        return {
          servers: { default: config as McpConfigServer },
          inputs: [],
        };
      }

      throw new Error('Invalid MCP config format');
    } catch (error) {
      throw new Error(`Failed to parse MCP config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 解析 inputs 并替换占位符
  resolveInputs(config: McpConfig, inputValues: Record<string, string>): McpConfig {
    const resolved = JSON.parse(JSON.stringify(config)) as McpConfig;

    for (const serverConfig of Object.values(resolved.servers)) {
      if (serverConfig.headers) {
        for (const [key, value] of Object.entries(serverConfig.headers)) {
          // 替换 ${input:id} 占位符
          const match = value.match(/\$\{([^}]+)\}/);
          if (match) {
            const inputId = match[1];
            if (inputValues[inputId]) {
              serverConfig.headers[key] = value.replace(/\$\{[^}]+\}/, inputValues[inputId]);
            }
          }
        }
      }

      if (serverConfig.env) {
        for (const [key, value] of Object.entries(serverConfig.env)) {
          const match = value.match(/\$\{([^}]+)\}/);
          if (match) {
            const inputId = match[1];
            if (inputValues[inputId]) {
              serverConfig.env[key] = value.replace(/\$\{[^}]+\}/, inputValues[inputId]);
            }
          }
        }
      }
    }

    return resolved;
  }

  // 获取配置中需要的 inputs
  getRequiredInputs(config: McpConfig): McpConfig['inputs'] {
    return config.inputs || [];
  }
}
