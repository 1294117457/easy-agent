# 03. 架构整体设计

> 版本: v0.2.0 MVP
> 日期: 2026-05-26
> 前置: 你理解六边形架构、领域模型、Port、Adapter、四种通信方式

---

## 1. 整体架构图

```
┌────────────────────────────────────────────────────────────────────┐
│                      Electron 应用                                    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Renderer Process                              │  │
│  │                      Vue 3 前端                                │  │
│  │              window.electronAPI 调用                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │ IPC（双向）                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Main Process                               │  │
│  │                                                            │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │                 ipc/（通信层：渲染层 ↔ Core）              │ │  │
│  │  │  chat.handler / config.handler / mcp.handler / workflow  │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  │                              │                               │  │
│  │  ┌──────────────────────────┼──────────────────────────────┐ │  │
│  │  │                          │                              │ │  │
│  │  │                          ▼                              │ │  │
│  │  │               ┌─────────────────────┐                   │ │  │
│  │  │               │   core/index.ts    │                   │ │  │
│  │  │               │   EasyAgentCore    │                   │ │  │
│  │  │               └─────────┬───────────┘                   │ │  │
│  │  │                         │                               │ │  │
│  │  │  ┌─────────────────────┴───────────────────────┐      │ │  │
│  │  │  │                                               │      │ │  │
│  │  │  ▼                                               ▼      │ │  │
│  │  │ ┌──────────────┐                      ┌──────────────┐ │ │  │
│  │  │ │Application层 │                      │  Domain 层   │ │ │  │
│  │  │ │AgentService │                      │Workflow/Conv │ │ │  │
│  │  │ │WorkflowSvc  │                      │Prompt/Message│ │ │  │
│  │  │ └──────┬───────┘                      └──────────────┘ │ │  │
│  │  │        │                                         │      │ │  │
│  │  │        ▼                                         │      │ │  │
│  │  │ ┌─────────────────────────────────────────────┐  │      │ │  │
│  │  │ │              Ports（接口层）                    │  │      │ │  │
│  │  │ │  ILLMPort     IStoragePort      IMcpPort     │  │      │ │  │
│  │  │ └─────────────────────────────────────────────┘  │      │ │  │
│  │  │                        │                        │      │ │  │
│  │  │  ┌─────────────────────┼─────────────────────┐ │      │ │  │
│  │  │  │                     │                     │ │      │ │  │
│  │  │  ▼                     ▼                     ▼ │      │ │  │
│  │  │ http/               storage/           stdio/       │ │  │
│  │  │ OpenAIAdapter     SQLiteAdapter     StdioAdapter   │ │  │
│  │  │ AnthropicAdapter                        remote/     │ │  │
│  │  │                                              remote/ │ │  │
│  │  └──────────────────────────────────────────────────────┘  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘

四种通信方式：
  渲染层 ↔ Core           → IPC（Electron）
  Core → LLM（HTTP）      → HTTP
  Core → 本地插件（stdio） → stdio
  Core → 远程插件（HTTP）  → HTTP
  Core → 本地文件          → 直接文件操作
```

---

## 2. 每层的职责

| 层 | 目录 | 职责 | 通信方式 |
|----|------|------|---------|
| **Renderer** | `renderer/` | Vue 3 前端，接收用户输入，渲染响应 | — |
| **IPC** | `ipc/` | 渲染层和 Core 之间的桥梁 | IPC |
| **Domain** | `core/domain/` | 领域模型（纯业务概念，无外部依赖） | — |
| **Application** | `core/application/` | 组合 Port，编排业务流程 | — |
| **Ports** | `core/ports/` | 定义核心需要的接口 | — |
| **Adapters** | `core/adapters/` | 实现 Port，对接外部技术 | HTTP / stdio / 文件 |
| **Main** | `main.ts` | Electron 入口，装配所有组件 | — |
| **Preload** | `preload.ts` | 安全暴露 API 给渲染进程 | — |

---

## 3. 目录结构

```
easy-agent/
├── electron/
│   ├── main.ts                   # 入口：启动 + 装配
│   ├── preload.ts                # Context Bridge 安全暴露 API
│   │
│   ├── ipc/                     # 通信层：渲染层 ↔ Core（IPC）
│   │   ├── chat.handler.ts
│   │   ├── config.handler.ts
│   │   ├── mcp.handler.ts
│   │   └── workflow.handler.ts
│   │
│   └── core/                     # 核心层（不含外部依赖）
│       ├── index.ts              # 核心统一导出
│       │
│       ├── domain/               # 领域层（纯业务）
│       │   ├── types.ts
│       │   ├── Conversation.ts
│       │   ├── Workflow.ts
│       │   ├── Prompt.ts
│       │   └── index.ts
│       │
│       ├── application/           # 应用层
│       │   ├── AgentService.ts
│       │   └── WorkflowService.ts
│       │
│       ├── ports/                # 接口层
│       │   ├── llm.port.ts
│       │   ├── storage.port.ts
│       │   ├── mcp.port.ts
│       │   └── index.ts
│       │
│       └── adapters/             # 通信层：Core ↔ 外部世界
│           ├── http/            # HTTP 通信
│           │   ├── openai.adapter.ts
│           │   ├── anthropic.adapter.ts
│           │   └── remote.adapter.ts
│           ├── stdio/           # stdio 通信
│           │   └── stdio.adapter.ts
│           └── storage/         # 文件系统通信
│               └── sqlite.adapter.ts
│
├── renderer/                     # 渲染进程
│   └── ...
│
└── shared/                       # 前后端共享类型
    └── types/
        └── ipc.ts
```

