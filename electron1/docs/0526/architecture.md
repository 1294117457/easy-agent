# EasyAgent 架构设计文档

> 版本: v0.2.0 MVP
> 日期: 2026-05-26
> 状态: 已重构为 electron-vite 单项目结构
> 架构: Electron + electron-vite + 六边形架构

---

## 1. 整体架构

### 1.1 架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         easy-agent (electron-vite 单项目)                       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  electron/ (主进程, dist/main/main.js)                                  │  │
│  │  ┌───────────────────────────────────────────────────────────────┐  │  │
│  │  │  Hexagonal Core (electron/core/)                               │  │  │
│  │  │                                                              │  │  │
│  │  │  ┌──────────────────────────────────────────────────┐      │  │  │
│  │  │  │  Agent Core (AgentService, LangGraph 编排)          │      │  │  │
│  │  │  │  - 工作流编排 / 状态机 / 节点执行                     │      │  │  │
│  │  │  └──────────────────────────────────────────────────┘      │  │  │
│  │  │                      │                                       │  │  │
│  │  │  ┌────────────────┼────────────────┐                    │  │  │
│  │  │  │                │                │                    │  │  │
│  │  │  │ Port: LLM   Port: Storage  Port: MCP                │  │  │  │
│  │  │  │       │              │            │                    │  │  │  │
│  │  │  │       ▼              ▼            ▼                    │  │  │  │
│  │  │  │  OpenAI       SQLite     STDIO/SSE                    │  │  │  │
│  │  │  │  Adapter      Adapter    Adapter                    │  │  │  │
│  │  │  └──────────────────────────────────────────────────┘      │  │  │
│  │  └───────────────────────────────────────────────────────────┘  │  │
│  │  electron/ipc/ (IPC 处理器黏合层)                                │  │
│  │  electron/preload.ts → dist/preload/index.js (Context Bridge)    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  src/ (渲染进程, dist/renderer/)                                     │  │
│  │  Vue 3 + Pinia + Vue Router + Vue Flow                              │  │
│  │  IPC API 封装 (src/api/chat.ts, src/api/config.ts)                  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 目录结构

```
easy-agent/
├── electron/                      # 主进程 TypeScript 源码
│   ├── main.ts                  # Electron 入口 + IPC 注册
│   ├── preload.ts               # Context Bridge（编译为 CJS）
│   │
│   ├── core/                     # 六边形架构核心
│   │   ├── index.ts             # 核心导出
│   │   ├── domain/
│   │   │   └── types.ts         # 领域类型
│   │   ├── ports/
│   │   │   ├── llm.port.ts
│   │   │   ├── storage.port.ts
│   │   │   └── mcp.port.ts
│   │   ├── adapters/
│   │   │   ├── llm/
│   │   │   │   └── openai.adapter.ts
│   │   │   └── storage/
│   │   │       └── sqlite.adapter.ts
│   │   └── application/
│   │       └── AgentService.ts
│   │
│   └── ipc/
│       ├── chat.handler.ts
│       └── config.handler.ts
│
├── src/                          # 渲染进程 Vue 源码
│   ├── main.ts
│   ├── App.vue
│   ├── style.css
│   ├── components/Sidebar.vue
│   ├── views/
│   │   ├── ChatView.vue
│   │   ├── FlowView.vue
│   │   ├── PluginView.vue
│   │   ├── SettingsView.vue
│   │   └── HistoryView.vue
│   ├── stores/agent.ts
│   ├── api/chat.ts
│   ├── api/config.ts
│   └── types/electron.d.ts
│
├── index.html                    # 渲染进程 HTML 入口
├── electron.vite.config.ts        # electron-vite 构建配置
├── tsconfig.json                  # 项目引用
├── tsconfig.node.json             # 主进程 TypeScript 配置
├── tsconfig.web.json              # 渲染进程 TypeScript 配置
├── package.json                   # 统一依赖
└── dist/                         # 编译产物
    ├── main/main.js              # 主进程 CJS
    ├── preload/index.js          # preload CJS
    └── renderer/                  # Vite 打包产物
```

### 1.3 三种通信方式

