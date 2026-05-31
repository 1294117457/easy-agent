# McpServer 领域模型设计文档

**日期**: 2026-05-31
**状态**: 设计中

---

## 1. 概述

### 1.1 目标

将 `McpServer` 从简单的数据传输对象（DTO）重构为完整的领域模型（Rich Entity），实现：
- 配置属性与运行时状态的统一管理
- 完整的状态转换生命周期
- 内聚的业务逻辑
- 清晰的序列化/反序列化

### 1.2 设计原则

- **单一职责**: 每个实体只管理自己的状态
- **封装性**: 内部状态不可直接修改，必须通过业务方法
- **不可变性**: 配置属性一旦创建不可变更
- **可观测性**: 提供只读访问器查询状态

---

## 2. 领域模型设计

### 2.1 类型定义

```typescript
// electron/core/domain/types.ts

// McpServer 类型
export type McpServerType = 'stdio' | 'sse' | 'http';

// McpServer 连接状态
export type McpServerStatus =
  | 'disconnected'  // 默认状态，未连接
  | 'connecting'    // 连接中
  | 'connected'    // 已连接
  | 'error';       // 错误状态

// McpServer 属性（构造用）
export interface McpServerProps {
  name: string;
  type: McpServerType;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  enabled?: boolean;
}

// McpServer JSON 序列化格式
export interface McpServerJSON {
  id: string;
  name: string;
  type: McpServerType;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  enabled: boolean;
  status: McpServerStatus;
  createdAt: string;
  updatedAt: string;
  connectedAt?: string;
  lastError?: string;
}
```

### 2.2 McpServer 类

