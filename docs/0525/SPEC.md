# EasyAgent 产品规格说明书 (SPEC)

> 版本: v0.1.0 MVP
> 日期: 2026-05-25
> 状态: 规划中

---

## 1. 愿景与定位

### 1.1 产品愿景

**让 Agent 使用变得简单，人人都可以搭配出自己需要的 Agent。**

我们相信，AI Agent 不应该是少数开发者的专属工具。EasyAgent 的使命是让任何人都能像搭积木一样，组合出适合自己的 AI 助手——不需要写代码，不需要理解底层原理，只需选择、连接、运行。

### 1.2 核心定位

| 维度 | 描述 |
|------|------|
| **产品类型** | 去中心化 Agent 平台（中心化 MVP 起步） |
| **目标用户** | 普通用户、AI 爱好者、轻度开发者 |
| **核心差异** | 零门槛、可视化、插件热插拔 |
| **竞品参考** | Dify（面向开发者）、Coze（功能复杂）、LangFlow（学习成本高） |
| **差异化点** | 极简 UX + 桌面宠物 Agent 形象 + 插件即插即用 |

### 1.3 长期愿景（路线图）

```
Phase 1 (MVP)     → 前后端分离应用，三个基础功能
Phase 2           → 操作简化，UX 优化
Phase 3           → 移动端扩展
Phase 4           → 去中心化，社区共建
```

---

## 2. 功能规格

### 2.1 核心功能模块

#### 模块 A：基础环境与 API Key 配置

**功能描述**：用户配置自己的大模型 API Key，EasyAgent 作为统一的 Agent 调度层。

**功能点**：

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 添加 API Key | 支持 OpenAI、Claude、Gemini、DeepSeek 等主流模型 | P0 |
| Key 加密存储 | API Key 使用加密存储，不明文暴露 | P0 |
| 模型选择 | 下拉选择已配置的模型 | P0 |
| 连接测试 | 保存前测试 Key 是否有效 | P1 |
| 多 Key 管理 | 支持配置多个 API Key，灵活切换 | P1 |
| 费用统计 | 简单记录 Token 消耗（可扩展） | P2 |

**用户流程**：
```
打开设置 → 添加 API Key → 选择模型 → 保存并测试 → 配置完成
```

**边界约束**：
- API Key 仅存储在本地或用户自有服务器
- 不上传 Key 至任何第三方

---

#### 模块 B：MCP 插件接入

**功能描述**：通过 MCP（Model Context Protocol）协议接入外部功能插件，实现 Agent 能力的扩展。

**功能点**：

| 功能 | 描述 | 优先级 |
|------|------|--------|
| MCP Server 配置 | 输入 MCP Server 地址/URL 接入插件 | P0 |
| 插件发现 | 自动列出已接入 MCP Server 提供的工具 | P0 |
| 插件启用/禁用 | 开关控制各插件的可用状态 | P0 |
| 插件搜索 | 在已接入插件中搜索特定功能 | P1 |
| 插件市场（远期） | 公共插件市场浏览和安装 | P2 |
| 个人插件发布（远期） | 用户将自己开发的 MCP Server 发布到市场 | P2 |

**MCP 协议支持**：
- STDIO 模式（本地 MCP Server）
- SSE/HTTP 模式（远程 MCP Server）

**用户流程**：
```
插件管理 → 添加 MCP Server → 自动发现工具 → 启用需要的插件
```

**边界约束**：
- MVP 仅支持标准的 MCP 协议接入
- 暂不支持 MCP Server 鉴权（远期支持）

---

#### 模块 C：流程编排（Workflow）

**功能描述**：用户通过可视化方式编排 Agent 的工作流程，将多个插件/工具串联成完整任务。

**功能点**：

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 节点拖拽 | 从插件列表拖拽节点到画布 | P0 |
| 节点连接 | 拖拽连线将节点串联 | P0 |
| 节点配置 | 点击节点配置参数/输入 | P0 |
| 流程保存/加载 | 保存编排好的流程，支持加载 | P0 |
| 单步执行 | 逐步执行流程，查看每步结果 | P1 |
| 整体执行 | 一键运行完整流程 | P0 |
| 执行日志 | 显示每步的输入输出 | P1 |
| 流程导入/导出 | JSON 格式的流程文件导入导出 | P1 |

**编排范式**：
```
[输入节点] → [MCP工具节点] → [MCP工具节点] → [输出节点]
```

