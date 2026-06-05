# 02. Port 和 Adapter 实现

> 版本: v0.2.0 MVP
> 日期: 2026-05-26
> 前置: 你理解 Port = 接口定义，Adapter = 具体实现

---

## 1. 核心概念

```
Port（端口）    = 核心定义的"我需要什么能力"
                → 写成一个 TypeScript interface
                → 放在 core/ports/ 目录
                → 核心只依赖 Port，不依赖任何具体实现

Adapter（适配器）= Port 的具体实现
                → 写成 class，实现 Port interface
                → 放在 core/adapters/ 目录（按通信方式分类）
                → 可以自由替换，不影响核心
```

---

## 2. Port 接口定义

### 2.1 目录结构

```
electron/core/ports/
├── llm.port.ts      # LLM 能力抽象（接口定义）
├── storage.port.ts  # 存储能力抽象（接口定义）
├── mcp.port.ts      # MCP 通信能力抽象（接口定义）
└── index.ts         # 统一导出
```

### 2.2 Port 的三条规则

```
规则 1：Port 是 interface，不是 class
规则 2：Port 只定义方法签名，不写实现
规则 3：Port 放在 core/ports/，核心只依赖 Port
```

### 2.3 LLM Port

```
文件：ports/llm.port.ts

导出类型：
├── LLMResponse
│   ├── content: string
│   └── usage?: { promptTokens, completionTokens, totalTokens }
│
└── ILLMPort（接口）
    ├── 属性
    │   ├── provider: string    # 'openai' | 'anthropic' | 'gemini'
    │   └── model: string       # 'gpt-4o' | 'claude-3-5-sonnet' | ...
    │
    └── 方法
        ├── invoke(messages: BaseMessage[]) → Promise<LLMResponse>
        │   └── 普通调用，返回完整响应
        │
        └── invokeStream(messages, onChunk) → Promise<LLMResponse>
            ├── 参数 onChunk: (chunk: string) => void
            └── 流式调用，每个 token 实时回调 onChunk
```

### 2.4 Storage Port

```
文件：ports/storage.port.ts

导出类型：
├── CreateApiKeyDTO        { provider, key, model }
├── CreateWorkflowDTO      { name, description?, nodes, edges }
├── AppendMessageDTO        { conversationId, role, content, model? }
├── CreatePromptDTO        { name, description?, systemPrompt, isBuiltin? }
│
└── IStoragePort（接口）
    ├── API Key 操作
    │   ├── createApiKey(dto) → { id, provider, model, enabled }
    │   ├── listApiKeys() → { id, provider, model, enabled }[]
    │   ├── getDecryptedKey(id) → string | null
    │   └── deleteApiKey(id) → boolean
    │
    ├── Workflow 操作
    │   ├── createWorkflow(dto) → Workflow
    │   ├── listWorkflows() → Workflow[]
    │   ├── getWorkflow(id) → Workflow | null
    │   ├── updateWorkflow(id, data) → Workflow | null
    │   └── deleteWorkflow(id) → boolean
    │
    ├── Conversation 操作
    │   ├── createConversation(dto?) → Conversation
    │   ├── listConversations() → Conversation[]
    │   ├── getMessages(convId) → Message[]
    │   ├── appendMessage(dto) → Message
    │   ├── deleteConversation(id) → boolean
    │   └── renameConversation(id, name) → boolean
    │
    ├── Prompt 操作
    │   ├── createPrompt(dto) → Prompt
    │   ├── listPrompts() → Prompt[]
    │   ├── updatePrompt(id, data) → boolean
    │   └── deletePrompt(id) → boolean
    │
    └── MCP 操作
        ├── createMcpServer(dto) → McpServer
        ├── listMcpServers() → McpServer[]
        ├── deleteMcpServer(id) → boolean
        ├── saveMcpTools(serverId, tools) → void
        └── listMcpTools(serverId) → McpTool[]
```

### 2.5 MCP Port

```
文件：ports/mcp.port.ts

导出类型：
├── ToolCallEvent
│   ├── serverId: string
│   ├── toolName: string
│   └── arguments: Record<string, unknown>
│
└── IMcpPort（接口）
    ├── 连接管理
    │   ├── connect(server: McpServer) → Promise<void>
    │   ├── disconnect(serverId) → Promise<void>
    │   └── isConnected(serverId) → boolean
    │
    ├── 工具操作
    │   ├── listTools(serverId) → Promise<McpTool[]>
    │   └── callTool(serverId, toolName, args) → Promise<unknown>
    │
    └── 事件订阅
        ├── onToolCall(callback) → void
        │   └── callback 接收 ToolCallEvent
        └── onDisconnect(callback) → void
            └── callback 接收 serverId: string
```

---

## 3. Adapter 适配器实现

### 3.1 目录结构（按通信方式分类）

