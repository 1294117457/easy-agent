# EasyAgent 架构设计文档

> 版本: v0.1.0 MVP
> 日期: 2026-05-26
> 状态: 设计中

---

## 1. 整体架构

### 1.1 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 应用                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                Renderer Process（渲染进程）              │  │
│  │                    Vue 3 前端                         │  │
│  └─────────────────────────────────────────────────────┘  │
│                           │ IPC（双向）                      │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                  Main Process（主进程）                 │  │
│  │                                                     │  │
│  │  ┌───────────────────────────────────────────────┐ │  │
│  │  │           Hexagonal Core（六边形架构核心）       │ │  │
│  │  │                                               │ │  │
│  │  │  ┌─────────────────────────────────────────┐ │ │  │
│  │  │  │          Agent Core（LangGraph 编排）      │ │ │  │
│  │  │  │  - 工作流编排 / 状态机 / 节点执行          │ │ │  │
│  │  │  └─────────────────────────────────────────┘ │ │  │
│  │  │                    │                           │ │  │
│  │  │  ┌────────────────┼───────────────────┐      │ │  │
│  │  │  │                │                    │      │ │  │
│  │  │  │  Port: LLM   Port: Storage  Port: MCP  │ │  │
│  │  │  │       │              │            │      │ │  │
│  │  │  │       ▼              ▼            ▼      │ │  │
│  │  │  │  OpenAI       SQLite     STDIO/SSE       │ │  │
│  │  │  │  Adapter      Adapter    Adapter         │ │  │
│  │  │  │  Anthropic    (本地)      (子进程)       │ │  │
│  │  │  │  Gemini                               │ │  │
│  │  │  └─────────────────────────────────────────┘ │  │
│  │  └───────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 三种通信方式

| 通信方式 | 连接双方 | 方向 | 传输内容 | 说明 |
|---------|---------|------|---------|------|
| **IPC** | 渲染进程 ↔ 主进程 | 双向 | 用户输入、Agent 响应、配置更新 | Electron 内置，进程间通信 |
| **stdio** | 主进程 ↔ MCP 插件 | 双向 | 工具调用指令、执行结果 | MCP 协议标准通信方式 |
| **HTTP** | 主进程 ↔ LLM API | 单向请求 | API Key、Prompt、流式响应 | 外部大模型 API 调用 |

---

## 2. 六边形架构详解

### 2.1 为什么选六边形

| 对比维度 | 传统三层架构 | 六边形架构 |
|---------|------------|-----------|
| 核心依赖 | 依赖具体实现（SQLite、OpenAI SDK） | 核心完全不依赖外部实现 |
| 换实现成本 | 需要改核心代码 | 换一个 Adapter 即可 |
| 测试方式 | 需要真实数据库/API | 可以 Mock 所有 Port |
| 核心复用 | 无法跨项目 | 核心可以嵌入其他应用 |
| 适合场景 | 单一应用，不需要移植 | 核心可能被多端共用 |

**选六边形的理由**：
- 桌面端、移动端可能共用同一个 Agent 核心
- MCP 插件、LLM 厂商、存储方式都可能在未来替换
- 核心（AgentCore）独立后，测试和迭代更方便

### 2.2 核心（Core）

```
AgentCore
├── Domain/           # 领域模型（纯业务概念，无外部依赖）
│   ├── Workflow.ts    # 工作流领域对象
│   ├── Node.ts        # 节点领域对象
│   ├── Message.ts      # 消息领域对象
│   └── types.ts       # 领域类型定义
│
├── Application/       # 应用逻辑（组合 Port，编排业务流程）
│   ├── AgentService.ts     # Agent 对话编排
│   ├── WorkflowService.ts  # 工作流编排管理
│   └── PluginService.ts    # 插件生命周期管理
│
└── Ports/            # 端口接口（定义核心需要什么能力）
    ├── LLM/
    │   └── ILLMPort.ts
    ├── Storage/
    │   └── IStoragePort.ts
    └── MCP/
        └── IMcpPort.ts
```

### 2.3 端口（Ports）定义

#### LLM Port

