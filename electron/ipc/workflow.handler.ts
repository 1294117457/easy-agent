import { ipcMain } from 'electron';
import type { McpManager } from '../core/adapters/mcp/mcp.manager.js';
import type { PluginService } from '../core/application/PluginService.js';
import type { WorkflowNodeService } from '../core/application/WorkflowNodeService.js';
import type { WorkflowService } from '../core/application/WorkflowService.js';
import type { McpServer, McpConfig, McpConfigInput } from '../core/domain/types.js';

export function registerMcpHandlers(
  mcpManager: McpManager,
  pluginService: PluginService
): void {
  ipcMain.handle('mcp:connect', async (_, server: McpServer) => {
    try {
      await mcpManager.connect(server);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('mcp:disconnect', async (_, serverId: string) => {
    try {
      await mcpManager.disconnect(serverId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('mcp:isConnected', async (_, serverId: string) => {
    return mcpManager.isConnected(serverId);
  });

  ipcMain.handle('mcp:listTools', async (_, serverId: string) => {
    try {
      const tools = await pluginService.discoverTools(serverId);
      // 确保工具列表可序列化 - 递归清理所有不可序列化的属性
      const serializeTools = (items: unknown[]): unknown[] => {
        return items.map(item => {
          if (item && typeof item === 'object') {
            const serialized: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
              // 跳过函数和不可序列化的属性
              if (typeof value === 'function') continue;
              if (value && typeof value === 'object') {
                // 递归序列化嵌套对象
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

  ipcMain.handle('mcp:callTool', async (_, serverId: string, toolName: string, args: Record<string, unknown>) => {
    try {
      const result = await mcpManager.callTool(serverId, toolName, args);
      // 确保结果是可序列化的
      return { success: true, result: JSON.parse(JSON.stringify(result)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 解析 MCP Config
  ipcMain.handle('mcp:parseConfig', async (_, configText: string) => {
    try {
      const config = mcpManager.parseMcpConfig(configText);
      // 确保配置可序列化
      return { success: true, config: JSON.parse(JSON.stringify(config)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 解析并连接 MCP Config
  ipcMain.handle('mcp:connectWithConfig', async (_, configText, inputValues) => {
    console.log('[IPC] ★ mcp:connectWithConfig CALLED');
    console.log('[IPC] configText type:', typeof configText);
    console.log('[IPC] configText:', configText);
    console.log('[IPC] inputValues:', JSON.stringify(inputValues));
    
    try {
      // 1. 解析配置
      const config = mcpManager.parseMcpConfig(configText);
      console.log('[IPC] Parsed config successfully');

      // 2. 解析 inputs（替换占位符）
      const resolvedConfig = mcpManager.resolveInputs(config, inputValues);
      console.log('[IPC] Resolved config:', JSON.stringify(resolvedConfig, null, 2));

      // 3. 获取需要的 inputs
      const requiredInputs = mcpManager.getRequiredInputs(config);

      // 4. 为每个 server 创建连接
      const results: { id: string; name: string; success: boolean; error?: string }[] = [];

      for (const [name, serverConfig] of Object.entries(resolvedConfig.servers)) {
        const serverId = `mcp_${Date.now()}_${name}`;
        const server: McpServer = {
          id: serverId,
          name: serverConfig.type === 'http' ? name : name,
          type: serverConfig.type === 'stdio' ? 'stdio' : (serverConfig.type || 'http'),
          command: serverConfig.command,
          args: serverConfig.args,
          env: serverConfig.env,
          url: serverConfig.url,
          headers: serverConfig.headers,
          enabled: true,
        };

        console.log('[IPC] Connecting server:', JSON.stringify(server, null, 2));

        try {
          await mcpManager.connect(server);
          results.push({ id: serverId, name, success: true });
          console.log('[IPC] Successfully connected to:', name);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[IPC] Failed to connect to', name, ':', errorMessage);
          results.push({ id: serverId, name, success: false, error: errorMessage });
        }
      }

      return { success: true, results, requiredInputs: JSON.parse(JSON.stringify(requiredInputs)) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[IPC] mcp:connectWithConfig error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  });
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
