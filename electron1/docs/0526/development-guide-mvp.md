# MVP 初始阶段开发文档

> 版本: v0.2.0 MVP
> 日期: 2026-05-26
> 目标：先让"输入一句话，AI 回复"跑通
> 原则：electron-vite 骨架优先，先跑起来，再填细节
> 架构: electron-vite 单项目（electron/ + src/）

---

## 1. 整体目标

```
最终效果：
  用户打开应用
  → 输入"你好"
  → AI 回复"你好！有什么可以帮你的？"

做到这些就够了：
  ✅ electron-vite 骨架（能打开窗口）
  ✅ SQLite 存储（能保存 API Key 和对话历史）
  ✅ OpenAI 调用（能对话）
  ✅ IPC 打通（前端能调用后端）
  ✅ 单一命令启动（npm run dev）
```

---

## 2. 阶段一：electron-vite 骨架

### 目标

```
Electron 能启动，窗口能打开，前端能渲染（单一命令 npm run dev）
```

### 目录结构

```
easy-agent/
├── electron/                      # 主进程源码
│   ├── main.ts                  # Electron 入口
│   ├── preload.ts               # Context Bridge
│   └── core/
│       └── index.ts             # 核心导出（占位）
│
├── src/                          # 渲染进程 Vue 源码
│   ├── main.ts
│   ├── App.vue
│   ├── style.css
│   ├── components/Sidebar.vue
│   └── views/
│       ├── ChatView.vue
│       ├── SettingsView.vue
│       └── ...
│
├── index.html
├── electron.vite.config.ts        # electron-vite 配置
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
└── package.json
```

### 创建 electron/main.ts

职责：
- 创建 BrowserWindow
- 设置窗口大小（1200 x 800）
- 设置 preload 路径（`dist/preload/index.js`）
- 开启 contextIsolation，关闭 nodeIntegration
- 加载前端页面（dev: `ELECTRON_RENDERER_URL`，prod: `loadFile`）

### 创建 electron/preload.ts

职责：通过 contextBridge 安全暴露 API

初始只需要暴露一个测试 API：
- `ping()` → 返回 `'pong'`
- 用于验证 IPC 通道是否打通

### 创建 electron/core/index.ts

职责：核心统一导出

初始版本：
- 导出一个空的 EasyAgentCore class
- 先让 Electron 能启动，不急着实现具体逻辑

### 验证方式

```bash
npm run dev
```

预期结果：
- Electron 窗口打开
- 窗口大小 1200x800
- 加载前端页面
- DevTools 能打开（F12）
- `window.electronAPI.ping()` 返回 `'pong'`

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

导出内容：
- 枚举：MessageRole, WorkflowStatus, NodeType
- 接口：Message, Conversation, Prompt, Workflow, WorkflowNode, WorkflowEdge, McpServer, McpTool, ApiKey
- DTO：CreateConversationDTO, AppendMessageDTO, CreateApiKeyDTO, CreatePromptDTO

### storage.port.ts — 存储接口

接口：IStoragePort

API Key 操作：createApiKey, listApiKeys, getDecryptedKey, deleteApiKey

Conversation 操作：createConversation, listConversations, getMessages, appendMessage, deleteConversation

Prompt 操作：createPrompt, listPrompts, updatePrompt, deletePrompt

### sqlite.adapter.ts — SQLite 实现

类：SQLiteAdapter
- 实现接口：IStoragePort
- 构造函数参数：(dbPath: string, masterPassword: string)
- 建表语句：api_keys, conversations, messages, prompts, workflows, mcp_servers, mcp_tools

### KeyEncryptor — API Key 加密

使用 AES-256-GCM + scrypt 密钥派生加密存储 API Key

### 验证方式

1. 添加一个 API Key（provider = 'openai', model = 'gpt-4o', key = 'sk-xxx'）
2. 关闭应用
3. 重新打开应用
4. 列出所有 API Key

预期结果：API Key 还在列表里，重启后数据持久化

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
│   └── llm/
│       └── openai.adapter.ts  # OpenAI 实现
│
└── application/
    └── AgentService.ts  # 对话逻辑
