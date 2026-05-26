# MVP 初始阶段开发文档

> 版本: v0.1.0 MVP
> 日期: 2026-05-26
> 目标：先让"输入一句话，AI 回复"跑通
> 原则：Electron 骨架优先，先跑起来，再填细节

---

## 1. 整体目标

```
最终效果：
  用户打开应用
  → 输入"你好"
  → AI 回复"你好！有什么可以帮你的？"

做到这些就够了：
  ✅ Electron 骨架（能打开窗口）
  ✅ SQLite 存储（能保存 API Key 和对话历史）
  ✅ OpenAI 调用（能对话）
  ✅ IPC 打通（前端能调用后端）
```

---

## 2. 阶段一：Electron 骨架

### 目标

```
Electron 能启动，窗口能打开，前端能渲染
```

### 目录结构

```
easy-agent/
├── electron/
│   ├── main.ts              # Electron 入口
│   ├── preload.ts           # Context Bridge
│   └── core/
│       └── index.ts         # 核心导出（空的，先占位）
│
└── renderer/                  # Vue 3 前端（已有）
    └── ...
```

### 创建 main.ts

```
文件：electron/main.ts

职责：
├── 创建 BrowserWindow
├── 设置窗口大小（1200 x 800）
├── 设置 preload 路径
├── 开启 contextIsolation，关闭 nodeIntegration
└── 加载前端页面

加载逻辑：
├── 开发模式：loadURL('http://localhost:5173')
└── 生产模式：loadFile() 加载打包后的 HTML
```

### 创建 preload.ts

```
文件：electron/preload.ts

职责：通过 contextBridge 安全暴露 API

初始只需要暴露一个测试 API：
├── ping() → 返回 'pong'
└── 用于验证 IPC 通道是否打通

后续再扩展其他 API。
```

### 创建 core/index.ts

```
文件：electron/core/index.ts

职责：核心统一导出

初始版本：
├── 导出一个空的 EasyAgentCore class
└── 先让 Electron 能启动，不急着实现具体逻辑
```

### 验证方式

```
在 electron 目录运行：
  npm run dev 或 electron main.ts

预期结果：
  → Electron 窗口打开
  → 窗口大小 1200x800
  → 加载前端页面
  → DevTools 能打开（F12）
```

---

## 3. 阶段二：Storage 存储

### 目标

```
能添加 API Key，能保存对话历史，数据重启后还在
```

### 目录结构

```
electron/core/
├── domain/
│   └── types.ts           # 所有领域类型定义
│
├── ports/
│   └── storage.port.ts    # 存储接口定义
│
└── adapters/
    └── storage/
        └── sqlite.adapter.ts  # SQLite 实现
```

### types.ts — 类型定义

```
文件：electron/core/domain/types.ts

导出内容：
├── 枚举
│   ├── MessageRole    = 'user' | 'assistant' | 'system'
│   ├── WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed'
│   └── NodeType      = 'input' | 'llm' | 'mcp_tool' | 'output'
│
├── 接口
│   ├── Message         { id, conversationId, role, content, model?, createdAt }
│   ├── Conversation    { id, name, workflowId?, createdAt, updatedAt }
│   ├── Prompt          { id, name, description?, systemPrompt, isBuiltin, createdAt, updatedAt }
│   ├── Workflow        { id, name, description?, nodes, edges, status, createdAt, updatedAt }
│   ├── WorkflowNode    { id, type, label, position, config }
│   ├── WorkflowEdge    { id, source, target, label? }
│   ├── McpServer       { id, name, type, command?, url?, enabled }
│   ├── McpTool         { id, serverId, name, description, inputSchema, enabled }
│   └── ApiKey          { id, provider, model, enabled }
│
└── DTO
    ├── CreateConversationDTO  { name? }
    ├── AppendMessageDTO       { conversationId, role, content, model? }
    ├── CreateApiKeyDTO        { provider, key, model }
    ├── CreatePromptDTO        { name, description?, systemPrompt, isBuiltin? }
    └── ValidationResult        { valid: boolean; error?: string }
```