**边界约束**：
- MVP 流程图仅支持线性 + 简单条件分支
- 不支持循环和复杂 DAG（远期支持）

---

### 2.2 用户界面模块

| 界面 | 描述 | 对应模块 |
|------|------|----------|
| **Agent 桌面宠物** | 主界面中央的机器人形象，作为 Agent 的"脸" | 全局 |
| **侧边导航** | 切换：聊天 / 插件 / 编排 / 设置 | 全局 |
| **聊天界面** | 与 Agent 对话，触发编排的流程 | 模块 C |
| **插件管理** | 列表展示已接入 MCP 插件，支持搜索和开关 | 模块 B |
| **编排画布** | 可视化拖拽编排工作流 | 模块 C |
| **设置页面** | API Key 配置、模型选择 | 模块 A |

---

## 3. 数据模型

### 3.1 核心实体

```typescript
// 用户配置
interface UserConfig {
  apiKeys: ApiKey[];
  activeModel: string;
  preferences: UserPreferences;
}

// API Key
interface ApiKey {
  id: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'deepseek' | string;
  encryptedKey: string;  // AES-256-GCM 加密
  model: string;
  enabled: boolean;
}

// MCP Server
interface McpServer {
  id: string;
  name: string;
  type: 'stdio' | 'sse';
  command?: string;  // stdio 模式
  url?: string;      // sse 模式
  enabled: boolean;
}

// MCP 工具
interface McpTool {
  id: string;
  serverId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;  // JSON Schema
  enabled: boolean;
}

// 工作流
interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;  // ISO timestamp
  updatedAt: string;
}

// 工作流节点
interface WorkflowNode {
  id: string;
  type: 'input' | 'llm' | 'mcp_tool' | 'output' | 'condition';
  position: { x: number; y: number };
  config: NodeConfig;
}

// 工作流边
interface WorkflowEdge {
  id: string;
  source: string;       // source node id
  target: string;       // target node id
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;       // 条件边标签
}

// 节点配置
interface NodeConfig {
  // MCP 工具节点
  mcpServerId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;

  // LLM 节点
  model?: string;
  promptTemplate?: string;
  systemPrompt?: string;

  // 输入节点
  inputType?: 'text' | 'file';

  // 输出节点
  outputFormat?: 'text' | 'json' | 'file';
}
```

---

## 4. 非功能需求

### 4.1 性能

| 指标 | 要求 |
|------|------|
| 页面加载时间 | < 2s |
| 插件发现响应 | < 1s |
| 流程执行反馈 | 实时（流式输出） |

### 4.2 安全

| 需求 | 描述 |
|------|------|
| API Key 加密 | AES-256-GCM 加密存储 Key |
| 本地优先 | 数据优先存储在本地 |
| 无追踪 | 不上报用户数据 |

### 4.3 可用性

| 需求 | 描述 |
|------|------|
| 响应式布局 | 支持桌面端（主要）+ 平板端 |
| 主题 | 深色模式为主，浅色可选 |
| 无障碍 | 基础键盘导航支持 |

---

## 5. 技术选型（MVP）

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **编排内核** | @langchain/langgraph | LangGraph JS 官方库，流程编排引擎 |
| **LLM 集成** | @langchain/core | 模型统一接口 |
| **MCP 接入** | @modelcontextprotocol/sdk | MCP 协议官方 JS SDK |
| **后端** | Node.js + Express.js + TypeScript | 高性能异步服务 |
| **前端** | Vue 3 + TypeScript | 主流技术栈 |
| **前端状态** | Pinia | Vue 状态管理 |
| **流程图** | @vue-flow/core (Vue Flow) | 可视化编排画布 |
| **本地存储** | better-sqlite3 | 高性能 SQLite 驱动 |
| **加密** | Node.js crypto | AES-256-GCM + PBKDF2 |
| **WebSocket** | ws | 服务端 WebSocket |
| **运行时** | tsx / ts-node | TypeScript 直接运行 |
| **构建工具** | Vite | 前端构建 + 后端热重载 |

> **关于 LangGraph JS**：LangChain 官方提供了 `@langchain/langgraph`，功能与 Python 版基本一致，支持状态机式的 Agent 编排、节点定义、条件边等核心能力。

---

## 6. 项目结构（MVP）

