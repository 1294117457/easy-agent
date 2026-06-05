# EasyAgent 开发阶段规划文档

> 版本: v0.2.0 MVP
> 日期: 2026-05-26
> 架构: Electron + electron-vite + 六边形架构（单一项目结构）
> 重构: 从 packages 双包结构迁移到 electron-vite 单项目结构

---

## 0. 整体路线图

```
Phase 1          Phase 2           Phase 3           Phase 4
MVP 骨架           核心完善          体验优化          生态扩展
─────────        ─────────        ─────────        ─────────
electron-vite    MCP 完整连接      多模型支持        移动端
六边形核心        Prompt 模板       工作流导入导出     多 Agent
基础 UI          对话历史          长期记忆/RAG      插件市场
工作流画布       执行日志           条件分支
                                  定时触发
```

---

## 1. 项目结构（electron-vite 单项目）

```
easy-agent/
├── electron/                      # 主进程源码
│   ├── main.ts                  # Electron 入口 + IPC 注册
│   ├── preload.ts               # Context Bridge
│   ├── core/                     # 六边形架构核心
│   │   ├── index.ts
│   │   ├── domain/types.ts
│   │   ├── ports/
│   │   │   ├── llm.port.ts
│   │   │   ├── storage.port.ts
│   │   │   └── mcp.port.ts
│   │   ├── adapters/
│   │   │   ├── llm/openai.adapter.ts
│   │   │   └── storage/sqlite.adapter.ts
│   │   └── application/AgentService.ts
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
│   ├── api/
│   │   ├── chat.ts
│   │   └── config.ts
│   └── types/electron.d.ts
│
├── index.html
├── electron.vite.config.ts        # electron-vite 配置
├── tsconfig.json                  # 项目引用配置
├── tsconfig.node.json             # 主进程 TypeScript 配置
├── tsconfig.web.json              # 渲染进程 TypeScript 配置
├── package.json                   # 统一依赖
└── dist/                         # electron-vite 编译产物
    ├── main/main.js              # 主进程 CJS
    ├── preload/index.js          # preload CJS
    └── renderer/                  # Vite 打包产物
```

---

## Phase 1 — MVP 骨架

### 模块概览

| 功能 | 描述 | 交付物 |
|------|------|--------|
| electron-vite 骨架 | 统一构建，主进程/ preload/ renderer 一次配置 | 可运行的 Electron 应用 |
| 六边形核心骨架 | domain/types.ts + 三个 Port | `core/` 目录完整 |
| SQLite 存储 | 实现 IStoragePort，API Key 加密 | `sqlite.adapter.ts` |
| OpenAI 对话 | 实现 ILLMPort，AgentService | `openai.adapter.ts` + `AgentService.ts` |
| IPC 打通 | preload 暴露 API + handlers | `window.electronAPI` 可用 |
| 基础 UI 布局 | 三栏布局（侧边/主内容/Agent Pet） | 页面能渲染 |
| 聊天页面 | 消息列表 + 输入框 + 发送 | `ChatView.vue` |
| 设置页面 | API Key + Prompt 管理 | `SettingsView.vue` |

### 验收标准

- [ ] `npm run dev` 单一命令启动 Electron + Vite Dev Server
- [ ] Electron 窗口正常显示（1200x800）
- [ ] 前端 DevTools 可打开
- [ ] 配置 API Key 后能发送消息并收到回复
- [ ] 重启后历史对话还在

---

## Phase 2 — 核心完善

### 模块概览

| 功能 | 描述 | 优先级 |
|------|------|--------|
| STDIO MCP 适配器 | 实现 IMcpPort，连接本地 MCP Server | P0 |
| SSE MCP 适配器 | 连接远程 MCP Server | P1 |
| MCP Server 管理 | 添加/删除/启用/禁用 | P0 |
| 工具发现 | 接入后自动列出可用工具 | P0 |
| Claude 适配器 | AnthropicAdapter 实现 | P0 |
| Prompt 模板管理 | 创建/选择/删除模板 | P0 |
| 对话历史 | 查看/重新加载/删除/重命名 | P0 |

### 验收标准

- [ ] 能连接一个真实 MCP Server（如天气 MCP）
- [ ] 对话中调用 MCP 工具，返回结果
- [ ] 可以创建和管理 Prompt 模板
- [ ] 可以查看和加载历史对话

---

## Phase 3 — 体验优化

| 功能 | 描述 | 优先级 |
|------|------|--------|
| Gemini 适配器 | 接入 Google Gemini | P0 |
| DeepSeek 适配器 | 接入 DeepSeek | P1 |
| 模型切换 UI | 设置页选择模型 | P0 |
| 工作流导入/导出 | JSON 导出和导入 | P0 |
| 条件分支节点 | if/else 分支 | P0 |
| 工作流画布 | Vue Flow 节点拖拽连线 | P0 |
| RAG 基础 | 向量库集成 + 文档上传 | P1 |
| 前端虚拟列表 | 大量消息不卡顿 | P1 |

---

## Phase 4 — 生态扩展

| 功能 | 描述 | 优先级 |
|------|------|--------|
| iOS/Android App | 原生移动端应用 | P1 |
| 移动端适配 | 现有 Web 端响应式 | P0 |
| 多 Agent 协作 | Agent 间通信，并行执行 | P1 |
| 插件市场 | MCP Server 模板 + SDK | P1 |
| 用户认证 | JWT 登录 + 团队空间 | P1 |

---

## 技术债务和风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| better-sqlite3 原生模块编译 | Windows/macOS/Linux 兼容性问题 | 考虑 `sql.js`（WASM）或 `@vscode/sqlite3` |
| LangGraph JS 版本不稳定 | API 频繁变化 | 锁定版本，定期检查更新 |
| electron-vite 依赖兼容性 | electron-vite + electron-builder 版本冲突 | 关注官方 release note |
| 六边形架构过度设计 | 开发速度变慢 | MVP 只用必要的 Port，不过度抽象 |

---

## 文档对应关系

```
Phase 1  ← docs/0526/architecture.md          (架构设计)
         ← docs/00/developer-guide-core.md    (Core 开发指南)
         ← docs/00/developer-guide-renderer.md (前端开发指南)
         ← docs/0526/development-guide-mvp.md (MVP 开发文档)
         ← docs/0526/steps/step1-4.md         (分步骤指南)

Phase 2  ← (待生成) developer-guide-phase2.md
Phase 3  ← (待生成) developer-guide-phase3.md
Phase 4  ← (待生成) developer-guide-phase4.md
```

---

*文档版本: v0.2.0 | 最后更新: 2026-05-26*
