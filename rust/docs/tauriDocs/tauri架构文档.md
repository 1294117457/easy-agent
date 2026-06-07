# Tauri 2.0 架构文档

> 本文档介绍 Tauri 的整体架构、核心概念、技术栈以及在 easy-agent 项目中的应用方式。

---

## 目录

1. [Tauri 是什么？](#1-tauri-是什么)
2. [核心架构](#2-核心架构)
3. [前端技术栈](#3-前端技术栈)
4. [后端技术栈](#4-后端技术栈)
5. [IPC 通信机制](#5-ipc-通信机制)
6. [安全模型](#6-安全模型)
7. [生命周期](#7-生命周期)
8. [项目结构](#8-项目结构)
9. [快速上手](#9-快速上手)

---

## 1. Tauri 是什么？

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Tauri = 用 Rust 写的桌面应用框架                                │
│                                                                 │
│   对比 Electron：                                                │
│                                                                 │
│   ┌─────────────────┬──────────────────┬────────────────────┐ │
│   │                 │     Electron      │       Tauri        │ │
│   ├─────────────────┼──────────────────┼────────────────────┤ │
│   │ 底层语言         │  Node.js + C++   │  Rust              │ │
│   │ 前端框架         │  任意            │  任意              │ │
│   │ 安装包大小       │  ~150MB          │  ~3-10MB          │ │
│   │ 内存占用         │  较高            │  极低              │ │
│   │ 启动速度         │  慢              │  极快              │ │
│   │ 原生能力         │  一般            │  强大（Rust 生态）  │ │
│   │ 生态            │  成熟            │  快速发展中        │ │
│   │ WebView         │  Chromium        │  系统原生 WebView   │ │
│   └─────────────────┴──────────────────┴────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 为什么选择 Tauri？

- **小**：打包后只有几 MB vs Electron 的上百 MB
- **快**：启动时间 < 100ms
- **安全**：Rust 内存安全，IPC 权限控制
- **原生**：直接调用系统 API，无需 npm 包
- **Rust 生态**：可以用 Rust 写任何后端逻辑

---

## 2. 核心架构

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                      Tauri 应用架构                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │   ┌─────────────────────────────────────────────────┐  │   │
│  │   │                                                 │  │   │
│  │   │              前端（WebView）                     │  │   │
│  │   │                                                 │  │   │
│  │   │   ┌─────────────────────────────────────────┐   │  │   │
│  │   │   │                                         │   │  │   │
│  │   │   │   Vue / React / Svelte / 任意前端框架   │   │  │   │
│  │   │   │                                         │   │  │   │
│  │   │   └─────────────────────────────────────────┘   │  │   │
│  │   │                                                 │  │   │
│  │   └─────────────────────────────────────────────────┘  │   │
│  │                         │                               │   │
│  │                         │ IPC                           │   │
│  │                         ▼                               │   │
│  │   ┌─────────────────────────────────────────────────┐  │   │
│  │   │                                                 │  │   │
│  │   │              后端（Rust）                        │  │   │
│  │   │                                                 │  │   │
│  │   │   ┌─────────────────────────────────────────┐   │  │   │
│  │   │   │                                         │   │  │   │
│  │   │   │   src-tauri/src/                        │   │  │   │
│  │   │   │   ├── main.rs         （入口）          │   │  │   │
│  │   │   │   ├── lib.rs         （库入口）        │   │  │   │
│  │   │   │   ├── commands/      （Tauri Commands）│   │  │   │
│  │   │   │   ├── domain/        （领域模型）      │   │  │   │
│  │   │   │   ├── services/     （业务逻辑）      │   │  │   │
│  │   │   │   └── adapters/     （外部适配）      │   │  │   │
│  │   │   │                                         │   │  │   │
│  │   │   └─────────────────────────────────────────┘   │  │   │
│  │   │                                                 │  │   │
│  │   └─────────────────────────────────────────────────┘  │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 核心组件

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Tauri 应用 = 前端 + WebView + Rust 后端                       │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │  1. WebView（前端容器）                                  │  │
│   │     ├── Windows: WebView2 (Edge Chromium)               │  │
│   │     ├── macOS: WKWebView (Safari)                      │  │
│   │     └── Linux: WebKitGTK                                │  │
│   │                                                         │  │
│   │  2. IPC Bridge（前后端通信）                             │  │
│   │     ├── invoke()     前端 → 后端（异步调用）             │  │
│   │     ├── events      前端 ← 后端（事件监听）             │  │
│   │     └── window      窗口管理                            │  │
│   │                                                         │  │
│   │  3. Rust Backend（后端逻辑）                            │  │
│   │     ├── Tauri Commands（暴露给前端的函数）               │  │
│   │     ├── Application State（应用状态）                   │  │
│   │     └── Plugin System（插件系统）                       │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 前端技术栈

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Tauri 不限制前端框架，你可以用任意前端技术                       │
│                                                                 │
│   推荐组合：                                                    │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   组合 A：Vue 3 + Vite + TypeScript（推荐）             │  │
│   │   ─────────────────────────────────────────────────────  │  │
│   │   ├── Vue 3        响应式 UI 框架                       │  │
│   │   ├── Vite         构建工具                             │  │
│   │   ├── TypeScript   类型安全                             │  │
│   │   └── Pinia        状态管理                            │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   组合 B：React + Vite + TypeScript                     │  │
│   │   ─────────────────────────────────────────────────────  │  │
│   │   ├── React         UI 框架                             │  │
│   │   ├── Vite          构建工具                            │  │
│   │   ├── TypeScript    类型安全                            │  │
│   │   └── Zustand       状态管理                           │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   组合 C：Svelte + Vite                                  │  │
│   │   ─────────────────────────────────────────────────────  │  │
│   │   ├── Svelte        编译时响应式                        │  │
│   │   └── Vite          构建工具                            │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   对于你的项目（从 electron1 迁移）：                           │
│   → 直接使用 Vue 3 + TypeScript + Pinia，保持一致               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 前端调用后端

```typescript
// 安装 Tauri API 包
// npm install @tauri-apps/api

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// 方式 1：调用后端命令（异步）
const result = await invoke<string>('greet', { name: 'World' });

// 方式 2：监听后端事件
await listen('agent:token', (event) => {
  console.log('Received token:', event.payload);
});

// 方式 3：调用返回 Stream 的命令（用于流式响应）
import { invoke, Channel } from '@tauri-apps/api/core';

const unlisten = await invoke('stream_chat', {
  conversationId: 'xxx',
  message: 'Hello'
}, {
  onEvent: (event) => {
    if (event.payload.type === 'token') {
      console.log('Token:', event.payload.data);
    } else if (event.payload.type === 'done') {
      console.log('Done!');
    }
  }
});
```

---

## 4. 后端技术栈

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Rust 后端 = Tauri Core + 你写的业务逻辑                        │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   核心依赖（自动包含）                                    │  │
│   │   ─────────────────────────────────────────────────────  │  │
│   │   ├── tauri             核心框架                        │  │
│   │   ├── tauri-plugin-*    官方插件（shell/fs/dialog...） │  │
│   │   └── serde             序列化/反序列化                 │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   常用依赖（需要手动添加）                                │  │
│   │   ─────────────────────────────────────────────────────  │  │
│   │   ├── reqwest             HTTP 客户端                   │  │
│   │   ├── sqlx                异步数据库（PostgreSQL/SQLite）│  │
│   │   ├── tokio               异步运行时                    │  │
│   │   ├── tracing             日志追踪                     │  │
│   │   ├── anyhow              错误处理                     │  │
│   │   └── thiserror           自定义错误类型               │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   LLM 相关（你的项目需要）                                │  │
│   │   ─────────────────────────────────────────────────────  │  │
│   │   ├── reqwest + serde_json    HTTP 调用 LLM API         │  │
│   │   └── tokio + async_trait    异步适配器模式             │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Rust 项目结构示例

```
tauri-easy-agent/
├── src/                          # Vue 前端（从 electron1 迁移）
│   ├── App.vue
│   ├── main.ts
│   ├── views/
│   ├── stores/
│   └── api/
│
├── src-tauri/                    # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── icons/
│   │
│   └── src/
│       ├── main.rs               # 入口文件
│       ├── lib.rs                # 库入口
│       │
│       ├── commands/             # Tauri Commands（暴露给前端）
│       │   ├── mod.rs
│       │   ├── chat.rs           # 聊天相关命令
│       │   ├── workflow.rs       # 工作流命令
│       │   └── config.rs         # 配置命令
│       │
│       ├── domain/               # 领域模型
│       │   ├── mod.rs
│       │   ├── message.rs
│       │   ├── workflow.rs
│       │   ├── conversation.rs
│       │   └── types.rs
│       │
│       ├── services/             # 业务逻辑层
│       │   ├── mod.rs
│       │   ├── llm_manager.rs    # LLM 管理器
│       │   ├── workflow_service.rs # 工作流服务
│       │   └── compression.rs     # 压缩服务
│       │
│       ├── adapters/             # 外部适配器
│       │   ├── mod.rs
│       │   ├── llm/              # LLM 适配器
│       │   │   ├── mod.rs
│       │   │   ├── openai.rs
│       │   │   ├── anthropic.rs
│       │   │   └── trait.rs      # LLM Adapter trait
│       │   │
│       │   ├── persistence/      # 持久化适配器
│       │   │   ├── mod.rs
│       │   │   └── sqlite.rs
│       │   │
│       │   └── mcp/              # MCP 适配器
│       │       ├── mod.rs
│       │       └── client.rs
│       │
│       ├── state.rs              # 应用状态管理
│       └── error.rs              # 错误类型定义
│
└── package.json
```

---

## 5. IPC 通信机制

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Tauri IPC = 前后端通信的唯一方式                               │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   前端 → 后端：invoke()                                 │  │
│   │   ─────────────────────────────────────────────────────  │  │
│   │                                                         │  │
│   │   // TypeScript                                        │  │
│   │   const result = await invoke('command_name', {        │  │
│   │     param1: 'value1',                                  │  │
│   │     param2: 'value2'                                   │  │
│   │   });                                                  │  │
│   │                                                         │  │
│   │   // Rust                                              │  │
│   │   #[tauri::command]                                    │  │
│   │   fn command_name(param1: String, param2: String)     │  │
│   │       -> Result<String, String> {                      │  │
│   │       Ok(format!("{} - {}", param1, param2))           │  │
│   │   }                                                    │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   后端 → 前端：emit() / listen()                        │  │
│   │   ─────────────────────────────────────────────────────  │  │
│   │                                                         │  │
│   │   // Rust（后端主动推送）                               │  │
│   │   app.emit("event_name", payload).unwrap();            │  │
│   │                                                         │  │
│   │   // TypeScript（前端监听）                            │  │
│   │   await listen('event_name', (event) => {              │  │
│   │     console.log(event.payload);                        │  │
│   │   });                                                  │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   流式响应：使用 Channel                                │  │
│   │   ─────────────────────────────────────────────────────  │  │
│   │                                                         │  │
│   │   // Rust（用于 LLM 流式输出）                          │  │
│   │   #[tauri::command]                                    │  │
│   │   async fn stream_chat(                                │  │
│   │       window: Window,                                  │  │
│   │       message: String                                  │  │
│   │   ) -> Result<(), String> {                            │  │
│   │       let ch = Channel::new();                         │  │
│   │       let window_clone = window.clone();               │  │
│   │                                                         │  │
│   │       tokio::spawn(async move {                       │  │
│   │           // 模拟流式输出                               │  │
│   │           for token in ["Hello", "World", "!"] {      │  │
│   │               ch.send(token).await;                    │  │
│   │           }                                           │  │
│   │       });                                              │  │
│   │                                                         │  │
│   │       Ok(())                                           │  │
│   │   }                                                    │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 你的 Electron 项目 IPC vs Tauri IPC

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Electron IPC（当前 electron1）                                 │
│   ─────────────────────────────────────────────────────────     │
│                                                                 │
│   // Main Process                                              │
│   ipcMain.handle('chat:send', async (event, ...args) => {      │
│     return await core.sendMessage(...);                         │
│   });                                                           │
│                                                                 │
│   // Renderer Process                                          │
│   const result = await ipcRenderer.invoke('chat:send', args);  │
│                                                                 │
│   // 事件推送                                                  │
│   mainWindow.webContents.send('agent:token', token);           │
│   ipcRenderer.on('agent:token', (event, token) => { ... });   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

                              ⬇ 迁移到 Tauri

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Tauri IPC（迁移后）                                           │
│   ─────────────────────────────────────────────────────────     │
│                                                                 │
│   // Rust Backend                                              │
│   #[tauri::command]                                            │
│   async fn chat_send(                                         │
│       state: State<'_, AppState>,                              │
│       conversation_id: String,                                 │
│       message: String,                                         │
│   ) -> Result<(), String> {                                    │
│       state.llm_manager.send_message(&conversation_id, &message) │
│           .await                                               │
│           .map_err(|e| e.to_string())?;                         │
│       Ok(())                                                  │
│   }                                                            │
│                                                                 │
│   // Vue Frontend                                              │
│   import { invoke } from '@tauri-apps/api/core';               │
│   const result = await invoke('chat_send', {                  │
│       conversation_id: 'xxx',                                  │
│       message: 'Hello'                                         │
│   });                                                         │
│                                                                 │
│   // 事件推送（流式）                                          │
│   // Rust: app.emit("agent:token", token)?;                   │
│   // Vue: listen('agent:token', (e) => updateUI(e.payload)); │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 安全模型

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Tauri 安全模型 = 权限白名单 + IPC 控制                         │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   Electron 的问题：                                     │  │
│   │   ─────────────────────────────────────────────────────  │  │
│   │   ├── Node.js 运行在渲染进程                           │  │
│   │   ├── 任何前端代码都可以调用 Node API                   │  │
│   │   └── 安全漏洞多                                       │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   Tauri 的优势：                                       │  │
│   │   ─────────────────────────────────────────────────────  │  │
│   │   ├── 默认禁用所有 Node.js 功能                         │  │
│   │   ├── 前端只能通过 invoke() 访问后端                    │  │
│   │   ├── 每个命令可以单独设置权限                          │  │
│   │   └── CSP（Content Security Policy）内置支持            │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   权限配置（tauri.conf.json）：                                 │
│                                                                 │
│   {                                                            │
│     "app": {                                                   │
│       "security": {                                            │
│         "csp": "default-src 'self'; script-src 'self'"        │
│       }                                                        │
│     },                                                         │
│     "bundle": {                                                │
│       "identifier": "com.easy-agent.app"                      │
│     }                                                          │
│   }                                                            │
│                                                                 │
│   在 Rust 中声明命令权限：                                      │
│                                                                 │
│   #[tauri::command]                                           │
│   #[specta::specta]  // 自动生成 TypeScript 类型               │
│   fn read_file(path: String) -> Result<String, String> { ... }│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. 生命周期

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Tauri 应用生命周期                                            │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   1. 启动阶段                                           │  │
│   │   ─────────────────────────────────────────────────────  │  │
│   │                                                         │  │
│   │   main() → builder() → setup() → run()                 │  │
│   │                                                         │  │
│   │   // main.rs                                           │  │
│   │   fn main() {                                          │  │
│   │       tauri::Builder::default()                        │  │
│   │           .setup(|app| {                               │  │
│   │               // 初始化应用状态                         │  │
│   │               // 连接数据库                             │  │
│   │               // 加载配置                               │  │
│   │           })                                           │  │
│   │           .run(tauri::generate_context!())             │  │
│   │           .expect("error while running tauri application"); │
│   │   }                                                    │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   2. 运行阶段                                           │  │
│   │   ─────────────────────────────────────────────────────  │  │
│   │                                                         │  │
│   │   ┌───────────────────────────────────────────────┐     │  │
│   │   │                                               │     │  │
│   │   │   WebView ←→ IPC ←→ Rust Backend             │     │  │
│   │   │                           ↓                   │     │  │
│   │   │                       Services                │     │  │
│   │   │                           ↓                   │     │  │
│   │   │                       Adapters                │     │  │
│   │   │                           ↓                   │     │  │
│   │   │                       External APIs          │     │  │
│   │   │                                               │     │  │
│   │   └───────────────────────────────────────────────┘     │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │   3. 退出阶段                                           │  │
│   │   ─────────────────────────────────────────────────────  │  │
│   │                                                         │  │
│   │   window-close → before-quit → quit                    │  │
│   │                                                         │  │
│   │   .setup() 中可以注册退出钩子：                        │  │
│   │   app.on_window_event(|window, event| { ... });        │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. 项目结构

### 完整项目结构

```
tauri-easy-agent/
│
├── src/                          # 前端（Vue 3）
│   ├── main.ts                   # 前端入口
│   ├── App.vue                   # 根组件
│   ├── assets/                   # 静态资源
│   ├── components/               # 通用组件
│   │   └── common/
│   │       ├── LoadingSpinner.vue
│   │       └── DropdownSelector.vue
│   ├── views/                    # 页面视图
│   │   ├── chat/
│   │   │   ├── ChatView.vue
│   │   │   ├── MessageList.vue
│   │   │   └── ModelSelector.vue
│   │   ├── settings/
│   │   │   ├── SettingsView.vue
│   │   │   ├── ApiKeySetting.vue
│   │   │   └── GeneralSetting.vue
│   │   ├── workflow/
│   │   │   └── WorkflowView.vue
│   │   └── plugin/
│   │       └── PluginView.vue
│   ├── stores/                   # Pinia 状态管理
│   │   ├── chat.ts
│   │   ├── config.ts
│   │   └── workflow.ts
│   ├── api/                      # API 调用封装
│   │   ├── chat.ts
│   │   ├── workflow.ts
│   │   └── config.ts
│   ├── layout/                   # 布局组件
│   │   └── Sidebar.vue
│   ├── router/                   # Vue Router
│   │   └── index.ts
│   └── types/                    # TypeScript 类型
│       └── tauri.d.ts            # Tauri 类型声明
│
├── src-tauri/                    # Rust 后端
│   ├── Cargo.toml                # Rust 依赖
│   ├── tauri.conf.json          # Tauri 配置
│   ├── build.rs                 # 构建脚本
│   ├── capabilities/            # 权限配置
│   │   └── default.json
│   ├── icons/                   # 应用图标
│   │   ├── icon.ico
│   │   ├── icon.png
│   │   └── 32x32.png
│   └── src/
│       ├── main.rs              # 入口
│       ├── lib.rs              # 库入口
│       │
│       ├── commands/            # Tauri Commands
│       │   ├── mod.rs
│       │   ├── chat.rs
│       │   ├── workflow.rs
│       │   ├── config.rs
│       │   └── plugin.rs
│       │
│       ├── domain/              # 领域模型
│       │   ├── mod.rs
│       │   ├── message.rs
│       │   ├── conversation.rs
│       │   ├── workflow.rs
│       │   └── types.rs
│       │
│       ├── services/            # 业务逻辑
│       │   ├── mod.rs
│       │   ├── llm_manager.rs
│       │   ├── workflow_service.rs
│       │   └── compression.rs
│       │
│       ├── adapters/            # 外部适配器
│       │   ├── mod.rs
│       │   ├── llm/
│       │   ├── persistence/
│       │   └── mcp/
│       │
│       ├── state.rs            # 应用状态
│       └── error.rs            # 错误处理
│
├── index.html                   # HTML 入口
├── vite.config.ts              # Vite 配置
├── tsconfig.json               # TypeScript 配置
├── package.json                # Node 依赖
└── README.md
```

---

## 9. 快速上手

### 9.1 安装

```bash
# 安装 Rust（如果还没有）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Tauri CLI
npm install -D @tauri-apps/cli

# 创建新项目（使用 Vue + TypeScript 模板）
npm create tauri-app@latest tauri-easy-agent -- --template vue-ts

# 或者手动初始化
cargo install create-tauri-app
cargo create-tauri-app
```

### 9.2 项目配置

```json
// src-tauri/tauri.conf.json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "EasyAgent",
  "identifier": "com.easy-agent.app",
  "version": "0.1.0",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "EasyAgent",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/icon.ico"
    ]
  }
}
```

### 9.3 第一个 Tauri Command

```rust
// src-tauri/src/commands/chat.rs

use tauri::State;
use crate::state::AppState;
use crate::error::AppError;

/// 发送聊天消息
#[tauri::command]
pub async fn chat_send(
    state: State<'_, AppState>,
    conversation_id: String,
    message: String,
) -> Result<(), String> {
    state
        .llm_manager
        .send_message(&conversation_id, &message)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 获取聊天历史
#[tauri::command]
pub async fn chat_history(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    state
        .storage
        .get_messages(&conversation_id)
        .await
        .map_err(|e| e.to_string())
}
```

```rust
// src-tauri/src/lib.rs

mod commands;
mod domain;
mod services;
mod adapters;
mod state;
mod error;

use state::AppState;
use commands::{chat, workflow, config};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            chat::chat_send,
            chat::chat_history,
            chat::chat_new,
            chat::chat_delete,
            workflow::workflow_create,
            workflow::workflow_execute,
            config::get_config,
            config::set_config,
        ])
        .setup(|app| {
            // 应用初始化
            tracing::info!("EasyAgent starting...");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 9.4 前端调用

```typescript
// src/api/chat.ts
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// 发送消息
export async function sendMessage(conversationId: string, message: string) {
  await invoke('chat_send', { conversationId, message });
}

// 获取历史
export async function getChatHistory(conversationId: string) {
  return await invoke('chat_history', { conversationId });
}

// 监听流式 token
export async function onToken(callback: (token: string) => void) {
  return await listen<string>('agent:token', (event) => {
    callback(event.payload);
  });
}

// 创建新对话
export async function newConversation() {
  return await invoke('chat_new');
}
```

---

## 附录：常用命令参考

| Tauri 操作 | 命令 |
|------------|------|
| 调用后端 | `invoke('command_name', { param })` |
| 监听事件 | `listen('event_name', handler)` |
| 发送事件 | `emit('event_name', payload)` |
| 打开窗口 | `Window::new()` |
| 读写文件 | `tauri-plugin-fs` |
| 打开对话框 | `tauri-plugin-dialog` |
| HTTP 请求 | `reqwest` |
| 数据库 | `sqlx` |
| 加密 | `ring` / `aes-gcm` |
| 日志 | `tracing` |
| JSON | `serde_json` |

---

## 相关资源

- [Tauri 官方文档](https://tauri.app/)
- [Tauri v2 迁移指南](https://tauri.app/start/migrate/)
- [Tauri Awesome](https://github.com/tauri-apps/awesome-tauri)
- [Tauri Discord](https://discord.gg/tauri)