```

### llm.port.ts — LLM 接口

接口：ILLMPort

方法：
- `invoke(messages)` — 普通调用，返回完整响应
- `invokeStream(messages, onChunk)` — 流式调用，每个 token 实时回调 onChunk

### openai.adapter.ts — OpenAI 实现

类：OpenAIAdapter
- 实现接口：ILLMPort
- 使用 @langchain/openai 的 ChatOpenAI

### AgentService.ts — 对话逻辑

类：AgentService
- 接收 ILLMPort 和 IStoragePort 实例
- sendMessage：保存消息 → 加载历史 → 调用 LLM 流式返回 → 保存回复

### 验证方式

```bash
npm run dev
# DevTools 中
storage.createApiKey({ provider: 'openai', key: 'sk-your-key', model: 'gpt-4o' })
core.sendMessage('test-conv-id', '你好', {
  onToken: (t) => console.log(t),
  onDone: () => console.log('完成'),
  onError: (e) => console.error(e)
})
```

预期结果：AI 回复正常，对话历史被保存，重启后历史还在

---

## 5. 阶段四：IPC 打通

### 目标

```
前端通过 IPC 调用 Core，Core 返回结果，前端渲染响应
```

### 目录结构

```
electron/
├── main.ts               # 增强：注册 IPC Handler
├── preload.ts            # 增强：暴露完整 API
└── ipc/
    ├── chat.handler.ts   # 聊天请求处理
    └── config.handler.ts # 配置请求处理
```

### chat.handler.ts — 聊天 IPC

注册通道：chat:send, chat:history, chat:conversations, chat:new, chat:delete

### config.handler.ts — 配置 IPC

注册通道：config:get, config:apiKey:create, config:apiKey:delete, config:prompt:create, config:prompt:delete

### main.ts — 增强

增强内容：
1. 导入 SQLiteAdapter
2. 导入 IPC Handlers
3. app.whenReady() 中实例化并注册

### preload.ts — 增强

增强内容：sendMessage, getHistory, getConversations, newConversation, getConfig, createApiKey, createPrompt, onToken, onDone, onError

### 验证方式

完整流程验证：
1. 打开应用
2. 打开设置页
3. 添加 API Key
4. 切换到聊天页
5. 输入"你好"
6. 看到 AI 回复（逐字出现）
7. 关闭应用，重新打开
8. 历史对话还在

---

## 6. 完整文件清单

```
easy-agent/
├── electron/
│   ├── main.ts                   # 阶段一 + 阶段四增强
│   ├── preload.ts                # 阶段一 + 阶段四增强
│   │
│   ├── ipc/                      # 阶段四
│   │   ├── chat.handler.ts
│   │   └── config.handler.ts
│   │
│   └── core/
│       ├── index.ts              # 阶段一 + 阶段三增强
│       │
│       ├── domain/
│       │   └── types.ts          # 阶段二
│       │
│       ├── ports/
│       │   ├── llm.port.ts       # 阶段三
│       │   └── storage.port.ts   # 阶段二
│       │
│       ├── adapters/
│       │   ├── storage/
│       │   │   └── sqlite.adapter.ts  # 阶段二
│       │   └── llm/
│       │       └── openai.adapter.ts  # 阶段三
│       │
│       └── application/
│           └── AgentService.ts    # 阶段三
│
├── src/                          # 前端（已完成框架）
│   ├── main.ts
│   ├── App.vue
│   ├── style.css
│   ├── components/Sidebar.vue
│   ├── views/
│   │   ├── ChatView.vue
│   │   ├── SettingsView.vue
│   │   ├── FlowView.vue
│   │   ├── PluginView.vue
│   │   └── HistoryView.vue
│   ├── stores/agent.ts
│   ├── api/chat.ts
│   ├── api/config.ts
│   └── types/electron.d.ts
│
├── index.html
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
└── package.json
```

---

## 7. 跳过的内容（MVP 后再加）

```
❌ Claude 适配器（anthropic.adapter.ts）
❌ MCP 插件（mcp.port.ts, stdio.adapter.ts）
❌ Workflow（WorkflowService）
❌ Agent Pet 心态动画
❌ 工作流画布（Vue Flow）
❌ 多模型切换 UI
```

---

*文档版本: v0.2.0 | 最后更新: 2026-05-26*
