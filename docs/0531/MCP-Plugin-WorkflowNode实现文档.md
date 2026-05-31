# MCP-Plugin-WorkflowNode 实现文档

> 生成时间：2026-05-30
> 版本：v1.0

---

## 一、实现概述

本次开发完成了 MCP → Plugin → WorkflowNode → Workflow 的完整链路，实现以下功能：

1. **MCP 接入**：通过 stdio 方式连接 MCP Server，获取工具列表，调用工具
2. **Plugin 封装**：封装 MCP Tool 为可复用的 Plugin
3. **WorkflowNode 封装**：规范化的节点，包含 I/O Schema 和映射
4. **Workflow 编排**：拓扑排序、串联执行

---

## 二、目录结构

```
electron/
├── core/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── Conversation.ts
│   │   │   ├── Message.ts
│   │   │   ├── Plugin.ts           ← 新增
│   │   │   ├── WorkflowNode.ts      ← 新增
│   │   │   └── Workflow.ts          ← 新增
│   │   ├── types.ts                 ← 更新（扩展 McpServer）
│   │   └── index.ts                 ← 更新（导出新实体）
│   │
│   ├── application/
│   │   ├── AgentService.ts
│   │   ├── PluginService.ts         ← 新增
│   │   ├── WorkflowNodeService.ts   ← 新增
│   │   └── WorkflowService.ts       ← 新增
│   │
│   ├── adapters/
│   │   ├── llm/
│   │   │   ├── openai.adapter.ts
│   │   │   └── ...
│   │   ├── mcp/
│   │   │   └── stdio.adapter.ts     ← 新增（MCP stdio 连接器）
│   │   └── storage/
│   │       └── sqlite.adapter.ts
│   │
│   ├── ports/
│   │   ├── llm.port.ts
│   │   ├── mcp.port.ts
│   │   └── storage.port.ts
│   │
│   └── index.ts                     ← 更新（初始化服务）
│
├── ipc/
│   ├── chat.handler.ts
│   ├── config.handler.ts
│   └── workflow.handler.ts          ← 新增（IPC 处理器）
│
└── main.ts                          ← 更新（注册处理器）
```

---

## 三、新增/修改文件清单

### 3.1 新增文件

| 文件路径 | 说明 |
|----------|------|
| `core/domain/entities/Plugin.ts` | Plugin 实体定义 |
| `core/domain/entities/WorkflowNode.ts` | WorkflowNode 实体定义 |
| `core/domain/entities/Workflow.ts` | Workflow 实体定义 |
| `core/adapters/mcp/stdio.adapter.ts` | MCP stdio 连接器 |
| `core/application/PluginService.ts` | Plugin 服务 |
| `core/application/WorkflowNodeService.ts` | WorkflowNode 服务 |
| `core/application/WorkflowService.ts` | Workflow 服务 |
| `ipc/workflow.handler.ts` | IPC 处理器 |

### 3.2 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `core/domain/types.ts` | 扩展 McpServer 类型（添加 args, env） |
| `core/domain/index.ts` | 导出新实体 |
| `core/index.ts` | 初始化 MCP 相关服务 |
| `main.ts` | 注册新的 IPC handlers |

---

## 四、核心实现

### 4.1 MCP 接入（stdio.adapter.ts）

```typescript
// 功能：通过 stdio 连接 MCP Server
// - connect(server): 连接 MCP Server
// - disconnect(serverId): 断开连接
// - listTools(serverId): 获取工具列表
// - callTool(serverId, toolName, args): 调用工具
```

### 4.2 Plugin 封装

```typescript
interface Plugin {
  id: string;
  name: string;
  description: string;
  serverId: string;        // 关联的 MCP Server
  toolNames: string[];     // 封装的工具列表
}

// 功能：
// - createPlugin(): 创建 Plugin
// - discoverTools(): 发现工具
// - callPluginTool(): 调用工具
```

### 4.3 WorkflowNode 封装

```typescript
interface WorkflowNode {
  id: string;
  name: string;
  pluginId: string;           // 关联的 Plugin
  toolName: string;           // 使用的工具名
  inputSchema: StandardSchema;    // 规范化输入 Schema
  outputSchema: StandardSchema;   // 规范化输出 Schema
  inputMapping: Record<string, string>;   // 规范 → Plugin
  outputMapping: Record<string, string>;   // Plugin → 规范
}

// 功能：
// - createNode(): 创建节点
// - execute(): 执行节点（包含 I/O 转换）
// - validateInput(): 验证输入
```

### 4.4 Workflow 编排

```typescript
interface Workflow {
  id: string;
  name: string;
  nodeIds: string[];
  edges: WorkflowEdge[];
  status: 'draft' | 'active' | 'archived';
}

// 功能：
// - createWorkflow(): 创建工作流
// - addNode(): 添加节点
// - connect(): 连接节点
// - validate(): 验证工作流
// - execute(): 执行工作流（拓扑排序 + 串联执行）
```

---

## 五、IPC API

### 5.1 MCP 相关

| IPC 通道 | 说明 | 参数 |
|----------|------|------|
| `mcp:connect` | 连接 MCP Server | `McpServer` |
| `mcp:disconnect` | 断开连接 | `serverId: string` |
| `mcp:isConnected` | 检查连接状态 | `serverId: string` |
| `mcp:listTools` | 获取工具列表 | `serverId: string` |
| `mcp:callTool` | 调用工具 | `serverId, toolName, args` |

