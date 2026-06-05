import type { McpServer, McpServerProps } from '../domain/entities/McpServer.js';
import type { McpServerRepository } from '../ports/persistence/McpServerRepository.js';
import type { IMcpPort } from '../ports/mcp.port.js';
import type { McpConfig, McpConfigServer, McpConfigInput, McpTool } from '../domain/types.js';

export interface ConnectResult {
  success: boolean;
  results: Array<{
    id: string;
    name: string;
    success: boolean;
    tools?: McpTool[];
    error?: string;
  }>;
  requiredInputs: McpConfigInput[];
}

export interface McpServerWithStatus {
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
  isConnected: boolean;
  isConnecting: boolean;
  hasError: boolean;
  lastError?: string;
  connectedAt?: string;
  toolCount: number;
  tools: McpTool[];
  createdAt: string;
}

interface ConnectedServerInfo {
  connectedAt: Date;
  tools: McpTool[];
}

export class McpServerService {
  private connectedServers: Map<string, ConnectedServerInfo> = new Map();

  constructor(
    private repository: McpServerRepository,
    private mcpManager: IMcpPort
  ) {}

  // ============ CRUD ============

  async listServers(): Promise<McpServerWithStatus[]> {
    const servers = await this.repository.findAll();
    return servers.map(s => this.enrichWithStatus(s));
  }

  async getServer(id: string): Promise<McpServerWithStatus | null> {
    const server = await this.repository.findById(id);
    if (!server) return null;
    return this.enrichWithStatus(server);
  }

  async saveServer(props: McpServerProps, id?: string): Promise<McpServer> {
    const server = new McpServer(props, id);
    await this.repository.save(server);
    return server;
  }

  async updateServer(id: string, updates: Partial<McpServerProps>): Promise<McpServer | null> {
    const existing = await this.repository.findById(id);
    if (!existing) return null;

    if (this.mcpManager.isConnected(id)) {
      await this.mcpManager.disconnect(id);
      this.connectedServers.delete(id);
    }

    const updated = existing.updateConfig(updates);
    await this.repository.save(updated);
    return updated;
  }

  async deleteServer(id: string): Promise<void> {
    if (this.mcpManager.isConnected(id)) {
      await this.mcpManager.disconnect(id);
      this.connectedServers.delete(id);
    }
    await this.repository.delete(id);
  }

  // ============ 连接管理 ============

  async connectServer(id: string): Promise<{ success: boolean; tools?: McpTool[]; error?: string }> {
    const server = await this.repository.findById(id);
    if (!server) {
      return { success: false, error: `Server ${id} not found` };
    }

    if (this.mcpManager.isConnected(id)) {
      return { success: true, tools: this.connectedServers.get(id)?.tools };
    }

    try {
      await this.mcpManager.connect(server.getConnectionConfig());
      const tools = await this.mcpManager.listTools(id);

      this.connectedServers.set(id, {
        connectedAt: new Date(),
        tools,
      });

      return { success: true, tools };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async disconnectServer(id: string): Promise<void> {
    if (this.mcpManager.isConnected(id)) {
      await this.mcpManager.disconnect(id);
    }
    this.connectedServers.delete(id);
  }

  async reconnectServer(id: string): Promise<{ success: boolean; tools?: McpTool[]; error?: string }> {
    await this.disconnectServer(id);
    return this.connectServer(id);
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.mcpManager.isConnected(serverId)) {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return this.mcpManager.callTool(serverId, toolName, args);
  }

  // ============ 配置解析 ============

  parseConfig(configText: string): McpConfig {
    try {
      const config = JSON.parse(configText);

      if (config.servers && config.inputs) {
        return config as McpConfig;
      }

      if (config.servers && !config.inputs) {
        return config as McpConfig;
      }

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

  getRequiredInputs(config: McpConfig): McpConfigInput[] {
    return config.inputs || [];
  }

  resolveInputs(config: McpConfig, inputValues: Record<string, string>): McpConfig {
    const resolved = JSON.parse(JSON.stringify(config)) as McpConfig;

    for (const serverConfig of Object.values(resolved.servers)) {
      if (serverConfig.headers) {
        for (const [key, value] of Object.entries(serverConfig.headers)) {
          const match = value.match(/\$\{([^}]+)\}/);
          if (match && inputValues[match[1]]) {
            serverConfig.headers[key] = value.replace(/\$\{[^}]+\}/g, (m: string) => {
              const inputId = m.slice(2, -1);
              return inputValues[inputId] || m;
            });
          }
        }
      }

      if (serverConfig.env) {
        for (const [key, value] of Object.entries(serverConfig.env)) {
          const match = value.match(/\$\{([^}]+)\}/);
          if (match && inputValues[match[1]]) {
            serverConfig.env[key] = value.replace(/\$\{[^}]+\}/g, (m: string) => {
              const inputId = m.slice(2, -1);
              return inputValues[inputId] || m;
            });
          }
        }
      }
    }

    return resolved;
  }

  async connectWithConfig(
    configText: string,
    inputValues: Record<string, string>
  ): Promise<ConnectResult> {
    const config = this.parseConfig(configText);
    const resolvedConfig = this.resolveInputs(config, inputValues);
    const requiredInputs = this.getRequiredInputs(config);

    const results: ConnectResult['results'] = [];

    for (const [name, serverConfig] of Object.entries(resolvedConfig.servers)) {
      const serverId = `mcp_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;

      const server = await this.saveServer({
        name,
        type: (serverConfig.type || 'http') as 'stdio' | 'sse' | 'http',
        url: serverConfig.url,
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
        headers: serverConfig.headers,
        enabled: true,
      }, serverId);

      try {
        await this.mcpManager.connect(server.getConnectionConfig());
        const tools = await this.mcpManager.listTools(serverId);

        this.connectedServers.set(serverId, {
          connectedAt: new Date(),
          tools,
        });

        results.push({ id: serverId, name, success: true, tools });
      } catch (error) {
        results.push({
          id: serverId,
          name,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      success: true,
      results,
      requiredInputs,
    };
  }

  // ============ 私有方法 ============

  private enrichWithStatus(server: McpServer): McpServerWithStatus {
    const runtimeInfo = this.connectedServers.get(server.id);
    const isConnected = this.mcpManager.isConnected(server.id);

    return {
      id: server.id,
      name: server.name,
      type: server.type,
      url: server.url,
      command: server.command,
      args: server.args,
      env: server.env,
      headers: server.headers,
      enabled: server.enabled,
      status: isConnected ? 'connected' : server.status,
      isConnected,
      isConnecting: server.isConnecting,
      hasError: server.hasError,
      lastError: server.lastError,
      connectedAt: runtimeInfo?.connectedAt?.toISOString(),
      toolCount: runtimeInfo?.tools.length ?? 0,
      tools: runtimeInfo?.tools ?? [],
      createdAt: server.createdAt.toISOString(),
    };
  }
}