---

## 4. 调用方向（依赖倒置）

```
正确的依赖方向（永远向内）：
  Renderer → IPC → Application → Port（接口）← Adapters（实现）

错误的方向（绝对禁止）：
  Application → Adapter（直接 import 了具体实现）
  Domain → Adapter（domain 不应该依赖外部）
  IPC → Adapter（IPC 应该只调用核心）
```

---

## 5. IPC Handler 设计

### 职责

```
IPC Handler 是黏合层，职责：
├── 接收渲染进程的 IPC 调用
├── 调用 EasyAgentCore 的方法
└── 把结果返回给渲染进程
```

### 原则

```
IPC Handler 只调用 EasyAgentCore，不直接调用任何 Adapter。
IPC Handler 只依赖 core/index.ts，不依赖 core/adapters/ 下任何文件。
```

### chat.handler.ts

```
文件：ipc/chat.handler.ts

导出函数：registerChatHandlers(ipcMain, core)

注册 IPC 通道：
├── chat:send
│   ├── 接收：message: string
│   ├── 行为：
│   │   ├── 调用 core.getStorage().createConversation() 创建新对话
│   │   ├── 调用 core.sendMessage()，传入回调
│   │   └── 返回 Promise<conversationId>
│   │
│   └── 回调
│       ├── onToken    → 推送到 Renderer
│       ├── onToolCall → 推送到 Renderer
│       ├── onDone     → resolve
│       └── onError    → reject
│
├── chat:history
│   ├── 接收：conversationId: string
│   └── 返回：Message[]
│
└── chat:rename
    ├── 接收：{ id: string, name: string }
    └── 返回：boolean
```

### config.handler.ts

```
文件：ipc/config.handler.ts

导出函数：registerConfigHandlers(ipcMain, storage)

注册 IPC 通道：
├── config:get
│   └── 返回：{ apiKeys, prompts, mcpServers }
│
├── config:apiKey:create
│   ├── 接收：CreateApiKeyDTO
│   └── 调用：storage.createApiKey()
│
├── config:apiKey:delete
│   ├── 接收：id: string
│   └── 调用：storage.deleteApiKey()
│
├── config:prompt:create
│   ├── 接收：CreatePromptDTO
│   └── 调用：storage.createPrompt()
│
└── config:prompt:delete
    ├── 接收：id: string
    └── 调用：storage.deletePrompt()
```

### mcp.handler.ts

```
文件：ipc/mcp.handler.ts

导出函数：registerMcpHandlers(ipcMain, core)

注册 IPC 通道：
├── mcp:connect
│   ├── 接收：McpServer 配置对象
│   ├── 调用：core.getMcp().connect(server)
│   ├── 调用：core.getMcp().listTools(server.id)
│   ├── 调用：core.getStorage().saveMcpTools()
│   └── 返回：{ id, name }
│
├── mcp:disconnect
│   ├── 接收：serverId: string
│   └── 调用：core.getMcp().disconnect(serverId)
│
├── mcp:list
│   └── 调用：core.getStorage().listMcpServers()
│
└── mcp:tools
    ├── 接收：serverId: string
    └── 调用：core.getStorage().listMcpTools(serverId)
```

### workflow.handler.ts

```
文件：ipc/workflow.handler.ts

导出函数：registerWorkflowHandlers(ipcMain, core)

注册 IPC 通道：
├── workflow:list
│   └── 调用：core.getStorage().listWorkflows()
│
├── workflow:save
│   ├── 接收：CreateWorkflowDTO
│   ├── 调用：core.getStorage().createWorkflow()
│   └── 返回：Workflow
│
├── workflow:delete
│   ├── 接收：id: string
│   └── 调用：core.getStorage().deleteWorkflow()
│
└── workflow:execute
    ├── 接收：{ workflowId: string, input: unknown }
    ├── 调用：WorkflowService.execute()
    └── 返回：执行结果
```

---

## 6. EasyAgentCore 设计

```
文件：core/index.ts

类：EasyAgentCore
├── 私有属性
│   ├── llmPort: ILLMPort
│   ├── storagePort: IStoragePort
│   ├── mcpPort: IMcpPort
│   └── agentService: AgentService
│
├── 构造函数
│   ├── 参数：(storageAdapter: IStoragePort, mcpAdapter: IMcpPort)
│   ├── 行为：
│   │   ├── 接收两个 Adapter 实例
│   │   ├── 从 storageAdapter 获取 API Key
│   │   ├── 解密 API Key
│   │   ├── 创建 LLM Adapter
│   │   └── 创建 AgentService
│   └── 注意：不接收 llmAdapter，而是内部构造（从配置创建）
│
├── 对话方法
│   └── sendMessage(conversationId, userInput, callbacks)
│       └── 委托给 agentService.sendMessage()
│
├── 存储代理
│   └── getStorage(): IStoragePort
│       └── 返回 storagePort，供 IPC Handler 使用
│
├── MCP 代理
│   └── getMcp(): IMcpPort
│       └── 返回 mcpPort，供 IPC Handler 使用
│
└── LLM 重载
    └── reloadLLM(provider, model, apiKey)
        └── 重新创建 LLM Adapter 和 AgentService
```

