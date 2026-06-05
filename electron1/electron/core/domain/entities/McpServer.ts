import type { McpTool } from '../types.js';

export type McpServerType = 'stdio' | 'sse' | 'http';

export type McpServerStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

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

export class McpServer {
  // ============ 配置属性（只读） ============
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

  // ============ 运行时状态（私有） ============
  private _status: McpServerStatus = 'disconnected';
  private _lastError?: string;
  private _connectedAt?: Date;
  private _updatedAt: Date;
  private _tools: McpTool[] = [];

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
  get status(): McpServerStatus { return this._status; }
  get lastError(): string | undefined { return this._lastError; }
  get connectedAt(): Date | undefined { return this._connectedAt; }
  get isConnected(): boolean { return this._status === 'connected'; }
  get isConnecting(): boolean { return this._status === 'connecting'; }
  get hasError(): boolean { return this._status === 'error'; }
  get isDisconnected(): boolean { return this._status === 'disconnected'; }

  // ============ 工具列表管理（运行时状态） ============
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

  // ============ 业务方法（状态转换） ============

  startConnecting(): void {
    if (this._status === 'connecting') throw new Error(`${this.name} is already connecting`);
    if (this._status === 'connected') throw new Error(`${this.name} is already connected`);
    this._status = 'connecting';
    this._lastError = undefined;
    this._updatedAt = new Date();
  }

  connectSuccess(): void {
    if (this._status !== 'connecting') throw new Error(`${this.name} must be connecting, current: ${this._status}`);
    this._status = 'connected';
    this._connectedAt = new Date();
    this._lastError = undefined;
    this._updatedAt = new Date();
  }

  connectFail(error: string): void {
    if (this._status !== 'connecting') throw new Error(`${this.name} must be connecting`);
    this._status = 'error';
    this._lastError = error;
    this._updatedAt = new Date();
  }

  disconnect(): void {
    this._status = 'disconnected';
    this._connectedAt = undefined;
    this._tools = [];
    this._updatedAt = new Date();
  }

  reset(): void {
    this._status = 'disconnected';
    this._lastError = undefined;
    this._updatedAt = new Date();
  }

  // ============ 配置更新 ============

  /**
   * 创建配置副本并更新（保持 ID 和运行时状态不变）
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
      this.id
    );
    newServer._status = this._status;
    newServer._lastError = this._lastError;
    newServer._connectedAt = this._connectedAt;
    newServer._tools = [...this._tools];
    newServer._updatedAt = this._updatedAt;
    return newServer;
  }

  // ============ 序列化 ============

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
    server._status = json.status;
    server._updatedAt = new Date(json.updatedAt);
    if (json.connectedAt) server._connectedAt = new Date(json.connectedAt);
    if (json.lastError) server._lastError = json.lastError;
    return server;
  }

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

  getConnectionConfig(): McpServerProps & { id: string; name: string; type: McpServerType } {
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