```
electron/core/adapters/
│
├── http/                  # 通信方式：HTTP
│   ├── openai.adapter.ts   # 实现 ILLMPort → 调用 OpenAI API
│   ├── anthropic.adapter.ts # 实现 ILLMPort → 调用 Claude API
│   └── remote.adapter.ts   # 实现 IMcpPort → 调用远程 MCP Server（HTTP）
│
├── stdio/                 # 通信方式：stdio
│   └── stdio.adapter.ts    # 实现 IMcpPort → 启动本地 MCP 子进程
│
└── storage/               # 通信方式：直接文件操作
    └── sqlite.adapter.ts   # 实现 IStoragePort → 操作本地 SQLite 文件
```

### 3.2 HTTP 适配器：OpenAI

```
文件：adapters/http/openai.adapter.ts

类：OpenAIAdapter
├── 实现接口：ILLMPort
│
├── 属性
│   ├── provider = 'openai'
│   ├── model: string
│   └── llm: ChatOpenAI（私有，LangChain 实例）
│
├── 构造函数
│   └── 参数：(model: string, apiKey: string)
│       └── 创建 ChatOpenAI 实例，设置 streaming = true
│
└── 方法
    ├── invoke(messages) → Promise<LLMResponse>
    │   └── 调用 llm.invoke()，返回 content
    │
    └── invokeStream(messages, onChunk) → Promise<LLMResponse>
        └── 调用 llm.stream()，逐 chunk 调用 onChunk，返回完整 content
```

### 3.3 HTTP 适配器：Anthropic

```
文件：adapters/http/anthropic.adapter.ts

类：AnthropicAdapter
├── 实现接口：ILLMPort
│
├── 属性
│   ├── provider = 'anthropic'
│   ├── model: string
│   └── llm: ChatAnthropic（私有）
│
├── 构造函数
│   └── 参数：(model: string, apiKey: string)
│       └── 创建 ChatAnthropic 实例，设置 streaming = true
│
└── 方法（与 OpenAIAdapter 完全一致）
    ├── invoke(messages) → Promise<LLMResponse>
    └── invokeStream(messages, onChunk) → Promise<LLMResponse>
```

### 3.4 HTTP 适配器：远程 MCP

```
文件：adapters/http/remote.adapter.ts

类：RemoteMcpAdapter
├── 实现接口：IMcpPort
│
├── 属性
│   └── connections: Map<serverId, HttpClient>（私有）
│
├── 构造函数
│   └── 参数：(serverId, url) → 存储连接配置
│
└── 方法
    ├── connect(server) → Promise<void>
    │   └── 建立 HTTP 连接，存储 client
    │
    ├── disconnect(serverId) → Promise<void>
    │   └── 关闭 HTTP 连接
    │
    ├── isConnected(serverId) → boolean
    │
    ├── listTools(serverId) → Promise<McpTool[]>
    │   └── 发送 HTTP GET /tools，请求远程 MCP Server
    │
    ├── callTool(serverId, toolName, args) → Promise<unknown>
    │   └── 发送 HTTP POST /tools/call，请求远程 MCP Server
    │
    ├── onToolCall(callback) → void
    └── onDisconnect(callback) → void
```

### 3.5 stdio 适配器：本地 MCP

```
文件：adapters/stdio/stdio.adapter.ts

类：StdioMcpAdapter
├── 实现接口：IMcpPort
│
├── 属性
│   ├── connections: Map<serverId, Client>（私有，MCP SDK Client）
│   ├── toolCallCallbacks: Function[]（私有）
│   └── disconnectCallbacks: Function[]（私有）
│
├── 构造函数
│   └── 参数：无
│
└── 方法
    ├── connect(server) → Promise<void>
    │   ├── 从 server.command 解析 command 和 args
    │   ├── 创建 StdioClientTransport
    │   ├── 创建 MCP Client
    │   ├── 连接 transport
    │   └── 存储到 connections
    │
    ├── disconnect(serverId) → Promise<void>
    │   ├── 关闭 client
    │   ├── 从 connections 删除
    │   └── 调用所有 disconnectCallbacks
    │
    ├── isConnected(serverId) → boolean
    │
    ├── listTools(serverId) → Promise<McpTool[]>
    │   ├── 获取对应 client
    │   ├── 发送 tools/list 请求
    │   └── 转换为 McpTool[] 返回
    │
    ├── callTool(serverId, toolName, args) → Promise<unknown>
    │   ├── 获取对应 client
    │   ├── 调用所有 toolCallCallbacks
    │   ├── 发送 tools/call 请求
    │   └── 返回 result.content
    │
    ├── onToolCall(callback) → void
    │   └── 追加到 toolCallCallbacks 数组
    │
    └── onDisconnect(callback) → void
        └── 追加到 disconnectCallbacks 数组
```

### 3.6 storage 适配器：SQLite