---

## 7. main.ts 设计

```
文件：electron/main.ts

职责：装配层，初始化一切

启动流程：
├── 1. 定义 getDbPath()
│   └── 使用 app.getPath('userData') + 'data/easy-agent.db'
│
├── 2. 定义 createWindow()
│   ├── 创建 BrowserWindow
│   ├── 设置 preload 路径
│   ├── 开启 contextIsolation，关闭 nodeIntegration
│   ├── 开发模式：loadURL('http://localhost:5173')
│   └── 生产模式：loadFile() 加载打包后的 HTML
│
├── 3. app.whenReady()
│   ├── 实例化 SQLiteAdapter
│   ├── 实例化 StdioMcpAdapter
│   ├── 实例化 EasyAgentCore（注入 Adapter）
│   ├── 注册所有 IPC Handler
│   ├── 注册 MCP 工具调用事件推送（onToolCall）
│   ├── 创建 BrowserWindow
│   └── 监听 activate 事件（macOS）
│
└── 4. app.on('window-all-closed')
    └── macOS 除外，退出应用
```

### IPC 事件推送通道（从 Core 到 Renderer）

```
main.ts 中需要注册的事件推送：

core.getMcp().onToolCall((event) => {
  mainWindow.webContents.send('agent:tool_call', event);
});

core.getMcp().onDisconnect((serverId) => {
  mainWindow.webContents.send('mcp:disconnected', serverId);
});

// 注意：LLM token 推送由 chat.handler 内部处理
```

---

## 8. preload.ts 设计

```
文件：electron/preload.ts

方式：contextBridge.exposeInMainWorld('electronAPI', { ... })

暴露 API 给渲染进程（前端调用这些方法）：

├── 对话
│   ├── sendMessage(message)  → chat:send
│   ├── getHistory(convId)   → chat:history
│   └── renameConversation()  → chat:rename
│
├── 事件推送（主进程 → 渲染进程）
│   ├── onToken(cb)         ← 监听 agent:token
│   ├── onToolCall(cb)      ← 监听 agent:tool_call
│   ├── onDone(cb)          ← 监听 agent:done
│   ├── onError(cb)         ← 监听 agent:error
│   └── onStatusChange(cb)  ← 监听 agent:status
│
├── 配置
│   ├── getConfig()          → config:get
│   ├── createApiKey(dto)   → config:apiKey:create
│   ├── deleteApiKey(id)    → config:apiKey:delete
│   ├── createPrompt(dto)   → config:prompt:create
│   └── deletePrompt(id)    → config:prompt:delete
│
├── MCP
│   ├── connectMcp(config)  → mcp:connect
│   ├── disconnectMcp(id)    → mcp:disconnect
│   ├── listMcpServers()    → mcp:list
│   └── listMcpTools(id)    → mcp:tools
│
└── 工作流
    ├── listWorkflows()     → workflow:list
    ├── saveWorkflow(dto)    → workflow:save
    ├── deleteWorkflow(id)   → workflow:delete
    └── executeWorkflow(id)  → workflow:execute
```

---

## 9. 通信方向总结

```
请求流（渲染进程 → 核心）：
  Renderer
    → ipcRenderer.invoke('chat:send', message)
    → chat.handler.ts
    → EasyAgentCore.sendMessage()
    → AgentService.sendMessage()
    → ILLMPort.invoke() → OpenAIAdapter
                              → HTTP → OpenAI API

事件流（核心 → 渲染进程）：
  OpenAI API（HTTP 响应）
    → OpenAIAdapter.invokeStream()
    → onChunk 回调
    → EasyAgentCore → chat.handler
    → ipcMain.send('agent:token', token)
    → preload → window.electronAPI.onToken(cb)
    → Renderer 更新 UI

MCP 事件流：
  MCP 子进程（stdio）
    → StdioMcpAdapter.callTool()
    → onToolCall 回调
    → mainWindow.webContents.send('agent:tool_call', event)
    → preload → window.electronAPI.onToolCall(cb)
    → Renderer 显示工具调用
```

---

## 10. 记住

```
main.ts        → 装配一切（创建 Adapter，new EasyAgentCore，注册 Handler）
preload.ts     → 安全暴露 API 给渲染进程
ipc/           → 接收请求，调用核心
core/index.ts  → 核心统一出口
domain/        → 业务概念，不依赖任何东西
ports/         → 接口定义，不写实现
adapters/      → 实现接口，按通信方式分类（http / stdio / storage）
```

---

*文档版本: v0.2.0 | 最后更新: 2026-05-26*