```typescript
// electron/core/domain/entities/McpServer.ts

import type {
  McpServerType,
  McpServerStatus,
  McpServerProps,
  McpServerJSON,
} from '../types';
import type { McpTool } from '../types';

export class McpServer {
  // ============ 配置属性（只读，创建后不可变） ============
  readonly id: string;
  readonly name: string;
  readonly type: McpServerType;
  readonly url?: string;
  readonly command?: string;
  readonly args?: string[];
  readonly env?: Record<string, string>;
  readonly headers?: Record<string, string>;
  readonly enabled: boolean;
  readonly createdAt: Date;

  // ============ 运行时状态（私有，通过方法修改） ============
  private _status: McpServerStatus = 'disconnected';
  private _tools: McpTool[] = [];
  private _lastError?: string;
  private _connectedAt?: Date;
  private _updatedAt: Date;

  // ============ 构造函数 ============
  constructor(props: McpServerProps, id?: string) {
    this.id = id || `mcp_${Date.now()}_${props.name}`;
    this.name = props.name;
    this.type = props.type;
    this.url = props.url;
    this.command = props.command;
    this.args = props.args;
    this.env = props.env;
    this.headers = props.headers;
    this.enabled = props.enabled ?? true;
    this.createdAt = new Date();
    this._updatedAt = new Date();
  }

  // ============ 只读访问器 ============
  get status(): McpServerStatus {
    return this._status;
  }

  get tools(): ReadonlyArray<McpTool> {
    return this._tools;
  }

  get toolCount(): number {
    return this._tools.length;
  }

  get lastError(): string | undefined {
    return this._lastError;
  }

  get connectedAt(): Date | undefined {
    return this._connectedAt;
  }

  get isConnected(): boolean {
    return this._status === 'connected';
  }

  get isConnecting(): boolean {
    return this._status === 'connecting';
  }

  get hasError(): boolean {
    return this._status === 'error';
  }

  get isDisconnected(): boolean {
    return this._status === 'disconnected';
  }

  // ============ 业务方法（状态转换） ============

  /**
   * 开始连接
   * 前置条件: 当前状态为 disconnected 或 error
   */
  startConnecting(): void {
    if (this._status === 'connecting') {
      throw new Error(`Server ${this.name} is already connecting`);
    }
    if (this._status === 'connected') {
      throw new Error(`Server ${this.name} is already connected`);
    }
    this._status = 'connecting';
    this._lastError = undefined;
    this._updatedAt = new Date();
  }

  /**
   * 连接成功
   * 前置条件: 当前状态为 connecting
   */
  connectSuccess(tools: McpTool[] = []): void {
    if (this._status !== 'connecting') {
      throw new Error(`Server ${this.name} must be in 'connecting' state, current: ${this._status}`);
    }
    this._status = 'connected';
    this._tools = tools;
    this._connectedAt = new Date();
    this._lastError = undefined;
    this._updatedAt = new Date();
  }

  /**
   * 连接失败
   * 前置条件: 当前状态为 connecting
   */
  connectFail(error: string): void {
    if (this._status !== 'connecting') {
      throw new Error(`Server ${this.name} must be in 'connecting' state, current: ${this._status}`);
    }
    this._status = 'error';
    this._lastError = error;
    this._updatedAt = new Date();
  }

  /**
   * 断开连接
   * 可从任何状态调用
   */
  disconnect(): void {
    this._status = 'disconnected';
    this._tools = [];
    this._connectedAt = undefined;
    this._updatedAt = new Date();
  }

  /**
   * 重置状态（从 error 恢复到 disconnected）
   */
  reset(): void {
    this._status = 'disconnected';
    this._lastError = undefined;
    this._updatedAt = new Date();
  }

  /**
   * 刷新工具列表
   * 前置条件: 当前状态为 connected
   */
  refreshTools(tools: McpTool[]): void {
    if (this._status !== 'connected') {
      throw new Error(`Server ${this.name} must be connected to refresh tools`);
    }
    this._tools = tools;
    this._updatedAt = new Date();
  }

  /**
   * 添加单个工具
   */
  addTool(tool: McpTool): void {
    if (this._status !== 'connected') {
      throw new Error(`Server ${this.name} must be connected to add tools`);
    }
    this._tools.push(tool);
    this._updatedAt = new Date();
  }

  // ============ 序列化方法 ============

  /**
   * 转换为 JSON 对象
   */
  toJSON(): McpServerJSON {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      url: this.url,
      command: this.command,
      args: this.args,
      env: this.env,
      headers: this.headers,
      enabled: this.enabled,
      status: this._status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      connectedAt: this._connectedAt?.toISOString(),
      lastError: this._lastError,
    };
  }

  /**
   * 从 JSON 创建实例（静态工厂方法）
   */
  static fromJSON(json: McpServerJSON): McpServer {
    const server = new McpServer(
      {
        name: json.name,
        type: json.type,
        url: json.url,
        command: json.command,
        args: json.args,
        env: json.env,
        headers: json.headers,
        enabled: json.enabled,
      },
      json.id
    );

    // 恢复运行时状态
    server._status = json.status;
    server._updatedAt = new Date(json.updatedAt);
    if (json.connectedAt) {
      server._connectedAt = new Date(json.connectedAt);
    }
    if (json.lastError) {
      server._lastError = json.lastError;
    }

    return server;
  }

  /**
   * 获取连接配置（用于实际连接）
   */
  getConnectionConfig(): {
    id: string;
    name: string;
    type: McpServerType;
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    headers?: Record<string, string>;
  } {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      url: this.url,
      command: this.command,
      args: this.args,
      env: this.env,
      headers: this.headers,
    };
  }
}
```

---

## 3. 状态机定义

### 3.1 状态转换图

```
                           startConnecting()
                              ────────
                                  │
                                  ▼
      ┌─────────────────────────────────────────┐
      │                                         │
      │    disconnect()                          │
      │         │                               │
      │         ▼                               │
      │  ┌─────────────┐                        │
      │  │disconnected │◄───────────────────────┤
      │  └─────────────┘                        │
      │         ▲                               │
      │         │                               │
      │  ┌─────────────┐     connectFail()       │
      └─►│ connecting  │───────────────────────►│
      │  └─────────────┘                        │
      │         │                               │
      │         │ connectSuccess()              │
      │         ▼                               │
      │  ┌─────────────┐                        │
      └─►│  connected  │───────────────────────►│ error
      │  └─────────────┘                        │
      │                                        │
      └────────────────────────────────────────┘
```

### 3.2 状态说明