```
文件：adapters/storage/sqlite.adapter.ts

类：SQLiteAdapter
├── 实现接口：IStoragePort
│
├── 私有属性
│   ├── db: Database（better-sqlite3 实例）
│   └── encryptor: KeyEncryptor（API Key 加密工具）
│
├── 构造函数
│   ├── 参数：(dbPath: string, masterPassword: string)
│   ├── 行为：
│   │   ├── 打开 SQLite 数据库
│   │   ├── 设置 WAL 模式
│   │   ├── 开启外键约束
│   │   ├── 执行建表语句
│   │   └── 创建 KeyEncryptor 实例
│   └── 建表语句：
│       ├── api_keys（id, provider, encrypted_key, model, enabled, 时间戳）
│       ├── workflows（id, name, description, graph_data, status, 时间戳）
│       ├── conversations（id, name, workflow_id, 时间戳）
│       ├── messages（id, conversation_id, role, content, model, 时间戳）
│       ├── prompts（id, name, description, system_prompt, is_builtin, 时间戳）
│       ├── mcp_servers（id, name, type, command, url, enabled, 时间戳）
│       └── mcp_tools（id, server_id, name, description, input_schema, enabled）
│
└── 方法（完整实现 IStoragePort）
    ├── API Key（加密存储）
    │   ├── createApiKey(dto)
    │   ├── listApiKeys()
    │   ├── getDecryptedKey(id)
    │   └── deleteApiKey(id)
    │
    ├── Workflow
    │   ├── createWorkflow(dto)
    │   ├── listWorkflows()
    │   ├── getWorkflow(id)
    │   ├── updateWorkflow(id, data)
    │   └── deleteWorkflow(id)
    │
    ├── Conversation
    │   ├── createConversation(dto?)
    │   ├── listConversations()
    │   ├── getMessages(convId)
    │   ├── appendMessage(dto)
    │   ├── deleteConversation(id)
    │   └── renameConversation(id, name)
    │
    ├── Prompt
    │   ├── createPrompt(dto)
    │   ├── listPrompts()
    │   ├── updatePrompt(id, data)
    │   └── deletePrompt(id)
    │
    ├── MCP Server
    │   ├── createMcpServer(dto)
    │   ├── listMcpServers()
    │   └── deleteMcpServer(id)
    │
    ├── MCP Tool
    │   ├── saveMcpTools(serverId, tools)
    │   └── listMcpTools(serverId)
    │
    └── close()
        └── 关闭数据库连接
```

### 3.7 KeyEncryptor — API Key 加密工具

```
类：KeyEncryptor（SQLiteAdapter 内部私有类）

├── 私有属性
│   └── key: Buffer（从密码派生）

├── 构造函数
│   └── 参数：(password: string)
│       └── 使用 scrypt 派生 AES-256 密钥

├── encrypt(plaintext) → string
│   ├── 生成随机 IV（16 字节）
│   ├── 创建 AES-256-GCM 加密器
│   ├── 加密，返回格式：iv:authTag:ciphertext（均为 hex）

└── decrypt(data) → string
    ├── 解析 iv / authTag / ciphertext
    ├── 创建 AES-256-GCM 解密器
    └── 返回解密后的原文
```

---

## 4. Port 和 Adapter 的对应关系

```
核心需要的每种能力 → 一个 Port → 多个 Adapter

LLM 能力（HTTP）
    └─ ILLMPort
        ├─ OpenAIAdapter     → 调用 OpenAI API（HTTPS）
        ├─ AnthropicAdapter  → 调用 Claude API（HTTPS）
        └─ GeminiAdapter    → 调用 Gemini API（HTTPS）（未来）

MCP 通信能力
    ├─ stdio（本地子进程）
    │   └─ IMcpPort
    │       └─ StdioMcpAdapter → stdio 子进程通信
    │
    └─ HTTP（远程服务）
        └─ IMcpPort
            └─ RemoteMcpAdapter → HTTP / SSE 通信

存储能力
    └─ IStoragePort
        ├─ SQLiteAdapter     → 本地 SQLite（当前）
        └─ PostgresAdapter   → PostgreSQL（未来）
```

---

## 5. 记住

```
换模型厂商     → 换 HTTP 适配器，核心不用改
换数据库       → 换 storage 适配器，核心不用改
换 MCP 协议    → 换 stdio/HTTP 适配器，核心不用改

这就是六边形架构的核心价值：
    变化的部分被封装在 Adapter 里，核心永远稳定。
```

---

## 6. 文件清单

| 文件 | 类型 | 职责 | 通信方式 |
|------|------|------|---------|
| `ports/llm.port.ts` | 接口 | 定义 LLM 能力 | — |
| `ports/storage.port.ts` | 接口 | 定义存储能力 | — |
| `ports/mcp.port.ts` | 接口 | 定义 MCP 能力 | — |
| `ports/index.ts` | 导出 | 统一导出 | — |
| `adapters/http/openai.adapter.ts` | 类 | 调用 OpenAI API | HTTP |
| `adapters/http/anthropic.adapter.ts` | 类 | 调用 Claude API | HTTP |
| `adapters/http/remote.adapter.ts` | 类 | 调用远程 MCP | HTTP |
| `adapters/stdio/stdio.adapter.ts` | 类 | 本地 MCP 子进程 | stdio |
| `adapters/storage/sqlite.adapter.ts` | 类 | SQLite 存储 | 文件系统 |

---

*文档版本: v0.2.0 | 最后更新: 2026-05-26*