### 5.2 Plugin 相关

| IPC 通道 | 说明 | 参数 |
|----------|------|------|
| `plugin:create` | 创建 Plugin | `{ name, description, serverId, toolNames }` |
| `plugin:list` | 列出所有 Plugin | - |
| `plugin:get` | 获取 Plugin | `id: string` |
| `plugin:delete` | 删除 Plugin | `id: string` |

### 5.3 WorkflowNode 相关

| IPC 通道 | 说明 | 参数 |
|----------|------|------|
| `node:create` | 创建节点 | `CreateWorkflowNodeDTO` |
| `node:execute` | 执行节点 | `nodeId, input` |
| `node:list` | 列出所有节点 | - |
| `node:listByPlugin` | 按 Plugin 筛选 | `pluginId` |
| `node:update` | 更新节点 | `id, Partial<WorkflowNode>` |
| `node:delete` | 删除节点 | `id` |
| `node:validateInput` | 验证输入 | `nodeId, input` |

### 5.4 Workflow 相关

| IPC 通道 | 说明 | 参数 |
|----------|------|------|
| `workflow:create` | 创建工作流 | `{ name, description }` |
| `workflow:addNode` | 添加节点 | `workflowId, nodeId` |
| `workflow:removeNode` | 移除节点 | `workflowId, nodeId` |
| `workflow:connect` | 连接节点 | `workflowId, source, target, fields` |
| `workflow:disconnect` | 断开连接 | `workflowId, edgeId` |
| `workflow:validate` | 验证工作流 | `workflowId` |
| `workflow:execute` | 执行工作流 | `workflowId, input` |
| `workflow:list` | 列出工作流 | - |
| `workflow:get` | 获取工作流 | `id` |
| `workflow:delete` | 删除工作流 | `id` |
| `workflow:updateStatus` | 更新状态 | `id, status` |

---

## 六、使用示例

### 6.1 连接 GitHub MCP Server

```typescript
await mcpAdapter.connect({
  id: 'github',
  name: 'GitHub',
  type: 'stdio',
  command: 'docker',
  args: ['run', '-i', '--rm', '-e', 'GITHUB_PERSONAL_ACCESS_TOKEN=xxx',
         'ghcr.io/github/github-mcp-server'],
  env: {},
  enabled: true
});
```

### 6.2 获取工具列表

```typescript
const tools = await pluginService.discoverTools('github');
// 返回：[
//   { id: 'github:issue_read', name: 'issue_read', ... },
//   { id: 'github:issue_create', name: 'issue_create', ... },
//   ...
// ]
```

### 6.3 创建 WorkflowNode

```typescript
const node = await nodeService.createNode({
  name: '读取 Issue',
  pluginId: 'github',
  toolName: 'issue_read',
  inputSchema: {
    type: 'object',
    properties: {
      repository: { type: 'string' },
      issueId: { type: 'number' }
    },
    required: ['repository', 'issueId']
  },
  outputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      content: { type: 'string' },
      status: { type: 'string' }
    }
  },
  inputMapping: {
    repository: 'owner/repo',
    issueId: 'issue_number'
  },
  outputMapping: {
    title: 'title',
    body: 'content',
    state: 'status'
  }
});
```

### 6.4 创建并执行 Workflow

```typescript
// 创建工作流
const workflow = await workflowService.createWorkflow({
  name: 'Issue 汇总工作流',
  description: '汇总 GitHub Issue'
});

// 添加节点
workflowService.addNode(workflow.id, node);

// 连接节点
workflowService.connect(workflow.id, 'node1', 'output', 'node2', 'input');

// 验证
const validation = workflowService.validate(workflow.id);

// 执行
const result = await workflowService.execute(workflow.id, {
  repository: 'easy-agent',
  issueId: 123
});
```

---

## 七、架构流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                           用户层                                     │
│                    对话页面 / IPC 调用                               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         IPC Handlers                                │
│           workflow.handler.ts (mcp/plugin/node/workflow)             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Application Layer                             │
│                                                                     │
│  WorkflowService     WorkflowNodeService     PluginService           │
│         │                   │                    │                │
│         └───────────────────┴────────────────────┘                │
│                             │                                       │
└─────────────────────────────┼─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Domain Layer                                │
│                                                                     │
│     Workflow      WorkflowNode       Plugin       McpServer         │
│     Entity        Entity            Entity       Entity            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Adapter Layer                                │
│                         McpStdioAdapter                             │
│                    (MCP SDK + stdio transport)                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MCP Server                                  │
│                    (GitHub / 飞书 / Filesystem)                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 八、依赖

```json
{
  "@modelcontextprotocol/sdk": "^1.1.0"
}
```

已存在于 `package.json` 中。

---

## 九、后续扩展

- [ ] MCP SSE 连接器（HTTP 方式）
- [ ] Plugin 持久化到数据库
- [ ] Workflow 可视化编辑器
- [ ] 条件分支、并行执行
- [ ] 定时任务支持

---

## 十、版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-30 | 初始实现：MCP 接入、Plugin、WorkflowNode、Workflow |