```typescript
// ports/llm.port.ts
export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ILLMPort {
  readonly provider: string;
  readonly model: string;

  invoke(messages: CoreMessage[]): Promise<LLMResponse>;
  invokeStream(
    messages: CoreMessage[],
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse>;
}
```

#### Storage Port

```typescript
// ports/storage.port.ts
export interface IStoragePort {
  // API Key
  createApiKey(data: CreateApiKeyDTO): ApiKey;
  listApiKeys(): ApiKey[];
  getDecryptedKey(id: string): string | null;
  deleteApiKey(id: string): boolean;

  // Workflow
  createWorkflow(data: CreateWorkflowDTO): Workflow;
  listWorkflows(): Workflow[];
  getWorkflow(id: string): Workflow | null;
  updateWorkflow(id: string, data: Partial<Workflow>): Workflow | null;
  deleteWorkflow(id: string): boolean;

  // Conversation & Message
  createConversation(name?: string): Conversation;
  listConversations(): Conversation[];
  getMessages(convId: string): Message[];
  appendMessage(data: AppendMessageDTO): Message;
  deleteConversation(id: string): boolean;

  // Prompt
  createPrompt(data: CreatePromptDTO): Prompt;
  listPrompts(): Prompt[];
  updatePrompt(id: string, data: Partial<Prompt>): boolean;
  deletePrompt(id: string): boolean;
}
```

#### MCP Port

```typescript
// ports/mcp.port.ts
export interface IMcpPort {
  connect(server: McpServerConfig): Promise<void>;
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
```

### 2.4 适配器（Adapters）

```
adapters/
├── llm/
│   ├── openai.adapter.ts      # 实现 ILLMPort
│   ├── anthropic.adapter.ts    # 实现 ILLMPort
│   └── gemini.adapter.ts       # 实现 ILLMPort
│
├── storage/
│   └── sqlite.adapter.ts       # 实现 IStoragePort
│
└── mcp/
    ├── stdio.adapter.ts        # 实现 IMcpPort（STDIO 模式）
    └── sse.adapter.ts          # 实现 IMcpPort（SSE 模式）
```

---

## 3. Electron 进程模型

### 3.1 Main Process（主进程）

```
Main Process
├── 职责：
│   1. 运行 Agent 核心（LangGraph）
│   2. 管理 MCP 子进程（启动/停止/通信）
│   3. 访问本地 SQLite 数据库
│   4. 调用 LLM API（HTTP）
│   5. 处理 IPC 消息
│
├── 数据存储：
│   └── ~/Library/Application Support/EasyAgent/data/
│       ├── easy-agent.db       # SQLite 数据库
│       └── config.json         # 用户配置
│
└── 生命周期：
    ├── 启动 → 初始化核心 → 连接 MCP → 等待 IPC
    ├── 退出 → 断开 MCP → 保存状态 → 退出
    └── MCP 子进程由主进程管理（spawn/kill）
```

### 3.2 Renderer Process（渲染进程）

```
Renderer Process
├── 职责：
│   1. 渲染 Vue 3 UI
│   2. 接收用户输入
│   3. 通过 IPC 调用主进程
│   4. 渲染 Agent 响应
│
├── 数据存储：
│   └── IndexedDB（仅缓存，非持久化）
│
└── IPC 调用方式：
    ├── ipcRenderer.invoke('chat:send', message)   # 请求
    ├── ipcRenderer.on('agent:token', callback)    # 流式响应
    └── ipcRenderer.on('agent:status', callback)   # 状态更新
```

### 3.3 IPC 通信协议

