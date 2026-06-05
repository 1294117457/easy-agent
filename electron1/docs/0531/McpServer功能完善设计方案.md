# McpServer 功能完善设计方案

**日期**: 2026-05-31
**状态**: 待实施
**目标**: 完善 McpServer 的 CRUD、状态管理、解析、连接功能

---

## 1. 当前问题分析

### 1.1 核心问题：状态不同步

```
当前架构：
┌─────────────────────────────────────────────────────────────┐
│  McpManager (内存)                                          │
│  - servers: Map<id, ConnectedServer>  ← 连接状态           │
│  - 无持久化                                                 │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ 不同步！
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  SQLiteAdapter (持久化)                                     │
│  - createMcpServer()                                       │
│  - listMcpServers()                                        │
│  - deleteMcpServer()                                       │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ 不同步！
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  workflow.ts store (前端状态)                               │
│  - mcpServers[]                                            │
│  - connectedServers: Set<id>                               │
│  - serverTools: Map<id, tools[]>                           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 具体问题

| 问题 | 位置 | 影响 |
|------|------|------|
| 连接后未添加到列表 | `mcp:connectWithConfig` | 服务器列表不显示已连接 |
| 状态未同步 | 整个链路 | 前端显示"未连接"但实际已连 |
| 缺少更新功能 | IPC/Store | 无法修改已保存的服务器配置 |
| 缺少查看详情 | IPC/Store | 无法查看服务器的完整配置 |
| ID 不一致 | `mcp:connectWithConfig` | 每次连接生成新 ID |

---

## 2. 目标架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            前端 (Vue/Pinia)                             │
│                                                                         │
│  workflow.ts store                                                      │
│    ├── mcpServers[]          ← 服务器列表                               │
│    ├── connectedServers Set   ← 已连接 ID 集合                         │
│    └── serverTools Map        ← 工具列表                                │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       IPC Handlers                                │   │
│  │   mcp:list, mcp:get, mcp:save, mcp:delete                       │   │
│  │   mcp:connect, mcp:disconnect, mcp:reconnect                     │   │
│  │   mcp:parseConfig, mcp:connectWithConfig                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         应用层 (McpServerService)                       │
│                                                                         │
│  业务逻辑编排                                                           │
│    ├── CRUD: create, read, update, delete                              │
│    ├── 连接管理: connect, disconnect, reconnect                        │
│    └── 状态同步                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
┌─────────────────────────────┐     ┌─────────────────────────────┐
│  McpServerRepository (Port)  │     │     McpManager (适配器)     │
│  持久化接口                   │     │  实际连接管理               │
│  ├── save()                  │     │  ├── connect()             │
│  ├── findById()              │     │  ├── disconnect()          │
│  ├── findAll()               │     │  ├── listTools()          │
│  └── delete()                │     │  └── callTool()           │
└─────────────────────────────┘     └─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────┐
│  SQLiteMcpServerAdapter     │
│  (持久化实现)                │
└─────────────────────────────┘
```

### 2.2 McpServerService 职责

```typescript
// electron/core/application/McpServerService.ts

export class McpServerService {
  constructor(
    private repository: McpServerRepository,
    private mcpManager: McpManager,
    private storage: IStoragePort
  ) {}

  // ============ CRUD ============

  /** 获取所有服务器（带连接状态） */
  async listServers(): Promise<McpServerWithStatus[]>

  /** 获取单个服务器详情 */
  async getServer(id: string): Promise<McpServerWithStatus | null>

  /** 保存/更新服务器配置 */
  async saveServer(server: McpServer): Promise<void>

  /** 删除服务器（先断开连接） */
  async deleteServer(id: string): Promise<void>

  // ============ 连接管理 ============

  /** 连接服务器 */
  async connectServer(id: string): Promise<{ success: boolean; tools?: McpTool[]; error?: string }>

  /** 断开连接 */
  async disconnectServer(id: string): Promise<void>

  /** 重新连接 */
  async reconnectServer(id: string): Promise<{ success: boolean; tools?: McpTool[]; error?: string }>

  // ============ 配置解析 ============

  /** 解析配置文本 */
  parseConfig(configText: string): McpConfig

  /** 获取配置中的 inputs */
  getRequiredInputs(config: McpConfig): McpConfigInput[]

  /** 解析并连接（完整流程） */
  async connectWithConfig(configText: string, inputValues: Record<string, string>): Promise<ConnectResult>

  /** 添加解析后的服务器到列表 */
  async addServerFromConfig(name: string, config: McpConfigServer): Promise<McpServer>
}
```