```
easy-agent/
├── packages/
│   ├── server/                      # Node.js 后端
│   │   ├── src/
│   │   │   ├── index.ts            # Express 入口
│   │   │   ├── config.ts           # 配置管理
│   │   │   ├── app.ts             # Express App 定义
│   │   │   ├── routes/            # 路由
│   │   │   │   ├── keys.ts        # API Key 管理
│   │   │   │   ├── mcp.ts         # MCP 插件管理
│   │   │   │   ├── workflow.ts     # 流程编排
│   │   │   │   └── chat.ts        # 对话接口
│   │   │   ├── services/          # 业务逻辑
│   │   │   │   ├── agent.ts       # Agent 核心（LangGraph）
│   │   │   │   ├── mcp-client.ts  # MCP 客户端
│   │   │   │   ├── storage.ts     # 存储服务
│   │   │   │   └── key-manager.ts # Key 加密管理
│   │   │   ├── graph/             # LangGraph 图定义
│   │   │   │   ├── nodes.ts       # 节点定义
│   │   │   │   ├── edges.ts       # 边定义
│   │   │   │   └── compiler.ts    # 图编译
│   │   │   ├── db/               # 数据库
│   │   │   │   ├── schema.ts      # 表结构定义
│   │   │   │   └── migrations/     # 迁移文件
│   │   │   └── types/            # 共享类型
│   │   │       ├── workflow.ts
│   │   │       ├── mcp.ts
│   │   │       └── api-key.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── frontend/                    # Vue 3 前端
│       ├── src/
│       │   ├── App.vue
│       │   ├── main.ts
│       │   ├── views/              # 页面
│       │   │   ├── ChatView.vue
│       │   │   ├── PluginView.vue
│       │   │   ├── FlowView.vue
│       │   │   └── SettingsView.vue
│       │   ├── components/         # 组件
│       │   │   ├── AgentPet/
│       │   │   │   ├── AgentPet.vue
│       │   │   │   ├── PetBody.vue
│       │   │   │   ├── PetFace.vue
│       │   │   │   ├── PetAnimation.vue
│       │   │   │   └── PetStates.ts
│       │   │   ├── FlowCanvas/
│       │   │   │   ├── FlowCanvas.vue
│       │   │   │   ├── InputNode.vue
│       │   │   │   ├── LLMNode.vue
│       │   │   │   ├── MCPToolNode.vue
│       │   │   │   └── OutputNode.vue
│       │   │   ├── Sidebar.vue
│       │   │   └── ...
│       │   ├── stores/             # Pinia Store
│       │   ├── api/                # API 调用封装
│       │   ├── composables/        # 组合式函数
│       │   ├── types/              # TypeScript 类型
│       │   └── styles/
│       ├── package.json
│       ├── vite.config.ts
│       └── tsconfig.json
│
├── docs/
│   └── 0525/
│       ├── SPEC.md
│       └── architecture.md
│
└── README.md
```

> 采用 `packages/` monorepo 结构，server 和 frontend 为独立子包，可分别开发部署。

---

## 7. 里程碑（Roadmap）

| 阶段 | 目标 | 交付物 |
|------|------|--------|
| **M0 - 基础框架** | 搭建 monorepo 骨架，跑通前后端通信 | 项目目录结构 + API 互通 |
| **M1 - API Key 模块** | 完成 Key 配置、加密存储、模型调用 | 可切换不同模型对话 |
| **M2 - MCP 接入模块** | 完成 MCP Server 接入、工具发现 | 可调用外部 MCP 工具 |
| **M3 - 流程编排模块** | 完成可视化编排、流程执行 | 可编排并运行简单工作流 |
| **M4 - 集成与 UX** | 三个模块串联，界面美化 | 可用的 MVP 产品 |

---

## 8. 附录

### 8.1 术语表

| 术语 | 定义 |
|------|------|
| **Agent** | AI 代理，能够执行任务的智能体 |
| **MCP** | Model Context Protocol，模型上下文协议，用于连接 AI 与外部工具 |
| **Workflow** | 工作流，多个节点串联的任务执行流程 |
| **API Key** | 调用大模型 API 的密钥凭证 |

### 8.2 参考资料

- [LangGraph JS 官方文档](https://langchain-ai.github.io/langgraphjs/)
- [MCP JS SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Vue 3 官方文档](https://vuejs.org/)
- [Express.js 官方文档](https://expressjs.com/)
- [better-sqlite3 文档](https://github.com/WiseLibs/better-sqlite3)