```typescript
// preload.ts — 暴露安全的 IPC API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 对话
  sendMessage: (message: string) => ipcRenderer.invoke('chat:send', message),
  onToken: (callback: (token: string) => void) =>
    ipcRenderer.on('agent:token', (_, token) => callback(token)),
  onStatusChange: (callback: (status: AgentStatus) => void) =>
    ipcRenderer.on('agent:status', (_, status) => callback(status)),

  // 配置
  getConfig: () => ipcRenderer.invoke('config:get'),
  updateConfig: (config: Partial<AppConfig>) =>
    ipcRenderer.invoke('config:update', config),

  // MCP
  connectMcp: (config: McpServerConfig) =>
    ipcRenderer.invoke('mcp:connect', config),
  disconnectMcp: (serverId: string) =>
    ipcRenderer.invoke('mcp:disconnect', serverId),
  listMcpServers: () => ipcRenderer.invoke('mcp:list'),
  listMcpTools: (serverId: string) =>
    ipcRenderer.invoke('mcp:tools', serverId),

  // 工作流
  listWorkflows: () => ipcRenderer.invoke('workflow:list'),
  saveWorkflow: (data: Workflow) =>
    ipcRenderer.invoke('workflow:save', data),
  executeWorkflow: (workflowId: string, input: unknown) =>
    ipcRenderer.invoke('workflow:execute', workflowId, input),

  // Prompt
  listPrompts: () => ipcRenderer.invoke('prompt:list'),
  savePrompt: (data: Prompt) => ipcRenderer.invoke('prompt:save', data),
});
```

---

## 4. 领域模型（Domain）

### 4.1 核心对象关系

```
┌─────────────┐    1      N    ┌─────────────┐
│ Conversation │─────────────▶│   Message    │
│   对话会话   │               │    消息      │
└─────────────┘               └─────────────┘
       │
       │ N
       ▼
┌─────────────┐    1      N    ┌─────────────┐
│  Workflow   │─────────────▶│    Node     │
│   工作流    │               │    节点     │
└─────────────┘               └─────────────┘
       │                            │
       │ N                          │ N
       ▼                            ▼
┌─────────────┐               ┌─────────────┐
│ Execution   │               │    Edge    │
│  执行记录   │               │    连线     │
└─────────────┘               └─────────────┘

┌─────────────┐    1      N    ┌─────────────┐
│   ApiKey    │─────────────▶│   Prompt    │
│   凭证      │               │   模板      │
└─────────────┘               └─────────────┘

┌─────────────┐    1      N    ┌─────────────┐
│ McpServer  │─────────────▶│   McpTool   │
│ MCP服务器   │               │   工具      │
└─────────────┘               └─────────────┘
```

### 4.2 领域对象定义

```typescript
// domain/types.ts

export type NodeType = 'input' | 'llm' | 'mcp_tool' | 'output' | 'condition';
export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
export type AgentStatus = 'idle' | 'thinking' | 'working' | 'happy' | 'error';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  position: { x: number; y: number };
  config: NodeConfig;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  name: string;
  workflowId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  createdAt: string;
}

export interface Prompt {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface McpServer {
  id: string;
  name: string;
  type: 'stdio' | 'sse';
  command?: string;
  url?: string;
  enabled: boolean;
}

export interface McpTool {
  id: string;
  serverId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  enabled: boolean;
}
```

---

## 5. 目录结构

```
easy-agent/
├── electron/                    # Electron 主进程（Node.js）
│   ├── main.ts                # 入口
│   ├── preload.ts              # Context Bridge
│   ├── ipc/                    # IPC 处理器
│   │   ├── chat.handler.ts
│   │   ├── config.handler.ts
│   │   ├── mcp.handler.ts
│   │   └── workflow.handler.ts
│   │
│   └── core/                   # 六边形架构核心
│       ├── ports/              # 端口定义
│       │   ├── llm.port.ts
│       │   ├── storage.port.ts
│       │   └── mcp.port.ts
│       │
│       ├── adapters/           # 适配器实现
│       │   ├── llm/
│       │   │   ├── openai.adapter.ts
│       │   │   └── anthropic.adapter.ts
│       │   ├── storage/
│       │   │   └── sqlite.adapter.ts
│       │   └── mcp/
│       │       ├── stdio.adapter.ts
│       │       └── sse.adapter.ts
│       │
│       ├── domain/             # 领域模型
│       │   ├── types.ts
│       │   ├── Workflow.ts
│       │   ├── Message.ts
│       │   └── ...
│       │
│       ├── application/        # 应用逻辑
│       │   ├── AgentService.ts
│       │   ├── WorkflowService.ts
│       │   └── PluginService.ts
│       │
│       └── index.ts           # 核心导出（供 IPC Handler 调用）
│
├── renderer/                   # 渲染进程（Vue 3 前端）
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── router/
│   │   ├── views/
│   │   ├── components/
│   │   ├── stores/
│   │   ├── api/               # IPC 封装（调用 preload 暴露的 API）
│   │   ├── types/
│   │   └── styles/
│   ├── index.html
│   └── vite.config.ts
│
├── shared/                     # 前后端共享类型
│   └── types/
│       ├── domain.ts
│       └── ipc.ts
│
├── package.json
├── electron-builder.json        # 打包配置
├── vite.config.ts
└── tsconfig.json
```