---

## 3. McpServer 领域模型增强

### 3.1 当前状态

```typescript
// electron/core/domain/entities/McpServer.ts

export class McpServer {
  // 配置属性（只读）
  readonly id: string;
  readonly name: string;
  readonly type: McpServerType;
  readonly url?: string;
  readonly command?: string;
  readonly args?: string[];
  readonly env?: Record<string, string>;
  readonly headers?: Record<string, string>;
  readonly enabled: boolean;

  // 运行时状态（私有）
  private _status: McpServerStatus = 'disconnected';
  private _lastError?: string;
  private _connectedAt?: Date;

  // ✅ 已有：状态转换方法
  startConnecting(): void
  connectSuccess(): void
  connectFail(error: string): void
  disconnect(): void
  reset(): void

  // ✅ 已有：序列化方法
  static fromJSON(json: McpServerJSON): McpServer
  toJSON(): McpServerJSON
  getConnectionConfig(): McpServerProps
}
```

### 3.2 增强：添加 McpTool 支持

```typescript
// 在 McpServer.ts 中添加

export class McpServer {
  // ... 现有代码 ...

  // ============ 新增：工具列表管理 ============

  private _tools: McpTool[] = [];

  get tools(): ReadonlyArray<McpTool> {
    return this._tools;
  }

  get toolCount(): number {
    return this._tools.length;
  }

  setTools(tools: McpTool[]): void {
    this._tools = tools;
    this._updatedAt = new Date();
  }

  addTool(tool: McpTool): void {
    this._tools.push(tool);
    this._updatedAt = new Date();
  }

  clearTools(): void {
    this._tools = [];
    this._updatedAt = new Date();
  }

  getToolByName(name: string): McpTool | undefined {
    return this._tools.find(t => t.name === name);
  }

  // ============ 增强：更新配置方法 ============

  /**
   * 创建配置副本并更新（返回新实例）
   */
  updateConfig(updates: Partial<McpServerProps>): McpServer {
    const newServer = new McpServer(
      {
        name: updates.name ?? this.name,
        type: updates.type ?? this.type,
        url: updates.url ?? this.url,
        command: updates.command ?? this.command,
        args: updates.args ?? this.args,
        env: updates.env ?? this.env,
        headers: updates.headers ?? this.headers,
        enabled: updates.enabled ?? this.enabled,
      },
      this.id  // 保持相同 ID
    );
    // 复制运行时状态
    newServer._status = this._status;
    newServer._lastError = this._lastError;
    newServer._connectedAt = this._connectedAt;
    newServer._tools = [...this._tools];
    return newServer;
  }
}
```

### 3.3 McpServerWithStatus 类型

```typescript
// 用于 API 返回，包含完整状态信息
export interface McpServerWithStatus extends McpServerJSON {
  // 运行时信息
  isConnected: boolean;
  isConnecting: boolean;
  hasError: boolean;
  lastError?: string;
  connectedAt?: string;
  toolCount: number;
  tools: McpTool[];
}
```

---

## 4. McpServerService 实现

### 4.1 服务类

