# EasyAgent 开发阶段规划文档

> 版本: v0.1.0 MVP
> 日期: 2026-05-26
> 架构: Electron + 六边形架构

---

## 0. 整体路线图

```
Phase 1          Phase 2           Phase 3           Phase 4
MVP 骨架           核心完善          体验优化          生态扩展
─────────        ─────────        ─────────        ─────────
Electron 启动     MCP 完整连接      多模型支持        移动端
六边形核心        Prompt 模板       工作流导入导出     多 Agent
基础 UI           对话历史          长期记忆/RAG      插件市场
工作流画布        执行日志          条件分支
                                  定时触发
```

---

## Phase 1 — MVP 骨架（目标：一个能跑起来的 Electron 应用）

### 1.1 阶段目标

Electron 应用能启动，六边形核心可调用，前端能渲染，聊天能跑通。

### 1.2 功能模块

#### 模块 1.1：Electron 项目初始化

| 功能 | 描述 | 交付物 |
|------|------|--------|
| 项目结构 | electron/ + renderer/ + shared/ | 目录结构 |
| Electron 启动 | main.ts + preload.ts + BrowserWindow | 可运行的 Electron 应用 |
| Vite 配置 | 前端 Dev Server + 打包配置 | `vite.config.ts` |
| IPC 基础 | preload 暴露 API + 基础 handlers | `window.electronAPI` 可用 |
| 基础 UI 布局 | 三栏布局（侧边/主内容/Agent Pet） | 页面能渲染 |

#### 模块 1.2：六边形核心骨架

| 功能 | 描述 | 交付物 |
|------|------|--------|
| 领域模型 | `domain/types.ts` 定义所有领域对象 | 纯业务，无外部依赖 |
| Port 接口定义 | LLM / Storage / MCP 三个 Port | `ports/*.ts` |
| SQLite 适配器 | 实现 IStoragePort | `adapters/storage/sqlite.adapter.ts` |
| OpenAI 适配器 | 实现 ILLMPort | `adapters/llm/openai.adapter.ts` |
| 核心导出 | `EasyAgentCore` 组合所有 Adapter | `core/index.ts` |

#### 模块 1.3：基础对话

| 功能 | 描述 | 交付物 |
|------|------|--------|
| IPC Handler | chat / config / mcp handlers | `ipc/*.handler.ts` |
| 前端 IPC 封装 | `window.electronAPI` 类型声明 | `types/electron.d.ts` |
| 聊天页面 | 消息列表 + 输入框 + 发送 | `ChatView.vue` |
| Agent Pet | 五种心态 + CSS 动画 | `AgentPet.vue` |

#### 模块 1.4：工作流编排

| 功能 | 描述 | 交付物 |
|------|------|--------|
| 节点组件 | Input / LLM / MCP Tool / Output | Vue Flow 节点 |
| 画布 | 拖拽 + 连线 + 保存 | `FlowView.vue` |
| 工作流执行 | 从画布触发 LangGraph 执行 | `workflow.handler.ts` |

### 1.3 验收标准

- [ ] Electron 应用启动，窗口正常显示
- [ ] 前端 DevTools 可打开
- [ ] 配置 API Key 后能发送消息
- [ ] Agent Pet 心态随状态变化
- [ ] 工作流画布可拖拽节点和连线

---

## Phase 2 — 核心完善（目标：一个好用的应用）

### 2.1 功能模块

#### 模块 2.1：MCP 完整连接

| 功能 | 描述 | 优先级 |
|------|------|--------|
| STDIO 适配器 | 实现 IMcpPort，连接本地 MCP Server | P0 |
| SSE 适配器 | 连接远程 MCP Server | P1 |
| MCP Server 管理 | 添加/删除/启用/禁用 | P0 |
| 工具发现 | 接入后自动列出可用工具 | P0 |
| 工具调用 | LangGraph 节点调用 MCP 工具 | P0 |

#### 模块 2.2：Prompt 模板管理

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 创建模板 | 名称 + System Prompt | P0 |
| 模板列表 | 查看和管理已有模板 | P0 |
| 选择模板 | 对话时选择使用哪个模板 | P0 |
| 预设模板 | 内置健身助手、代码助手等 | P1 |
| 删除/编辑 | 维护已有模板 | P1 |

#### 模块 2.3：对话历史

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 对话列表 | 查看所有历史对话 | P0 |
| 重新加载 | 点击历史继续对话 | P0 |
| 删除对话 | 删除不需要的对话 | P0 |
| 重命名 | 修改对话标题 | P1 |

#### 模块 2.4：Anthropic 适配器

| 功能 | 描述 | 优先级 |
|------|------|--------|
| Claude 接入 | AnthropicAdapter 实现 | P0 |
| 模型切换 | 对话中动态切换模型 | P0 |

