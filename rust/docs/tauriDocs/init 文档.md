# Tauri + Vue 项目初始化指南

> 本文档描述如何从现有的 Electron + Vue 项目 (`electron1`) 迁移到 Tauri + Vue，包括环境准备、项目创建、代码迁移和验证步骤。
>
> **注意**：本指南不涉及代码修改，只描述具体的操作步骤。

---

## 目录

1. [环境准备](#1-环境准备)
2. [创建 Tauri + Vue 项目](#2-创建-tauri--vue-项目)
3. [项目结构说明](#3-项目结构说明)
4. [代码迁移清单](#4-代码迁移清单)
5. [Rust 后端功能清单](#5-rust-后端功能清单)
6. [IPC 通信迁移对照表](#6-ipc-通信迁移对照表)
7. [依赖安装](#7-依赖安装)
8. [验证与测试](#8-验证与测试)
9. [后续步骤](#9-后续步骤)

---

## 1. 环境准备

### 1.1 必需工具

| 工具 | 最低版本 | 安装方式 |
|------|---------|---------|
| Node.js | 18+ | [官网下载](https://nodejs.org/) |
| Rust | 1.70+ | [官网安装](https://rustup.rs/) |
| npm / pnpm | 最新 | 随 Node.js 自动安装 |
| Visual Studio Build Tools | 最新 | [官网下载](https://visualstudio.microsoft.com/downloads/)（Windows C++ 编译工具） |

### 1.2 验证安装

打开终端，执行以下命令确认工具已正确安装：

```bash
# Node.js
node --version
npm --version

# Rust（安装后需重启终端）
rustc --version
cargo --version
```

### 1.3 Windows 特殊说明

Rust 在 Windows 上需要 C++ 编译工具。安装时选择 **"Desktop development with C++"** workload：

1. 下载 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)
2. 安装时勾选 **"Desktop development with C++"**
3. 重启终端

---

## 2. 创建 Tauri + Vue 项目

### 2.1 创建命令

在 `rust/` 目录下执行：

```bash
cd rust
npm create tauri-app@latest tauri-easy-agent -- --template vue-ts --manager npm
```

参数说明：
- `--template vue-ts`：使用 Vue + TypeScript 模板
- `--manager npm`：使用 npm 作为包管理器

### 2.2 创建后的目录结构

```
rust/
├── tauri-easy-agent/           # 新创建的项目
│   ├── src/                    # Vue 前端代码
│   │   ├── main.ts
│   │   ├── App.vue
│   │   └── assets/
│   ├── src-tauri/              # Rust 后端代码
│   │   ├── src/
│   │   │   ├── main.rs        # Rust 入口
│   │   │   └── lib.rs         # 库入口
│   │   ├── Cargo.toml
│   │   └── tauri.conf.json
│   ├── package.json
│   └── vite.config.ts
│
├── electron1/                   # 现有 Electron 项目（不删除，作为参考）
│   └── src/
│
└── docs/
    └── tauriDocs/
```

### 2.3 进入项目目录

```bash
cd tauri-easy-agent
```

---

## 3. 项目结构说明

### 3.1 Tauri 项目结构

```
tauri-easy-agent/
├── src/                          # Vue 前端（前端工程师主要编辑）
│   ├── main.ts                   # Vue 入口（需适配）
│   ├── App.vue                   # 根组件（需适配）
│   ├── style.css                 # 全局样式（从 electron1 迁移）
│   │
│   ├── api/                      # API 调用层（需重写）
│   │   ├── chat.ts
│   │   ├── config.ts
│   │   └── workflow.ts
│   │
│   ├── stores/                   # Pinia 状态管理（需改 API 调用）
│   │   ├── chat.ts
│   │   ├── config.ts
│   │   └── workflow.ts
│   │
│   ├── views/                    # 页面视图（可直接迁移）
│   │   ├── chat/
│   │   ├── settings/
│   │   ├── plugin/
│   │   └── workflow/
│   │
│   ├── components/               # 公共组件（可直接迁移）
│   │   └── common/
│   │
│   ├── composables/              # 组合式函数（可直接迁移）
│   │   └── useSidebarCollapse.ts
│   │
│   ├── layout/                   # 布局组件（可直接迁移）
│   │   └── Sidebar.vue
│   │
│   └── types/                    # 类型定义（需重写）
│       └── electron.d.ts
│
├── src-tauri/                    # Rust 后端（Rust 工程师主要编辑）
│   ├── src/
│   │   ├── main.rs               # 入口
│   │   ├── lib.rs                # 库入口
│   │   ├── commands/             # Tauri Commands（核心）
│   │   │   ├── mod.rs
│   │   │   ├── chat.rs
│   │   │   ├── config.rs
│   │   │   └── workflow.rs
│   │   │
│   │   ├── domain/               # 领域模型
│   │   │   └── mod.rs
│   │   │
│   │   ├── services/             # 业务逻辑
│   │   │   └── mod.rs
│   │   │
│   │   └── adapters/             # 外部适配器（LLM、MCP 等）
│   │       └── mod.rs
│   │
│   ├── Cargo.toml                # Rust 依赖
│   └── tauri.conf.json          # Tauri 配置
│
└── package.json                  # 前端依赖
```

### 3.2 与 Electron 项目的对应关系

| Electron 目录 | Tauri 目录 | 迁移方式 |
|-------------|-----------|---------|
| `electron1/src/` | `tauri-easy-agent/src/` | 需适配 |
| `electron1/electron/` | `tauri-easy-agent/src-tauri/` | 需重写 |

---

## 4. 代码迁移清单

### 4.1 可直接迁移的文件

以下文件无需修改，可直接复制：

```
# 全局样式
electron1/src/style.css
  → tauri-easy-agent/src/style.css

# 页面视图（Vue 组件）
electron1/src/views/chat/ChatView.vue
electron1/src/views/chat/MessageList.vue
electron1/src/views/chat/InputArea.vue
electron1/src/views/chat/ChatHeader.vue
electron1/src/views/chat/ModelSelector.vue
electron1/src/views/chat/PromptSelector.vue
electron1/src/views/settings/SettingsView.vue
electron1/src/views/settings/GeneralSetting.vue
electron1/src/views/settings/AppearanceSetting.vue
electron1/src/views/settings/AboutSetting.vue
electron1/src/views/settings/ApiKeySetting.vue
electron1/src/views/settings/PromptSetting.vue
electron1/src/views/plugin/PluginView.vue
electron1/src/views/workflow/WorkflowView.vue
  → tauri-easy-agent/src/views/

# 公共组件
electron1/src/components/common/*.vue
  → tauri-easy-agent/src/components/common/

# 布局组件
electron1/src/layout/Sidebar.vue
  → tauri-easy-agent/src/layout/

# 组合式函数
electron1/src/composables/useSidebarCollapse.ts
  → tauri-easy-agent/src/composables/

# Pinia Store（需改 API 调用）
electron1/src/stores/chat.ts
electron1/src/stores/config.ts
electron1/src/stores/workflow.ts
  → tauri-easy-agent/src/stores/
  （内部调用 API 的部分需要适配）
```

### 4.2 需要重写的文件

```
# API 调用层（核心变更）
electron1/src/api/chat.ts      → 重写为 @tauri-apps/api 调用
electron1/src/api/config.ts    → 重写为 @tauri-apps/api 调用
electron1/src/api/workflow.ts  → 重写为 @tauri-apps/api 调用

# 类型定义
electron1/src/types/electron.d.ts  → 重写为 Tauri API 类型

# Vue 入口
electron1/src/main.ts    → 适配 Vue 路由（略有不同）
electron1/src/App.vue    → 适配（可选，基本无需改动）
```

### 4.3 迁移步骤

#### 步骤 1：复制可直接迁移的文件

```bash
# 复制 style.css
copy electron1\src\style.css tauri-easy-agent\src\

# 复制 views（Windows CMD）
xcopy /E /I electron1\src\views tauri-easy-agent\src\views

# 复制 components
xcopy /E /I electron1\src\components tauri-easy-agent\src\components

# 复制 layout
copy electron1\src\layout\Sidebar.vue tauri-easy-agent\src\layout\

# 复制 composables
copy electron1\src\composables\useSidebarCollapse.ts tauri-easy-agent\src\composables\

# 复制 stores
xcopy /E /I electron1\src\stores tauri-easy-agent\src\stores
```

#### 步骤 2：重写 API 调用层

详见 [第 6 节：IPC 通信迁移对照表](#6-ipc-通信迁移对照表)

#### 步骤 3：重写类型定义

详见 [第 6 节：IPC 通信迁移对照表](#6-ipc-通信迁移对照表)

---

## 5. Rust 后端功能清单

### 5.1 需要实现的功能模块

| 模块 | 功能 | 对应 Electron 代码 |
|------|------|------------------|
| **聊天模块** | 发送消息、接收流式响应、对话管理 | `electron1/electron/core/application/AgentService.ts` |
| **配置模块** | API Key 管理、Prompt 管理、LLM 配置 | `electron1/electron/core/application/LLMManager.ts` |
| **工作流模块** | Workflow CRUD、节点管理、连接管理 | `electron1/electron/core/application/WorkflowService.ts` |
| **MCP 模块** | MCP Server 连接、工具调用 | `electron1/electron/core/application/McpServerService.ts` |
| **插件模块** | Plugin CRUD | `electron1/electron/core/application/PluginService.ts` |
| **压缩模块** | 对话历史压缩 | `electron1/electron/core/application/CompressionService.ts` |

### 5.2 Rust 后端技术选型

| 功能 | Rust 库 | 说明 |
|------|--------|------|
| HTTP 客户端 | `reqwest` | LLM API 调用 |
| 数据库 | `rusqlite` 或 `sqlx` | SQLite 持久化 |
| 序列化 | `serde` + `serde_json` | JSON 序列化/反序列化 |
| 异步运行时 | `tokio` | 异步编程 |
| LLM SDK | `langchain-rust` 或直接调用 API | LLM 集成 |
| MCP 协议 | `mcp-sdk` 或自行实现 | MCP 协议支持 |

### 5.3 Tauri Command 示例

```rust
// src-tauri/src/commands/chat.rs

#[tauri::command]
async fn send_message(
    conversation_id: String,
    message: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // 实现发送消息逻辑
}

// 事件推送（用于流式响应）
app.emit("token", payload).map_err(|e| e.to_string())?;
```

---

## 6. IPC 通信迁移对照表

### 6.1 API 调用对照

| Electron (TypeScript) | Tauri (TypeScript) |
|----------------------|-------------------|
| `window.electronAPI.sendMessage(id, msg)` | `invoke('send_message', { conversationId: id, message: msg })` |
| `window.electronAPI.getHistory(id)` | `invoke('get_history', { conversationId: id })` |
| `window.electronAPI.getConversations()` | `invoke('get_conversations')` |
| `window.electronAPI.newConversation()` | `invoke('new_conversation')` |
| `window.electronAPI.deleteConversation(id)` | `invoke('delete_conversation', { conversationId: id })` |
| `window.electronAPI.compressConversation(id)` | `invoke('compress_conversation', { conversationId: id })` |
| `window.electronAPI.getConfig()` | `invoke('get_config')` |
| `window.electronAPI.createApiKey(data)` | `invoke('create_api_key', data)` |
| `window.electronAPI.deleteApiKey(id)` | `invoke('delete_api_key', { id })` |
| `window.electronAPI.createPrompt(data)` | `invoke('create_prompt', data)` |
| `window.electronAPI.setActivePrompt(id)` | `invoke('set_active_prompt', { id })` |
| `window.electronAPI.setActiveKey(id)` | `invoke('set_active_key', { keyId: id })` |
| `window.electronAPI.getActiveLLMConfig()` | `invoke('get_active_llm_config')` |
| `window.electronAPI.listLLMProviders()` | `invoke('list_llm_providers')` |
| `window.electronAPI.testLLMConnection(data)` | `invoke('test_llm_connection', data)` |

### 6.2 事件监听对照

| Electron (TypeScript) | Tauri (TypeScript) |
|----------------------|-------------------|
| `window.electronAPI.onToken(callback)` | `listen<TokenPayload>('token', (event) => callback(event.payload))` |
| `window.electronAPI.onDone(callback)` | `listen<DonePayload>('done', (event) => callback(event.payload))` |
| `window.electronAPI.onError(callback)` | `listen<ErrorPayload>('error', (event) => callback(event.payload))` |
| `window.electronAPI.onMessagesSynced(callback)` | `listen<MessagesSyncedPayload>('messages-synced', (event) => callback(event.payload))` |

### 6.3 TypeScript 类型定义（迁移后）

```typescript
// src/types/tauri.d.ts

// ============ 事件 Payload 类型 ============
interface TokenPayload {
  conversationId: string;
  token: string;
}

interface DonePayload {
  conversationId: string;
}

interface ErrorPayload {
  conversationId: string;
  error: string;
}

interface MessagesSyncedPayload {
  conversationId: string;
  newMessages: unknown[];
}

// ============ Tauri API 接口 ============
interface TauriAPI {
  // 聊天
  sendMessage(conversationId: string, message: string): Promise<void>;
  getHistory(conversationId: string): Promise<unknown[]>;
  getConversations(): Promise<unknown[]>;
  newConversation(): Promise<{ id: string; name: string }>;
  deleteConversation(conversationId: string): Promise<boolean>;
  compressConversation(conversationId: string): Promise<{ summary: string; title: string } | null>;
  endConversation(conversationId: string): Promise<void>;

  // 配置
  getConfig(): Promise<{ apiKeys: unknown[]; prompts: unknown[]; llmConfig: unknown }>;
  createApiKey(data: { provider: string; key: string; model: string; baseURL?: string }): Promise<unknown>;
  deleteApiKey(id: string): Promise<boolean>;
  createPrompt(data: { name: string; description?: string; systemPrompt: string }): Promise<unknown>;
  deletePrompt(id: string): Promise<boolean>;
  setActivePrompt(id: string): Promise<boolean>;
  getActivePrompt(): Promise<unknown>;
  setActiveKey(keyId: string): Promise<void>;
  getActiveLLMConfig(): Promise<{ keyId: string; provider: string; model: string } | null>;
  listLLMProviders(): Promise<Array<{ id: string; name: string; models: string[] }>>;
  testLLMConnection(data: { provider: string; apiKey: string; model: string; baseURL?: string }): Promise<{ success: boolean; message?: string }>;

  // MCP
  mcpConnect(server: unknown): Promise<void>;
  mcpDisconnect(serverId: string): Promise<void>;
  mcpIsConnected(serverId: string): Promise<boolean>;
  mcpListTools(serverId: string): Promise<unknown[]>;
  mcpCallTool(serverId: string, toolName: string, args: unknown): Promise<unknown>;

  // Plugin
  pluginCreate(data: { name: string; description: string; serverId: string; toolNames: string[] }): Promise<unknown>;
  pluginList(): Promise<unknown[]>;
  pluginGet(id: string): Promise<unknown>;
  pluginDelete(id: string): Promise<boolean>;

  // Workflow
  workflowCreate(data: { name: string; description?: string }): Promise<unknown>;
  workflowList(): Promise<unknown[]>;
  workflowGet(id: string): Promise<unknown>;
  workflowAddNode(workflowId: string, nodeId: string): Promise<void>;
  workflowRemoveNode(workflowId: string, nodeId: string): Promise<void>;
  workflowConnect(workflowId: string, sourceNodeId: string, sourceField: string, targetNodeId: string, targetField: string): Promise<void>;
  workflowDisconnect(workflowId: string, edgeId: string): Promise<void>;
  workflowValidate(workflowId: string): Promise<unknown>;
  workflowExecute(workflowId: string, input: unknown): Promise<void>;
  workflowUpdate(id: string, data: unknown): Promise<void>;
  workflowDelete(id: string): Promise<boolean>;
  workflowGetNodes(workflowId: string): Promise<unknown[]>;
}
```

---

## 7. 依赖安装

### 7.1 前端依赖

创建项目后，需要安装以下前端依赖：

```bash
cd tauri-easy-agent
npm install
npm install pinia vue-router @vueuse/core clsx uuid
npm install @langchain/anthropic @langchain/core @langchain/langgraph @langchain/openai
npm install @modelcontextprotocol/sdk
npm install @vue-flow/core @vue-flow/background @vue-flow/controls
npm install three @types/three
```

### 7.2 Rust 依赖

在 `src-tauri/Cargo.toml` 中添加：

```toml
[dependencies]
tauri = { version = "2", features = ["devtools"] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
rusqlite = { version = "0.32", features = ["bundled"] }
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
thiserror = "2"
tracing = "0.1"
tracing-subscriber = "0.3"
anyhow = "1"
```

### 7.3 Tauri 插件

```bash
npm install @tauri-apps/api @tauri-apps/plugin-shell
```

---

## 8. 验证与测试

### 8.1 开发模式验证

```bash
cd tauri-easy-agent
npm run tauri dev
```

预期结果：
- 编译成功，无报错
- 应用窗口正常打开
- Vue 前端正常渲染
- 可以调用 Rust 后端（即使功能未完整实现）

### 8.2 调试方法

#### 前端调试
- 打开浏览器 DevTools（F12）
- Console 中查看日志
- Network 标签查看 IPC 调用

#### Rust 调试
- 查看终端输出的 `tracing` 日志
- 使用 `println!` 宏输出调试信息
- 使用 VSCode + rust-analyzer 插件

### 8.3 打包验证

```bash
npm run tauri build
```

预期结果：
- 生成可执行文件（Windows: `.exe`）
- 文件位于 `tauri-easy-agent/src-tauri/target/release/`

---

## 9. 后续步骤

### 阶段一：基础框架（本文档范围）
- [x] 环境准备
- [x] 创建 Tauri + Vue 项目
- [x] 迁移前端代码（复制文件）
- [x] 适配 API 调用层
- [x] 验证项目可运行

### 阶段二：后端实现（后续文档）
- [ ] 实现 Rust 后端基础框架
- [ ] 实现聊天功能（核心）
- [ ] 实现配置管理功能
- [ ] 实现工作流功能
- [ ] 实现 MCP 集成
- [ ] 实现数据持久化

### 阶段三：优化与测试
- [ ] 性能优化
- [ ] 错误处理完善
- [ ] 安全审计
- [ ] 打包发布

---

## 附录 A：常用命令

```bash
# 创建项目
npm create tauri-app@latest

# 开发模式
npm run tauri dev

# 构建发布
npm run tauri build

# 仅构建前端
npm run build

# 仅构建后端（Rust）
cargo build --release

# 添加 Rust 依赖
cargo add <package>

# 检查 Rust 代码
cargo check

# 格式化 Rust 代码
cargo fmt

# 运行 Rust 测试
cargo test
```

## 附录 B：参考资源

- [Tauri 官方文档](https://tauri.app/)
- [Tauri 2.0 迁移指南](https://tauri.app/start/migrate/)
- [Vue 3 文档](https://vuejs.org/)
- [Pinia 文档](https://pinia.vuejs.org/)
- [Tauri IPC 通信](https://tauri.app/develop/calling-between/tauri/)

---

> 文档版本：1.0
> 创建日期：2026-06-07
> 适用于：easy-agent 项目 Electron → Tauri 迁移