| 状态 | 描述 | 可执行操作 |
|------|------|-----------|
| `disconnected` | 默认状态，未建立连接 | `startConnecting()` |
| `connecting` | 正在建立连接 | `connectSuccess()`, `connectFail()` |
| `connected` | 已成功连接，可使用 | `disconnect()`, `refreshTools()` |
| `error` | 连接失败或异常 | `reset()`, `startConnecting()` |

### 3.3 状态转换规则

```typescript
// 状态转换校验
const stateTransitions: Record<McpServerStatus, McpServerStatus[]> = {
  disconnected: ['connecting', 'error'],
  connecting: ['connected', 'error', 'disconnected'],
  connected: ['disconnected', 'error'],
  error: ['disconnected', 'connecting'],
};
```

---

## 4. McpServerRepository

### 4.1 接口定义

```typescript
// electron/core/domain/repositories/McpServerRepository.ts

import type { McpServer } from '../entities/McpServer';

export interface McpServerRepository {
  // 查询
  findById(id: string): Promise<McpServer | null>;
  findAll(): Promise<McpServer[]>;
  findByStatus(status: McpServerStatus): Promise<McpServer[]>;
  findConnected(): Promise<McpServer[]>;

  // 持久化
  save(server: McpServer): Promise<void>;
  saveAll(servers: McpServer[]): Promise<void>;
  delete(id: string): Promise<void>;

  // 批量操作
  connect(id: string): Promise<void>;
  disconnect(id: string): Promise<void>;
}
```

### 4.2 实现

```typescript
// electron/core/adapters/persistence/McpServerRepository.ts

export class McpServerRepositoryImpl implements McpServerRepository {
  constructor(private storage: Storage) {}

  async findById(id: string): Promise<McpServer | null> {
    const data = await this.storage.get(`mcp:${id}`);
    if (!data) return null;
    return McpServer.fromJSON(JSON.parse(data));
  }

  async findAll(): Promise<McpServer[]> {
    const keys = await this.storage.getKeys('mcp:*');
    const servers: McpServer[] = [];
    for (const key of keys) {
      const data = await this.storage.get(key);
      if (data) {
        servers.push(McpServer.fromJSON(JSON.parse(data)));
      }
    }
    return servers;
  }

  async save(server: McpServer): Promise<void> {
    await this.storage.set(
      `mcp:${server.id}`,
      JSON.stringify(server.toJSON())
    );
  }

  async delete(id: string): Promise<void> {
    await this.storage.delete(`mcp:${id}`);
  }

  // ... 其他方法
}
```

---

## 5. McpManager 集成

### 5.1 重构后的 McpManager

```typescript
// electron/core/adapters/mcp/McpManager.ts

export class McpManager {
  // 使用 Map 存储 McpServer 实体
  private servers: Map<string, McpServer> = new Map();

  // MCP SDK 客户端
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, ClientTransport> = new Map();

  constructor(
    private mcpServerRepository: McpServerRepository,
    private logger: Logger
  ) {}

  /**
   * 加载服务器列表
   */
  async loadServers(): Promise<void> {
    const servers = await this.mcpServerRepository.findAll();
    for (const server of servers) {
      this.servers.set(server.id, server);
    }
  }

  /**
   * 添加服务器
   */
  async addServer(props: McpServerProps): Promise<McpServer> {
    const server = new McpServer(props);
    await this.mcpServerRepository.save(server);
    this.servers.set(server.id, server);
    return server;
  }

  /**
   * 连接服务器（完整流程）
   */
  async connect(serverId: string): Promise<{ success: boolean; error?: string }> {
    const server = this.servers.get(serverId);
    if (!server) {
      return { success: false, error: `Server ${serverId} not found` };
    }

    try {
      // 状态转换：disconnected/error → connecting
      server.startConnecting();
      await this.mcpServerRepository.save(server);

      // 执行实际连接
      const transport = this.createTransport(server);
      const client = new Client({ name: 'easy-agent', version: '1.0.0' });
      await client.connect(transport);

      // 保存客户端引用
      this.clients.set(serverId, client);
      this.transports.set(serverId, transport);

      // 获取工具列表
      const toolsResponse = await client.listTools();
      const tools = toolsResponse.tools.map(this.mapTool.bind(this));

      // 状态转换：connecting → connected
      server.connectSuccess(tools);
      await this.mcpServerRepository.save(server);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      server.connectFail(errorMessage);
      await this.mcpServerRepository.save(server);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 断开连接
   */
  async disconnect(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) return;

    const client = this.clients.get(serverId);
    if (client) {
      await client.close();
      this.clients.delete(serverId);
      this.transports.delete(serverId);
    }

    server.disconnect();
    await this.mcpServerRepository.save(server);
  }

  /**
   * 获取服务器状态
   */
  getServer(serverId: string): McpServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * 获取所有服务器
   */
  getAllServers(): McpServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * 获取已连接的服务器
   */
  getConnectedServers(): McpServer[] {
    return Array.from(this.servers.values()).filter(s => s.isConnected);
  }

  /**
   * 获取服务器工具列表
   */
  getServerTools(serverId: string): McpTool[] {
    const server = this.servers.get(serverId);
    return server ? server.tools : [];
  }
}
```