```typescript
// electron/core/application/McpServerService.ts

import type { McpServer, McpServerProps } from '../domain/entities/McpServer.js';
import type { McpServerRepository } from '../ports/persistence/McpServerRepository.js';
import type { IMcpPort } from '../ports/mcp.port.js';
import type { IStoragePort } from '../ports/storage.port.js';
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

export class McpServerService {
  // 内存缓存：连接状态和工具列表
  private connectedServers: Map<string, {
    connectedAt: Date;
    tools: McpTool[];
  }> = new Map();

  constructor(
    private repository: McpServerRepository,
    private mcpManager: IMcpPort,
    private storage: IStoragePort
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

    // 如果正在连接或已连接，先断开
    if (this.mcpManager.isConnected(id)) {
      await this.mcpManager.disconnect(id);
      this.connectedServers.delete(id);
    }

    const updated = existing.updateConfig(updates);
    await this.repository.save(updated);
    return updated;
  }

  async deleteServer(id: string): Promise<void> {
    // 先断开连接
    if (this.mcpManager.isConnected(id)) {
      await this.mcpManager.disconnect(id);
      this.connectedServers.delete(id);
    }
    // 删除关联的 plugins
    await this.deletePluginsByServer(id);
    // 删除服务器记录
    await this.repository.delete(id);
  }

  // ============ 连接管理 ============

  async connectServer(id: string): Promise<{ success: boolean; tools?: McpTool[]; error?: string }> {
    const server = await this.repository.findById(id);
    if (!server) {
      return { success: false, error: `Server ${id} not found` };
    }

    // 已经连接
    if (this.mcpManager.isConnected(id)) {
      return { success: true, tools: this.connectedServers.get(id)?.tools };
    }

    try {
      // 状态：connecting（不持久化）
      await this.mcpManager.connect(server.getConnectionConfig());

      // 获取工具列表
      const tools = await this.mcpManager.listTools(id);

      // 状态：connected
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

  // ============ 配置解析 ============

  parseConfig(configText: string): McpConfig {
    try {
      const config = JSON.parse(configText);

      // 完整格式
      if (config.servers && config.inputs) {
        return config as McpConfig;
      }

      // 只有 servers
      if (config.servers && !config.inputs) {
        return config as McpConfig;
      }

      // 单个 server
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
      // 替换 headers 中的占位符
      if (serverConfig.headers) {
        for (const [key, value] of Object.entries(serverConfig.headers)) {
          const match = value.match(/\$\{([^}]+)\}/);
          if (match && inputValues[match[1]]) {
            serverConfig.headers[key] = value.replace(/\$\{[^}]+\}/g, (m) => {
              const inputId = m.slice(2, -1);
              return inputValues[inputId] || m;
            });
          }
        }
      }

      // 替换 env 中的占位符
      if (serverConfig.env) {
        for (const [key, value] of Object.entries(serverConfig.env)) {
          const match = value.match(/\$\{([^}]+)\}/);
          if (match && inputValues[match[1]]) {
            serverConfig.env[key] = value.replace(/\$\{[^}]+\}/g, (m) => {
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
      // 使用配置的 name 作为服务器 ID（保持一致性）
      const serverId = `mcp_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // 创建并保存服务器
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

      // 连接
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
      ...server.toJSON(),
      isConnected,
      isConnecting: server.isConnecting,
      hasError: server.hasError,
      lastError: server.lastError,
      connectedAt: runtimeInfo?.connectedAt?.toISOString(),
      toolCount: runtimeInfo?.tools.length ?? 0,
      tools: runtimeInfo?.tools ?? [],
    };
  }

  private async deletePluginsByServer(serverId: string): Promise<void> {
    const plugins = await this.storage.listPlugins?.() || [];
    for (const plugin of plugins) {
      if (plugin.serverId === serverId) {
        await this.storage.deletePlugin?.(plugin.id);
      }
    }
  }
}
```

---

## 5. IPC Handler 增强

### 5.1 新的 IPC 接口

```typescript
// electron/ipc/workflow.handler.ts

// ============ 现有（保持兼容） ============

ipcMain.handle('mcp:connect', async (_, server) => {
  // 保持现有逻辑
});

ipcMain.handle('mcp:disconnect', async (_, serverId) => {
  // 保持现有逻辑
});

ipcMain.handle('mcp:isConnected', async (_, serverId) => {
  // 保持现有逻辑
});

ipcMain.handle('mcp:listTools', async (_, serverId) => {
  // 保持现有逻辑
});

// ============ 现有（需修改） ============

// 解析配置（保持）
ipcMain.handle('mcp:parseConfig', async (_, configText) => {
  // 保持现有逻辑
});

// 解析并连接（需修改：添加保存逻辑）
ipcMain.handle('mcp:connectWithConfig', async (_, configText, inputValues) => {
  return mcpServerService.connectWithConfig(configText, inputValues);
});

// ============ 新增 ============