### storage.port.ts — 存储接口

```
文件：electron/core/ports/storage.port.ts

接口：IStoragePort

API Key 操作：
├── createApiKey(dto)   → { id, provider, model, enabled }
├── listApiKeys()       → ApiKey[]
├── getDecryptedKey(id) → string | null
└── deleteApiKey(id)    → boolean

Conversation 操作：
├── createConversation(dto?)  → Conversation
├── listConversations()       → Conversation[]
├── getMessages(convId)     → Message[]
├── appendMessage(dto)       → Message
└── deleteConversation(id)  → boolean

Prompt 操作：
├── createPrompt(dto)   → Prompt
├── listPrompts()       → Prompt[]
├── updatePrompt(id, data) → boolean
└── deletePrompt(id)   → boolean
```

### sqlite.adapter.ts — SQLite 实现

```
文件：electron/core/adapters/storage/sqlite.adapter.ts

类：SQLiteAdapter
├── 实现接口：IStoragePort
│
├── 构造函数
│   ├── 参数：(dbPath: string, masterPassword: string)
│   └── 行为：
│       ├── 打开 SQLite 数据库
│       ├── 设置 WAL 模式
│       ├── 执行建表语句
│       └── 创建 KeyEncryptor（用于加密 API Key）
│
└── 建表语句：
    ├── api_keys       （id, provider, encrypted_key, model, enabled, 时间戳）
    ├── conversations  （id, name, workflow_id, 时间戳）
    ├── messages       （id, conversation_id, role, content, model, 时间戳）
    └── prompts        （id, name, description, system_prompt, is_builtin, 时间戳）

说明：
  Workflow、McpServer、McpTool 的表也可以先建好，
  虽然暂时不操作，但 schema 保持完整。
```

### KeyEncryptor — API Key 加密

```
类：KeyEncryptor（SQLiteAdapter 内部私有类）

职责：加密存储 API Key，防止泄露

方法：
├── encrypt(key: string) → string
│   └── 输入明文 key，返回加密字符串
│
└── decrypt(data: string) → string
    └── 输入加密字符串，返回明文 key

实现：使用 AES-256-GCM + scrypt 密钥派生
```

### 验证方式

```
步骤：
  1. 添加一个 API Key（provider = 'openai', model = 'gpt-4o', key = 'sk-xxx'）
  2. 关闭应用
  3. 重新打开应用
  4. 列出所有 API Key

预期结果：
  → API Key 还在列表里（key 本身不显示）
  → 重启后数据持久化
```

---

## 4. 阶段三：LLM 对话

### 目标

```
能调用 OpenAI API，AI 能回复
```

### 目录结构

```
electron/core/
├── ports/
│   └── llm.port.ts      # LLM 接口定义
│
├── adapters/
│   └── http/
│       └── openai.adapter.ts  # OpenAI 实现
│
└── application/
    └── AgentService.ts  # 对话逻辑
```

### llm.port.ts — LLM 接口

```
文件：electron/core/ports/llm.port.ts

接口：ILLMPort

属性：
├── provider: string    # 'openai' | 'anthropic'
└── model: string       # 'gpt-4o' | 'claude-3-5-sonnet'

方法：
├── invoke(messages) → Promise<LLMResponse>
│   └── 普通调用，返回完整响应
│
└── invokeStream(messages, onChunk) → Promise<LLMResponse>
    ├── 参数：onChunk: (chunk: string) => void
    └── 流式调用，每个 token 实时回调 onChunk

类型：LLMResponse
├── content: string
└── usage?: { promptTokens, completionTokens, totalTokens }
```

### openai.adapter.ts — OpenAI 实现

```
文件：electron/core/adapters/http/openai.adapter.ts

类：OpenAIAdapter
├── 实现接口：ILLMPort
│
├── 构造函数
│   └── 参数：(model: string, apiKey: string)
│       └── 创建 @langchain/openai 的 ChatOpenAI 实例
│
└── 方法
    ├── invoke(messages)
    │   └── 调用 llm.invoke()，返回 content
    │
    └── invokeStream(messages, onChunk)
        └── 调用 llm.stream()，逐 chunk 调用 onChunk
```