---

## 6. 前端 Store 集成

### 6.1 workflow.ts 重构

```typescript
// src/stores/workflow.ts

import { defineStore } from 'pinia';
import type { McpServer, McpTool, McpServerStatus } from '@/stores/types';

interface WorkflowState {
  servers: McpServer[];
  loading: boolean;
}

export const useWorkflowStore = defineStore('workflow', () => {
  const servers = ref<McpServer[]>([]);

  // ============ 计算属性 ============
  const connectedServers = computed(() =>
    servers.value.filter(s => s.status === 'connected')
  );

  const serverToolsMap = computed(() => {
    const map = new Map<string, McpTool[]>();
    for (const server of servers.value) {
      map.set(server.id, server.tools);
    }
    return map;
  });

  // ============ Actions ============

  async function loadServers() {
    loading.value = true;
    try {
      const result = await workflowApi.mcpListServers();
      if (result.success) {
        servers.value = result.servers;
      }
    } finally {
      loading.value = false;
    }
  }

  async function addAndConnectServer(config: McpServerConfig) {
    const result = await workflowApi.mcpConnectWithConfig(config);
    if (result.success) {
      // 重新加载服务器列表
      await loadServers();
    }
    return result;
  }

  async function disconnectServer(serverId: string) {
    const result = await workflowApi.mcpDisconnect(serverId);
    if (result.success) {
      // 更新本地状态
      const server = servers.value.find(s => s.id === serverId);
      if (server) {
        server.status = 'disconnected';
        server.tools = [];
      }
    }
    return result;
  }

  return {
    servers,
    connectedServers,
    serverToolsMap,
    loadServers,
    addAndConnectServer,
    disconnectServer,
  };
});
```

### 6.2 类型定义（前端）

```typescript
// src/types/mcp.ts

export type McpServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface McpServer {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  enabled: boolean;
  status: McpServerStatus;
  tools: McpTool[];
  lastError?: string;
  connectedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 7. 迁移计划

### 7.1 阶段一：创建领域模型
- [ ] 创建 `McpServer` 类
- [ ] 定义类型别名和接口
- [ ] 实现状态转换方法

### 7.2 阶段二：重构 McpManager
- [ ] 集成 McpServer 实体
- [ ] 实现 McpServerRepository 接口
- [ ] 更新连接逻辑

### 7.3 阶段三：前端适配
- [ ] 更新类型定义
- [ ] 简化 workflow store
- [ ] 更新 UI 组件

### 7.4 阶段四：测试验证
- [ ] 单元测试
- [ ] 集成测试
- [ ] UI 验证

---

## 8. 相关文件

| 文件路径 | 说明 |
|---------|------|
| `electron/core/domain/entities/McpServer.ts` | 领域模型类 |
| `electron/core/domain/types.ts` | 类型定义 |
| `electron/core/domain/repositories/McpServerRepository.ts` | 仓储接口 |
| `electron/core/adapters/persistence/McpServerRepository.ts` | 仓储实现 |
| `electron/core/adapters/mcp/McpManager.ts` | MCP 管理器 |
| `src/stores/workflow.ts` | 前端状态管理 |
| `src/types/mcp.ts` | 前端类型定义 |
| `src/views/plugin/PluginView.vue` | UI 组件 |