| 通信方式 | 连接双方 | 方向 | 传输内容 | 说明 |
|---------|---------|------|---------|------|
| **IPC** | src ↔ electron | 双向 | 用户输入、Agent 响应、配置更新 | Electron 内置，contextBridge 暴露 API |
| **stdio** | electron ↔ MCP 插件子进程 | 双向 | 工具调用指令、执行结果 | MCP 协议标准通信方式 |
| **HTTP** | electron ↔ LLM API | 单向请求 | API Key、Prompt、流式响应 | 外部大模型 API 调用 |

---

## 2. electron-vite 构建架构

### 2.1 为什么用 electron-vite

| 对比项 | 旧架构（packages/ + tsc） | electron-vite |
|--------|--------------------------|---------------|
| 包管理 | 两个独立 `package.json` | 单一 `package.json` |
| ESM/CJS | 手动处理边界 | 自动处理 |
| 开发模式 | 两个终端分别运行 | **单一命令** `electron-vite dev` |
| 编译 | `tsc` + `esbuild` + `concurrently` | `electron-vite build` 统一打包 |
| Preload | 手写 `.cjs` | TypeScript → 自动编译为 CJS |
| 热更新 | nodemon + tsc --watch | Vite HMR 驱动 |

### 2.2 electron.vite.config.ts 核心配置

```typescript
import { defineConfig } from 'electron-vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'electron/main.ts'),
          preload: resolve(__dirname, 'electron/preload.ts'),
        },
        output: { entryFileNames: '[name]/[name].js' },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload.ts'),
        output: { entryFileNames: 'preload/index.js' },
      },
    },
  },
  renderer: {
    plugins: [vue()],
    resolve: { alias: { '@': resolve(__dirname, 'src') } },
  },
});
```

输出结构：
- `dist/main/main.js` — 主进程 CJS
- `dist/preload/index.js` — preload CJS
- `dist/renderer/` — Vite 打包产物

### 2.3 main.ts 中的 preload 路径

```typescript
// electron/main.ts
preload: join(__dirname, '../preload/index.js')

// dev 时：__dirname = dist/main
// 所以 preload 路径指向 dist/preload/index.js ✓
```

---

## 3. 六边形架构详解

### 3.1 核心（Core）

```
electron/core/
├── Domain/           # 领域模型（纯业务概念，无外部依赖）
│   └── types.ts     # 领域类型定义
│
├── Application/      # 应用逻辑（组合 Port，编排业务流程）
│   └── AgentService.ts     # Agent 对话编排
│
└── Ports/            # 端口接口（定义核心需要什么能力）
    ├── llm.port.ts
    ├── storage.port.ts
    └── mcp.port.ts
```

### 3.2 适配器（Adapters）

```
electron/core/adapters/
├── llm/
│   └── openai.adapter.ts      # 实现 ILLMPort
│
├── storage/
│   └── sqlite.adapter.ts      # 实现 IStoragePort
│
└── mcp/
    └── stdio.adapter.ts       # 实现 IMcpPort（STDIO 模式）
```

---

## 4. Electron 进程模型

### 4.1 Main Process（electron/）

```
electron/ (dist/main/main.js)
├── 职责：
│   1. 运行 Agent 核心（LangGraph）
│   2. 管理 MCP 子进程（启动/停止/通信）
│   3. 访问本地 SQLite 数据库
│   4. 调用 LLM API（HTTP）
│   5. 处理 IPC 消息
│
├── 数据存储：
│   └── ~/Library/Application Support/EasyAgent/data/
│       └── easy-agent.db
│
└── 生命周期：
    ├── 启动 → 初始化核心 → 连接 MCP → 等待 IPC
    ├── 退出 → 断开 MCP → 保存状态 → 退出
    └── MCP 子进程由主进程管理（spawn/kill）
```

### 4.2 Renderer Process（src/）

```
src/ (dist/renderer/)
├── 职责：
│   1. 渲染 Vue 3 UI
│   2. 接收用户输入
│   3. 通过 IPC 调用主进程
│   4. 渲染 Agent 响应
│
└── IPC 调用方式：
    ├── ipcRenderer.invoke('chat:send', message)   # 请求
    ├── ipcRenderer.on('agent:token', callback)   # 流式响应
    └── ipcRenderer.on('agent:done', callback)     # 完成事件
```

