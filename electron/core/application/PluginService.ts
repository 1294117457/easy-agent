import type { IStoragePort } from '../../ports/storage.port.js';
import type { IMcpPort } from '../../ports/mcp.port.js';
import type { McpTool } from '../types.js';
import type { Plugin, CreatePluginDTO } from '../entities/Plugin.js';

export interface PluginTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export class PluginService {
  constructor(
    private storagePort: IStoragePort,
    private mcpPort: IMcpPort
  ) {}

  async createPlugin(data: CreatePluginDTO & { tools: PluginTool[] }): Promise<Plugin> {
    const id = `plugin:${data.serverId}:${data.toolNames.join('_')}`;

    const plugin: Plugin = {
      id,
      name: data.name,
      description: data.description,
      serverId: data.serverId,
      toolNames: data.toolNames,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return plugin;
  }

  async discoverTools(serverId: string): Promise<McpTool[]> {
    if (!this.mcpPort.isConnected(serverId)) {
      throw new Error(`MCP Server ${serverId} is not connected`);
    }

    const tools = await this.mcpPort.listTools(serverId);
    return tools;
  }

  async callPluginTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    return await this.mcpPort.callTool(serverId, toolName, args);
  }

  listPlugins(): Plugin[] {
    return [];
  }

  getPlugin(id: string): Plugin | null {
    return null;
  }

  deletePlugin(id: string): boolean {
    return false;
  }
}