---

## 6. 技术选型

| 组件 | 技术选型 | 说明 |
|------|---------|------|
| **桌面应用框架** | Electron 30+ | Chromium + Node.js |
| **前端框架** | Vue 3 + TypeScript | 组合式 API |
| **状态管理** | Pinia | Vue 官方推荐 |
| **流程图** | Vue Flow | 可视化工作流编排 |
| **Agent 编排** | LangGraph | 状态图定义工作流 |
| **MCP 通信** | @modelcontextprotocol/sdk | Anthropic 官方 |
| **本地数据库** | better-sqlite3 | SQLite，Electron 原生支持 |
| **LLM SDK** | @langchain/openai, @langchain/anthropic | 多模型支持 |
| **IPC 类型安全** | electron-trpc | 类型安全的 IPC 调用 |
| **构建工具** | Vite + electron-builder | 开发体验 + 打包 |

---

## 7. 生命周期

### 7.1 应用启动流程

```
用户启动应用
      │
      ▼
Main Process 启动
      │
      ├── 读取用户配置（~/Library/.../config.json）
      ├── 初始化 SQLite（连接数据库）
      │
      ▼
Hexagonal Core 初始化
      │
      ├── 加载 API Key（从 SQLite 解密）
      ├── 初始化 LLM Adapter（根据配置的模型）
      ├── 初始化 Storage Adapter（SQLite）
      ├── 初始化 MCP Adapter（不立即连接，按需连接）
      │
      ▼
IPC 服务就绪
      │
      ├── 注册 IPC Handler
      └── 监听 Renderer 连接
      │
      ▼
Renderer 启动
      │
      ├── Vue 3 挂载
      ├── 加载对话历史
      ├── 连接 MCP Server（用户已启用的）
      │
      ▼
应用就绪（显示主界面）
```

### 7.2 对话执行流程

```
用户输入消息 → Renderer
      │ IPC: chat:send
      ▼
IPC Handler → AgentService
      │
      ├── 加载对话历史（Storage Port）
      ├── 加载 Prompt 模板（Storage Port）
      │
      ▼
LangGraph 执行
      │
      ├── LLM 节点 → LLM Port（Adapter → OpenAI/Claude API）
      │
      ├── 工具调用节点 → MCP Port（Adapter → 子进程 STDIO）
      │          │
      │          └── MCP 子进程执行工具
      │                    │
      │          ◀─────────┘
      │
      │  IPC: agent:token（每个 token 实时推送）
      │  ◀─────────────────────────────────
      │
      │  IPC: agent:tool_call（工具调用事件）
      │  ◀─────────────────────────────────
      │
      ▼
回复生成完毕
      │
      ├── 保存消息到 SQLite（Storage Port）
      │
      ▼
IPC: agent:done
      ▼
Renderer 渲染完成
```

---

## 8. 与之前文档的差异

| 对比项 | 之前（Web 版） | 现在（Electron 版） |
|-------|-------------|------------------|
| 部署形态 | 云端服务 | 本地桌面应用 |
| 数据存储 | SQLite 在服务器 | SQLite 在本地用户目录 |
| 通信方式 | HTTP REST API | Electron IPC |
| 前端代理 | 需要 Vite 代理 | 无需代理，直连主进程 |
| 离线能力 | 必须联网 | 完全离线可用 |
| LLM 调用 | 从前端发 HTTP | 从主进程发 HTTP |
| MCP 连接 | 服务器上运行 | 本地运行 |
| 多端扩展 | 需要单独部署后端 | 核心代码共用 |

---

*文档版本: v0.1.0 | 最后更新: 2026-05-26*