### 4.3 IPC 通信协议

```typescript
// electron/preload.ts — 暴露安全的 IPC API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 对话
  sendMessage: (conversationId: string, message: string) =>
    ipcRenderer.invoke('chat:send', conversationId, message),
  onToken: (callback: (token: string) => void) =>
    ipcRenderer.on('agent:token', (_, token) => callback(token)),

  // 配置
  getConfig: () => ipcRenderer.invoke('config:get'),
  createApiKey: (data) => ipcRenderer.invoke('config:apiKey:create', data),
  deleteApiKey: (id) => ipcRenderer.invoke('config:apiKey:delete', id),

  // 完成/错误
  onDone: (callback) => ipcRenderer.on('agent:done', () => callback()),
  onError: (callback) => ipcRenderer.on('agent:error', (_, err) => callback(err)),
});
```

---

## 5. 技术选型

| 组件 | 技术选型 | 说明 |
|------|---------|------|
| **桌面应用框架** | Electron 33+ + electron-vite | 统一构建流水线 |
| **前端框架** | Vue 3 + TypeScript | 组合式 API |
| **状态管理** | Pinia | Vue 官方推荐 |
| **流程图** | Vue Flow | 可视化工作流编排 |
| **Agent 编排** | LangGraph | 状态图定义工作流 |
| **MCP 通信** | @modelcontextprotocol/sdk | Anthropic 官方 |
| **本地数据库** | better-sqlite3 | SQLite，Electron 原生支持 |
| **LLM SDK** | @langchain/openai, @langchain/anthropic | 多模型支持 |
| **构建工具** | electron-vite + electron-builder | 开发体验 + 打包 |

---

## 6. 生命周期

### 6.1 应用启动流程

```
用户启动应用
      │
      ▼
npm run dev → electron-vite dev
      │
      ├── electron-vite 启动 Vite Dev Server (http://localhost:5173)
      ├── electron-vite 编译主进程 → dist/main/main.js
      ├── electron-vite 编译 preload → dist/preload/index.js
      │
      ▼
electron/main.ts 执行
      │
      ├── 读取用户配置
      ├── 初始化 SQLite（连接数据库）
      │
      ▼
Hexagonal Core 初始化
      │
      ├── 加载 API Key（从 SQLite 解密）
      ├── 初始化 LLM Adapter
      ├── 初始化 Storage Adapter
      │
      ▼
IPC 服务就绪 → 注册所有 IPC Handler
      │
      ▼
src/ 渲染进程启动 → Vue 3 挂载
      │
      ▼
应用就绪（显示主界面）
```

### 6.2 对话执行流程

```
用户输入消息 → src/
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
      ├── LLM 节点 → LLM Port（Adapter → OpenAI API）
      │
      │  IPC: agent:token（每个 token 实时推送）
      │  ◀─────────────────────────────────────────
      │
      ▼
回复生成完毕 → 保存消息到 SQLite
      │
      ▼
IPC: agent:done
      ▼
src/ 渲染完成
```

---

## 7. 与之前文档的差异

| 对比项 | 之前（packages/ 双包） | 现在（electron-vite 单项目） |
|-------|---------------------|--------------------------|
| 包管理 | 两个 `package.json` | 单一 `package.json` |
| Dev 命令 | 两个终端 | `npm run dev` |
| 主进程入口 | `main.mjs`（纯 ESM JS） | `electron/main.ts`（TypeScript） |
| Preload | `preload.cjs`（纯 CJS JS） | `electron/preload.ts`（TypeScript） |
| 编译工具 | `tsc` + `esbuild` + `concurrently` | `electron-vite build` |
| ESM 兼容性 | 需手动处理 | electron-vite 自动处理 |
| 产物目录 | `packages/main/dist/` | `dist/main/` + `dist/preload/` + `dist/renderer/` |
| 前端类型 | 手动维护 `preload.d.ts` | `electron/preload.ts` 自动推断 |

---

*文档版本: v0.2.0 | 最后更新: 2026-05-26*