// 获取所有服务器（带状态）
ipcMain.handle('mcp:list', async () => {
  try {
    const servers = await mcpServerService.listServers();
    return { success: true, servers };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// 获取单个服务器详情
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
    const server = await mcpServerService.saveServer(
      {
        name: data.name,
        type: data.type,
        url: data.url,
        command: data.command,
        args: data.args,
        env: data.env,
        headers: data.headers,
        enabled: data.enabled ?? true,
      },
      data.id
    );
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

// 重新连接服务器
ipcMain.handle('mcp:reconnect', async (_, id: string) => {
  try {
    const result = await mcpServerService.reconnectServer(id);
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});
```

---

## 6. 前端 Store 增强

### 6.1 workflow.ts 更新

```typescript
// src/stores/workflow.ts

// ============ 新增类型 ============

export interface McpServerWithStatus extends McpServer {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  isConnected: boolean;
  isConnecting: boolean;
  hasError: boolean;
  lastError?: string;
  connectedAt?: string;
  toolCount: number;
  tools: McpTool[];
}

// ============ Store 状态更新 ============

export const useWorkflowStore = defineStore('workflow', () => {
  // MCP Server 状态 - 改为包含完整状态
  const mcpServers = ref<McpServerWithStatus[]>([]);
  // 移除单独的 connectedServers 和 serverTools
  // const connectedServers = ref<Set<string>>(new Set());
  // const serverTools = ref<Map<string, McpTool[]>>(new Map());

  // ============ MCP Server 操作 ============

  async function loadMcpServers() {
    try {
      const result = await workflowApi.mcpList();
      if (result.success) {
        mcpServers.value = result.servers;
      }
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    }
  }

  async function addMcpServer(data: {
    name: string;
    type: 'stdio' | 'sse' | 'http';
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    headers?: Record<string, string>;
  }) {
    try {
      const result = await workflowApi.mcpSave(data);
      if (result.success) {
        await loadMcpServers();  // 重新加载以获取完整状态
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function updateMcpServer(id: string, updates: Partial<McpServer>) {
    try {
      const result = await workflowApi.mcpUpdate(id, updates);
      if (result.success) {
        await loadMcpServers();
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function removeMcpServer(id: string) {
    try {
      const result = await workflowApi.mcpDelete(id);
      if (result.success) {
        mcpServers.value = mcpServers.value.filter(s => s.id !== id);
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function connectMcpServer(id: string) {
    try {
      const result = await workflowApi.mcpConnect(id);
      if (result.success) {
        // 更新本地状态
        const server = mcpServers.value.find(s => s.id === id);
        if (server) {
          server.status = 'connected';
          server.isConnected = true;
          server.tools = result.tools || [];
          server.toolCount = server.tools.length;
          server.connectedAt = new Date().toISOString();
        }
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function disconnectMcpServer(id: string) {
    try {
      const result = await workflowApi.mcpDisconnect(id);
      if (result.success) {
        const server = mcpServers.value.find(s => s.id === id);
        if (server) {
          server.status = 'disconnected';
          server.isConnected = false;
          server.tools = [];
          server.toolCount = 0;
        }
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async function reconnectMcpServer(id: string) {
    try {
      const result = await workflowApi.mcpReconnect(id);
      if (result.success) {
        await loadMcpServers();
      }
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============ 工具获取 ============

  function getServerTools(serverId: string): McpTool[] {
    const server = mcpServers.value.find(s => s.id === serverId);
    return server?.tools || [];
  }

  function isServerConnected(serverId: string): boolean {
    const server = mcpServers.value.find(s => s.id === serverId);
    return server?.isConnected ?? false;
  }

  // ... 其他代码保持不变 ...
});
```

### 6.2 API 层更新

```typescript
// src/api/workflow.ts

// 添加新的 API 方法
export const workflowApi = {
  // ... 现有方法 ...

  // ============ 新增 ============

  mcpList: () => ipcRenderer.invoke('mcp:list'),

  mcpGet: (id: string) => ipcRenderer.invoke('mcp:get', id),

  mcpSave: (data: {
    id?: string;
    name: string;
    type: 'stdio' | 'sse' | 'http';
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    headers?: Record<string, string>;
    enabled?: boolean;
  }) => ipcRenderer.invoke('mcp:save', data),

  mcpUpdate: (id: string, updates: Partial<McpServer>) =>
    ipcRenderer.invoke('mcp:update', id, updates),

  mcpDelete: (id: string) => ipcRenderer.invoke('mcp:delete', id),

  mcpReconnect: (id: string) => ipcRenderer.invoke('mcp:reconnect', id),
};
```

---

## 7. EasyAgentCore 集成

### 7.1 更新 core/index.ts

```typescript
// electron/core/index.ts

import { McpServerService } from './application/McpServerService.js';
import { SQLiteMcpServerAdapter } from './adapters/persistence/SQLiteMcpServerAdapter.js';
// ...

export class EasyAgentCore {
  // ...
  private mcpServerService: McpServerService;

  constructor(storage: IStoragePort) {
    // ...
    // 初始化 MCP Server Service
    const mcpServerAdapter = new SQLiteMcpServerAdapter(storage.getDatabase());
    this.mcpServerService = new McpServerService(
      mcpServerAdapter,
      this.mcpManager,
      storage
    );
    // ...
  }

  getMcpServerService(): McpServerService {
    return this.mcpServerService;
  }

  // ...
}
```

### 7.2 更新 main.ts

```typescript
// electron/main.ts

// 在注册 handlers 时传入
const mcpServerService = core.getMcpServerService();
registerMcpHandlers(mcpServerService, pluginService);
```

---

## 8. 数据库 Schema 更新

### 8.1 mcp_servers 表结构

```sql
-- 已有列
id TEXT PRIMARY KEY,
name TEXT NOT NULL,
type TEXT NOT NULL,
command TEXT,
url TEXT,
enabled INTEGER DEFAULT 1,
created_at TEXT,

-- 新增列（通过迁移添加）
headers TEXT,        -- JSON 格式
env TEXT,            -- JSON 格式
args TEXT,           -- JSON 格式
```

---

## 9. 功能清单

### 9.1 CRUD 功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 列出所有服务器 | 🆕 新增 | 返回带状态的完整列表 |
| 获取单个服务器 | 🆕 新增 | 返回完整配置和状态 |
| 创建服务器 | 🆕 新增 | 保存配置，不连接 |
| 更新服务器 | 🆕 新增 | 修改配置（如已连接先断开） |
| 删除服务器 | 🆕 新增 | 断开连接，删除关联数据 |

### 9.2 连接功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 连接服务器 | 🆕 完善 | 修复状态同步问题 |
| 断开连接 | 🆕 完善 | 清理内存状态 |
| 重新连接 | 🆕 新增 | 断开后重连 |
| 获取工具列表 | ✅ 已有 | 集成到连接流程 |

### 9.3 解析功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 解析配置文本 | ✅ 已有 | 解析 JSON 格式 |
| 提取 inputs | ✅ 已有 | 获取占位符信息 |
| 替换占位符 | ✅ 已有 | 填充 inputs |
| 解析并连接 | 🆕 完善 | 添加保存逻辑 |

---

## 10. 实施步骤

### 阶段一：后端服务

- [ ] 10.1 创建 `McpServerService` 类
- [ ] 10.2 增强 `McpServer` 领域模型（添加工具管理）
- [ ] 10.3 更新 IPC Handler（添加新接口）
- [ ] 10.4 更新 `EasyAgentCore`（注册服务）
- [ ] 10.5 更新 `main.ts`（传入服务实例）

### 阶段二：前端适配

- [ ] 10.6 更新前端类型定义
- [ ] 10.7 更新 `workflow.ts` store
- [ ] 10.8 更新 `workflow.ts` API

### 阶段三：测试验证

- [ ] 10.9 测试 CRUD 功能
- [ ] 10.10 测试连接/断开功能
- [ ] 10.11 测试重新连接功能
- [ ] 10.12 测试解析并连接功能
- [ ] 10.13 测试 UI 显示

---

## 11. 关键修复点

### 11.1 状态同步问题（核心修复）

**问题**：`mcp:connectWithConfig` 连接成功后，前端显示"未连接"

**原因**：
1. 连接时没有保存到 `mcpServers` 列表
2. 连接状态没有同步到前端

**修复**：
```typescript
// McpServerService.connectWithConfig()
for (const [name, serverConfig] of Object.entries(resolvedConfig.servers)) {
  const serverId = `mcp_${name}`;

  // 1. 保存服务器
  const server = await this.saveServer({...}, serverId);

  // 2. 连接
  await this.mcpManager.connect(server.getConnectionConfig());

  // 3. 更新内存状态
  this.connectedServers.set(serverId, { connectedAt: new Date(), tools });

  // 4. 前端通过 mcp:list 获取完整列表
}
```

### 11.2 ID 一致性问题

**问题**：每次连接生成新 ID

**修复**：使用服务器名称作为 ID 前缀
```typescript
const serverId = `mcp_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;
```