### 2.2 验收标准

- [ ] 能连接一个真实 MCP Server（如天气 MCP）
- [ ] 对话中调用 MCP 工具，返回结果
- [ ] 可以创建和管理 Prompt 模板
- [ ] 可以查看和加载历史对话

---

## Phase 3 — 体验优化（目标：好看好用的应用）

### 3.1 功能模块

#### 模块 3.1：多模型支持

| 功能 | 描述 | 优先级 |
|------|------|--------|
| Gemini 适配器 | 接入 Google Gemini | P0 |
| DeepSeek 适配器 | 接入 DeepSeek | P1 |
| 模型切换 UI | 设置页选择模型 | P0 |

#### 模块 3.2：工作流导入/导出

| 功能 | 描述 | 优先级 |
|------|------|--------|
| JSON 导出 | 工作流导出为文件 | P0 |
| JSON 导入 | 加载外部工作流 | P0 |
| 复制分享 | 生成工作流链接 | P1 |

#### 模块 3.3：长期记忆（RAG）

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 向量库集成 | ChromaDB / FAISS | P1 |
| 文档上传 | 上传知识库文件 | P1 |
| 记忆检索 | 对话时自动检索相关记忆 | P1 |

#### 模块 3.4：条件分支

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 条件节点 | if/else 分支 | P0 |
| 多分支 | 支持 3+ 分支 | P1 |
| 分支可视化 | 画布上区分分支 | P0 |

#### 模块 3.5：性能优化

| 功能 | 描述 | 优先级 |
|------|------|--------|
| MCP 连接复用 | 避免每次调用重建连接 | P1 |
| 前端虚拟列表 | 大量消息不卡顿 | P1 |
| 懒加载路由 | 非首屏组件延迟加载 | P1 |

### 3.2 验收标准

- [ ] 支持至少 4 个模型厂商
- [ ] 工作流可导出 JSON 并重新导入
- [ ] 有 RAG 基础能力
- [ ] 页面流畅，无明显卡顿

---

## Phase 4 — 生态扩展（目标：有影响力的产品）

### 4.1 功能模块

#### 模块 4.1：移动端

| 功能 | 描述 | 优先级 |
|------|------|--------|
| iOS App | 原生 iOS 应用 | P1 |
| Android App | 原生 Android 应用 | P1 |
| 移动端适配 | 现有 Web 端响应式 | P0 |
| 推送通知 | 执行结果推送 | P2 |

#### 模块 4.2：多 Agent 协作

| 功能 | 描述 | 优先级 |
|------|------|--------|
| Agent 间通信 | 一个 Agent 输出作为另一个输入 | P1 |
| 并行执行 | DAG 分支并行运行 | P1 |
| Agent 编排 | 画布上编排多个 Agent | P0 |

#### 模块 4.3：插件市场

| 功能 | 描述 | 优先级 |
|------|------|--------|
| MCP Server 模板 | 快速开发自定义 MCP Server | P1 |
| SDK 文档 | 完整的插件开发指南 | P1 |
| 本地插件管理 | 从本地文件夹加载插件 | P0 |

#### 模块 4.4：多用户协作

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 用户认证 | JWT 登录 | P1 |
| 团队空间 | 多用户协作 | P2 |
| 权限控制 | 不同角色不同权限 | P2 |

### 4.2 验收标准

- [ ] 有可用的移动端 App
- [ ] 有工作流模板市场
- [ ] 支持多 Agent 编排
- [ ] 有插件开发 SDK

---

## 附录：文档对应关系

```
Phase 1  ← docs/0526/architecture.md      (架构设计)
         ← docs/00/developer-guide-core.md   (Core 开发指南)
         ← docs/00/developer-guide-renderer.md (前端开发指南)
         ← docs/00/development-phases.md     (本文件)

Phase 2  ← (待生成) developer-guide-phase2.md
Phase 3  ← (待生成) developer-guide-phase3.md
Phase 4  ← (待生成) developer-guide-phase4.md
```

---

## 技术债务和风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| better-sqlite3 原生模块编译 | Windows/macOS/Linux 兼容性问题 | 使用 `@vscode/sqlite3` 或 `sql.js`（WASM）替代 |
| LangGraph JS 版本不稳定 | API 频繁变化 | 锁定版本，定期检查更新 |
| 六边形架构过度设计 | 开发速度变慢 | MVP 只用必要的 Port，不过度抽象 |
| Electron 打包体积大 | 分发困难 | 使用 electron-builder 压缩，动态加载非首屏模块 |

---

*文档版本: v0.1.0 | 最后更新: 2026-05-26*
