import { ipcMain } from 'electron';
import type { McpServerService } from '../core/application/McpServerService.js';
import type { McpServer } from '../core/domain/entities/McpServer.js';
import type { PluginService } from '../core/application/PluginService.js';
import type { WorkflowNodeService } from '../core/application/WorkflowNodeService.js';
import type { WorkflowService } from '../core/application/WorkflowService.js';
import type { McpServerProps } from '../core/domain/entities/McpServer.js';

export function registerMcpHandlers(
  mcpServerService: McpServerService,
  pluginService: PluginService
): void {
  // ============ CRUD ============

  // 获取所有服务器（带状态）
  ipcMain.handle('mcp:list', async () => {
    try {
      const servers = await mcpServerService.listServers();
      return { success: true, servers };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 获取单个服务器
  ipcMain.handle('mcp:get', async (_, id: string) => {
    try {
      const server = await mcpServerService.getServer(id);
      if (!server) {
        return { success: false, error: 'Server not found' };
      }
      return { success: true, server };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 保存/创建服务器
  ipcMain.handle('mcp:save', async (_, data: {
    id?: string;
    name: string;
    type: 'stdio' | 'sse' | 'http';
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    headers?: Record<string, string>;
    enabled?: boolean;
  }) => {
    try {
      const props: McpServerProps = {
        name: data.name,
        type: data.type,
        url: data.url,
        command: data.command,
        args: data.args,
        env: data.env,
        headers: data.headers,
        enabled: data.enabled ?? true,
      };
      const server = await mcpServerService.saveServer(props, data.id);
      return { success: true, server: server.toJSON() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 更新服务器
  ipcMain.handle('mcp:update', async (_, id: string, updates: Partial<McpServerProps>) => {
    try {
      const server = await mcpServerService.updateServer(id, updates);
      if (!server) {
        return { success: false, error: 'Server not found' };
      }
      return { success: true, server: server.toJSON() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 删除服务器
  ipcMain.handle('mcp:delete', async (_, id: string) => {
    try {
      await mcpServerService.deleteServer(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // ============ 连接管理 ============

  // 连接服务器
  ipcMain.handle('mcp:connect', async (_, id: string) => {
    try {
      const result = await mcpServerService.connectServer(id);
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 断开连接
  ipcMain.handle('mcp:disconnect', async (_, id: string) => {
    try {
      await mcpServerService.disconnectServer(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 重新连接
  ipcMain.handle('mcp:reconnect', async (_, id: string) => {
    try {
      const result = await mcpServerService.reconnectServer(id);
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 检查连接状态
  ipcMain.handle('mcp:isConnected', async (_, id: string) => {
    const server = await mcpServerService.getServer(id);
    return server?.isConnected ?? false;
  });

  // 获取工具列表
  ipcMain.handle('mcp:listTools', async (_, id: string) => {
    try {
      const tools = await pluginService.discoverTools(id);
      const serializeTools = (items: unknown[]): unknown[] => {
        return items.map(item => {
          if (item && typeof item === 'object') {
            const serialized: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
              if (typeof value === 'function') continue;
              if (value && typeof value === 'object') {
                serialized[key] = serializeTools([value])[0];
              } else {
                serialized[key] = value;
              }
            }
            return serialized;
          }
          return item;
        });
      };
      return { success: true, tools: serializeTools(tools) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 调用工具
  ipcMain.handle('mcp:callTool', async (_, serverId: string, toolName: string, args: Record<string, unknown>) => {
    try {
      const result = await mcpServerService.callTool(serverId, toolName, args);
      return { success: true, result: JSON.parse(JSON.stringify(result)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // ============ 配置解析 ============

  // 解析配置
  ipcMain.handle('mcp:parseConfig', async (_, configText: string) => {
    try {
      const config = mcpServerService.parseConfig(configText);
      return { success: true, config: JSON.parse(JSON.stringify(config)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 解析并连接
  ipcMain.handle('mcp:connectWithConfig', async (_, configText: string, inputValues: Record<string, string>) => {
    try {
      const result = await mcpServerService.connectWithConfig(configText, inputValues);
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

export async function callTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
  mcpServerService: McpServerService
): Promise<unknown> {
  const server = await mcpServerService.getServer(serverId);
  if (!server || !server.isConnected) {
    throw new Error(`Server ${serverId} is not connected`);
  }
  return mcpServerService.callTool(serverId, toolName, args);
}

export function registerPluginHandlers(pluginService: PluginService): void {
  ipcMain.handle('plugin:create', async (_, data: { name: string; description: string; serverId: string; toolNames: string[] }) => {
    try {
      const plugin = await pluginService.createPlugin({
        name: data.name,
        description: data.description,
        serverId: data.serverId,
        toolNames: data.toolNames,
      });
      return { success: true, plugin };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('plugin:list', async () => {
    return pluginService.listPlugins();
  });

  ipcMain.handle('plugin:get', async (_, id: string) => {
    return pluginService.getPlugin(id);
  });

  ipcMain.handle('plugin:delete', async (_, id: string) => {
    return pluginService.deletePlugin(id);
  });
}

export function registerWorkflowNodeHandlers(nodeService: WorkflowNodeService): void {
  ipcMain.handle('node:create', async (_, data: {
    name: string;
    description?: string;
    pluginId: string;
    toolName: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    inputMapping: Record<string, string>;
    outputMapping: Record<string, string>;
  }) => {
    try {
      const node = await nodeService.createNode({
        name: data.name,
        description: data.description,
        pluginId: data.pluginId,
        toolName: data.toolName,
        inputSchema: data.inputSchema as import('../core/domain/entities/Plugin.js').StandardSchema,
        outputSchema: data.outputSchema as import('../core/domain/entities/Plugin.js').StandardSchema,
        inputMapping: data.inputMapping,
        outputMapping: data.outputMapping,
      });
      return { success: true, node };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('node:execute', async (_, nodeId: string, input: unknown) => {
    try {
      const result = await nodeService.execute(nodeId, input);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('node:get', async (_, id: string) => {
    return nodeService.getNode(id);
  });

  ipcMain.handle('node:list', async () => {
    return nodeService.listNodes();
  });

  ipcMain.handle('node:listByPlugin', async (_, pluginId: string) => {
    return nodeService.listNodesByPlugin(pluginId);
  });

  ipcMain.handle('node:update', async (_, id: string, data: Partial<import('../core/domain/entities/WorkflowNode.js').WorkflowNode>) => {
    return nodeService.updateNode(id, data);
  });

  ipcMain.handle('node:delete', async (_, id: string) => {
    return nodeService.deleteNode(id);
  });

  ipcMain.handle('node:validateInput', async (_, nodeId: string, input: unknown) => {
    return nodeService.validateInput(nodeId, input);
  });

  ipcMain.handle('node:getInputSchema', async (_, nodeId: string) => {
    return nodeService.getInputSchema(nodeId);
  });

  ipcMain.handle('node:getOutputSchema', async (_, nodeId: string) => {
    return nodeService.getOutputSchema(nodeId);
  });
}

export function registerWorkflowHandlers(workflowService: WorkflowService, nodeService: WorkflowNodeService): void {
  ipcMain.handle('workflow:create', async (_, data: { name: string; description?: string; nodeIds?: string[]; edges?: import('../core/domain/entities/Workflow.js').WorkflowEdge[] }) => {
    try {
      const workflow = await workflowService.createWorkflow({
        name: data.name,
        description: data.description,
        nodeIds: data.nodeIds || [],
        edges: data.edges || [],
        status: 'draft',
      });
      return { success: true, workflow };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('workflow:addNode', async (_, workflowId: string, nodeId: string) => {
    try {
      const node = nodeService.getNode(nodeId);
      if (!node) {
        return { success: false, error: 'Node not found' };
      }
      workflowService.addNode(workflowId, node);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('workflow:removeNode', async (_, workflowId: string, nodeId: string) => {
    try {
      workflowService.removeNode(workflowId, nodeId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('workflow:connect', async (_, workflowId: string, sourceNodeId: string, sourceField: string, targetNodeId: string, targetField: string) => {
    try {
      const edge = workflowService.connect(workflowId, sourceNodeId, sourceField, targetNodeId, targetField);
      if (!edge) {
        return { success: false, error: 'Failed to connect' };
      }
      return { success: true, edge };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('workflow:disconnect', async (_, workflowId: string, edgeId: string) => {
    try {
      const result = workflowService.disconnect(workflowId, edgeId);
      return { success: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('workflow:validate', async (_, workflowId: string) => {
    return workflowService.validate(workflowId);
  });

  ipcMain.handle('workflow:execute', async (_, workflowId: string, input: unknown) => {
    try {
      const result = await workflowService.execute(workflowId, input);
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('workflow:get', async (_, id: string) => {
    return workflowService.getWorkflow(id);
  });

  ipcMain.handle('workflow:list', async () => {
    return workflowService.listWorkflows();
  });

  ipcMain.handle('workflow:getNodes', async (_, workflowId: string) => {
    return workflowService.getNodes(workflowId);
  });

  ipcMain.handle('workflow:update', async (_, id: string, data: Partial<import('../core/domain/entities/Workflow.js').Workflow>) => {
    return workflowService.updateWorkflow(id, data);
  });

  ipcMain.handle('workflow:delete', async (_, id: string) => {
    return workflowService.deleteWorkflow(id);
  });

  ipcMain.handle('workflow:updateStatus', async (_, id: string, status: 'draft' | 'active' | 'archived') => {
    return workflowService.updateWorkflowStatus(id, status);
  });
}