### AgentService.ts — 对话逻辑

```
文件：electron/core/application/AgentService.ts

类：AgentService

构造函数：
├── 参数：(llmPort: ILLMPort, storagePort: IStoragePort)
└── 接收 Port 实例，不直接依赖 Adapter

方法：
├── sendMessage(conversationId, userInput, callbacks)
│   ├── 接收：
│   │   ├── conversationId: string
│   │   ├── userInput: string
│   │   └── callbacks: { onToken, onToolCall, onDone, onError }
│   │
│   └── 行为：
│       ├── 1. 保存用户消息到数据库
│       ├── 2. 加载对话历史（getMessages）
│       ├── 3. 构建 messages 数组（转成 LangChain 格式）
│       ├── 4. 调用 llmPort.invokeStream()
│       ├── 5. 每个 token 通过 onChunk 回调推送
│       ├── 6. 保存 AI 回复到数据库
│       └── 7. 回调 onDone
│
└── 注意：
    ├── 核心逻辑在这里，不在 Adapter 里
    ├── Adapter 只负责"怎么发送请求"
    ├── Service 负责"什么时候发、发什么、保存什么"
```

### core/index.ts — 核心统一导出

```
文件：electron/core/index.ts

类：EasyAgentCore

构造函数：
├── 参数：(storageAdapter: IStoragePort)
│
├── 行为：
│   ├── 接收 Storage Adapter
│   ├── 从 Storage 读取第一个可用的 API Key
│   ├── 解密 API Key
│   ├── 创建 OpenAI Adapter
│   └── 创建 AgentService
│
└── 方法：
    ├── sendMessage(conversationId, userInput, callbacks)
    │   └── 委托给 AgentService
    │
    └── getStorage(): IStoragePort
        └── 返回 Storage Port，供 IPC Handler 使用
```

### 验证方式

```
步骤：
  1. 确保 Storage 里有一个有效的 API Key
  2. 发送消息："你好"
  3. 看到 AI 回复

预期结果：
  → AI 回复正常
  → 对话历史被保存
  → 重新打开应用，历史还在
```

---

## 5. 阶段四：IPC 打通

### 目标

```
前端通过 IPC 调用 Core，Core 返回结果，前端渲染响应
```

### 目录结构

```
electron/
├── ipc/
│   ├── chat.handler.ts     # 聊天请求处理
│   └── config.handler.ts   # 配置请求处理
│
├── main.ts               # 增强：注册 IPC Handler
└── preload.ts            # 增强：暴露完整 API
```

### chat.handler.ts — 聊天 IPC

```
文件：electron/ipc/chat.handler.ts

函数：registerChatHandlers(ipcMain, core)

注册通道：
├── chat:send
│   ├── 接收：message: string
│   ├── 行为：
│   │   ├── 创建新 Conversation
│   │   └── 调用 core.sendMessage()，传入 callbacks
│   └── callbacks：
│       ├── onToken  → 推送 agent:token
│       ├── onDone   → 推送 agent:done
│       └── onError  → 推送 agent:error
│
└── chat:history
    ├── 接收：conversationId: string
    └── 返回：Message[]
```

### config.handler.ts — 配置 IPC

```
文件：electron/ipc/config.handler.ts

函数：registerConfigHandlers(ipcMain, storage)

注册通道：
├── config:get
│   └── 返回：{ apiKeys, prompts }
│
├── config:apiKey:create
│   └── 调用：storage.createApiKey()
│
└── config:apiKey:delete
    └── 调用：storage.deleteApiKey()
```

### main.ts — 增强

```
文件：electron/main.ts

增强内容：
├── 1. 导入 SQLiteAdapter
├── 2. 导入 IPC Handlers
├── 3. app.whenReady() 中：
│   ├── 实例化 SQLiteAdapter
│   ├── 实例化 EasyAgentCore
│   └── 注册所有 IPC Handler
│
└── 4. 添加 token 推送
    └── onToken 回调 → mainWindow.webContents.send('agent:token', token)
```

### preload.ts — 增强

```
文件：electron/preload.ts

增强内容：

对话：
├── sendMessage(message)    → ipcRenderer.invoke('chat:send')
└── getHistory(convId)    → ipcRenderer.invoke('chat:history')

配置：
├── getConfig()             → ipcRenderer.invoke('config:get')
├── createApiKey(dto)      → ipcRenderer.invoke('config:apiKey:create')
└── deleteApiKey(id)       → ipcRenderer.invoke('config:apiKey:delete')

事件推送：
├── onToken(cb)             ← agent:token
├── onDone(cb)              ← agent:done
└── onError(cb)             ← agent:error
```

### 前端对接

```
文件：renderer/src/stores/agent.ts

增强内容：
├── 1. 调用 setupChatListeners() 注册事件监听
├── 2. sendMessage() 调用 window.electronAPI.sendMessage()
├── 3. onToken 回调更新消息列表（流式追加）
└── 4. onDone / onError 更新加载状态
```

### 验证方式

```
完整流程验证：
  1. 打开应用
  2. 打开设置页
  3. 添加 API Key
  4. 切换到聊天页
  5. 输入"你好"
  6. 看到 AI 回复（逐字出现）
  7. 关闭应用，重新打开
  8. 历史对话还在
```

---

## 6. 完整文件清单

### 初始阶段需要创建的文件

```
electron/
├── main.ts                    # 阶段一 + 阶段四增强
├── preload.ts                 # 阶段一 + 阶段四增强
│
├── ipc/                       # 阶段四
│   ├── chat.handler.ts
│   └── config.handler.ts
│
└── core/
    ├── index.ts              # 阶段一 + 阶段三增强
    │
    ├── domain/
    │   └── types.ts          # 阶段二
    │
    ├── ports/
    │   ├── llm.port.ts       # 阶段三
    │   └── storage.port.ts   # 阶段二
    │
    ├── adapters/
    │   └── storage/
    │       └── sqlite.adapter.ts  # 阶段二
    │   └── http/
    │       └── openai.adapter.ts  # 阶段三
    │
    └── application/
        └── AgentService.ts    # 阶段三
```

### 阶段对应

```
阶段一：Electron 骨架
  → main.ts, preload.ts, core/index.ts

阶段二：Storage 存储
  → domain/types.ts, ports/storage.port.ts, adapters/storage/sqlite.adapter.ts

阶段三：LLM 对话
  → ports/llm.port.ts, adapters/http/openai.adapter.ts, application/AgentService.ts, core/index.ts 增强

阶段四：IPC 打通
  → ipc/chat.handler.ts, ipc/config.handler.ts, main.ts 增强, preload.ts 增强
```

---

## 7. 跳过的内容（MVP 后再加）

```
以下内容初始阶段不做：

❌ Claude 适配器（anthropic.adapter.ts）
❌ MCP 插件（mcp.port.ts, stdio.adapter.ts, remote.adapter.ts）
❌ Workflow（Workflow 领域模型，WorkflowService）
❌ Prompt 管理页面
❌ Agent Pet（心态动画）
❌ 工作流画布（Vue Flow）
❌ 多模型切换 UI
```

---

## 8. 下一步（MVP 完成后的优化）

```
MVP 完成后，按优先级加功能：

优先级 1（MVP 后立即加）：
  ├── Claude 适配器（anthropic.adapter.ts）
  ├── Prompt 模板管理
  └── 对话重命名、删除

优先级 2：
  ├── MCP 插件接入（stdio.adapter.ts）
  └── 工具调用（onToolCall 推送）

优先级 3：
  ├── Workflow（工作流编排）
  ├── Agent Pet（心态动画）
  └── 工作流画布（Vue Flow）
```

---

*文档版本: v0.1.0 | 最后更新: 2026-05-26*
