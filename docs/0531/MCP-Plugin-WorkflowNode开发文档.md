# MCP → Plugin → WorkflowNode → Workflow 开发文档

## 一、架构概述

```
┌─────────────────────────────────────────────────────────────────────┐
│                           用户层                                      │
│                    对话页面调用 Workflow                              │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Workflow 层                                  │
│                                                                     │
│  • 编排多个 WorkflowNode                                            │
│  • 管理节点间的数据流 Edge                                          │
│  • 执行整个工作流                                                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       WorkflowNode 层                                │
│                                                                     │
│  • 统一规范输入/输出 Schema                                         │
│  • 配置 inputMapping / outputMapping                                 │
│  • 调用内部 Plugin                                                  │
│  • 数据格式转换（规范 ↔ 原始）                                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Plugin 层                                    │
│                                                                     │
│  • 封装一个或多个 MCP Tool                                          │
│  • 管理 MCP Server 连接                                             │
│  • 提供统一的 call(toolName, input) 接口                             │
│  • 可被多个 WorkflowNode 复用                                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          MCP 层                                      │
│                                                                     │
│  • MCP Server（MCP 规范实现）                                        │
│  • 通过 stdio / HTTP 连接                                           │
│  • 提供 Tool List（自动发现）                                        │
│  • 具体功能：issue_read, issue_create 等                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、目录结构

```
electron/core/
│
├── domain/                          # 领域层
│   │
│   ├── entities/                    # 实体
│   │   ├── Conversation.ts
│   │   └── Message.ts
│   │
│   ├── plugins/                     # Plugin 相关
│   │   ├── Plugin.ts               # Plugin 接口定义
│   │   ├── McpPlugin.ts            # MCP Plugin 实现
│   │   ├── PluginRegistry.ts        # Plugin 注册表
│   │   └── types.ts                # Plugin 类型定义
│   │
│   ├── nodes/                       # WorkflowNode 相关
│   │   ├── WorkflowNode.ts         # WorkflowNode 接口与实现
│   │   ├── NodeRegistry.ts         # 节点注册表
│   │   └── types.ts                # 节点类型定义
│   │
│   └── workflows/                   # Workflow 相关
│       ├── Workflow.ts              # Workflow 接口与实现
│       ├── Edge.ts                  # 连接线定义
│       ├── executor/                # 执行器
│       │   ├── WorkflowExecutor.ts  # 工作流执行器
│       │   └── NodeExecutor.ts      # 节点执行器
│       └── types.ts                 # Workflow 类型定义
│
├── application/                     # 应用层
│   ├── AgentService.ts              # AI Agent 服务
│   ├── WorkflowService.ts           # 工作流编排服务
│   ├── PluginService.ts             # 插件管理服务
│   └── NodeService.ts               # 节点管理服务
│
├── ports/                           # 端口接口
│   ├── llm.port.ts
│   ├── storage.port.ts
│   └── mcp.port.ts                  # MCP 协议端口
│
└── adapters/                        # 适配器实现
    ├── llm/
    │   ├── openai.adapter.ts
    │   └── anthropic.adapter.ts
    ├── storage/
    │   └── sqlite.adapter.ts
    └── mcp/
        ├── stdio.adapter.ts          # stdio 连接适配器
        └── sse.adapter.ts           # HTTP/SSE 连接适配器
```

---

## 三、核心接口设计

### 3.1 MCP Tool（原始工具）

```typescript
// domain/plugins/types.ts

export interface McpTool {
  name: string           // 工具名：issue_read
  description: string    // 描述
  inputSchema: object    // MCP 原始输入 Schema
}

export interface McpServerConfig {
  id: string
  name: string
  type: 'stdio' | 'sse'
  command: string        // docker / node / npx
  args: string[]          // 参数列表
  env: Record<string, string>  // 环境变量
}
```

### 3.2 Plugin 接口

```typescript
// domain/plugins/Plugin.ts

export interface Plugin {
  readonly id: string                    // 唯一标识
  readonly name: string                  // 名称
  readonly description: string           // 描述
  readonly serverId: string             // 所属 MCP Server
  readonly tools: McpTool[]             // 封装的工具列表

  // 调用工具
  call(toolName: string, input: unknown): Promise<unknown>

  // 获取可用工具
  getTools(): McpTool[]

  // 获取工具 Schema
  getToolSchema(toolName: string): { input: object, output: object }

  // 断开连接
  disconnect(): Promise<void>
}
```

### 3.3 WorkflowNode 接口

```typescript
// domain/nodes/types.ts

export interface StandardSchema {
  type: 'object'
  properties: Record<string, {
    type: string
    description?: string
    required?: boolean
    default?: unknown
  }>
  required?: string[]
}

export interface WorkflowNode {
  readonly id: string                    // 唯一标识
  readonly name: string                  // 节点名称
  readonly description: string            // 描述

  // 规范后的 I/O Schema
  readonly inputSchema: StandardSchema   // 标准化输入
  readonly outputSchema: StandardSchema // 标准化输出

  // 数据映射
  readonly inputMapping: Record<string, string>    // 规范输入 → Plugin 输入
  readonly outputMapping: Record<string, string>    // Plugin 输出 → 规范输出

  // 关联的 Plugin
  readonly plugin: Plugin
  readonly toolName: string               // 使用的工具名

  // 执行
  execute(input: unknown): Promise<unknown>

  // 验证
  validateInput(input: unknown): boolean
}
```

### 3.4 Workflow 接口

```typescript
// domain/workflows/types.ts

export interface Edge {
  id: string
  sourceNodeId: string      // 源节点
  sourceField: string        // 源字段
  targetNodeId: string       // 目标节点
  targetField: string        // 目标字段
}

export interface Workflow {
  readonly id: string
  name: string
  description: string

  nodes: WorkflowNode[]
  edges: Edge[]

  // 操作
  addNode(node: WorkflowNode): void
  removeNode(nodeId: string): void
  connect(edge: Omit<Edge, 'id'>): void
  disconnect(edgeId: string): void

  // 验证
  validate(): ValidationResult

  // 执行
  execute(input: unknown): Promise<WorkflowResult>
}
```

---

## 四、模块详细设计

### 4.1 McpPlugin（MCP 封装）

```typescript
// domain/plugins/McpPlugin.ts

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { McpServerConfig, McpTool } from './types'

export class McpPlugin implements Plugin {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly serverId: string
  readonly tools: McpTool[]

  private client: Client | null = null
  private connected: boolean = false

  constructor(
    serverId: string,
    name: string,
    tools: McpTool[]
  ) {
    this.id = `plugin:${serverId}`
    this.serverId = serverId
    this.name = name
    this.description = `MCP Plugin for ${name}`
    this.tools = tools
  }

  // 连接 MCP Server
  async connect(config: McpServerConfig): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env
    })

    this.client = new Client({
      name: 'easy-agent',
      version: '1.0.0'
    })

    await this.client.connect(transport)
    this.connected = true
  }

  // 调用工具
  async call(toolName: string, input: unknown): Promise<unknown> {
    if (!this.client || !this.connected) {
      throw new Error('Plugin not connected')
    }

    const result = await this.client.callTool({
      name: toolName,
      arguments: input as Record<string, unknown>
    })

    return result
  }

  // 获取工具列表
  getTools(): McpTool[] {
    return this.tools
  }

  // 获取工具 Schema
  getToolSchema(toolName: string): { input: object, output: object } {
    const tool = this.tools.find(t => t.name === toolName)
    return {
      input: tool?.inputSchema || {},
      output: {}
    }
  }

  // 断开连接
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.connected = false
    }
  }
}
```

### 4.2 WorkflowNode（节点）

```typescript
// domain/nodes/WorkflowNode.ts

import { Plugin } from '../plugins/Plugin'
import { StandardSchema } from './types'

export class WorkflowNodeImpl implements WorkflowNode {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly inputSchema: StandardSchema
  readonly outputSchema: StandardSchema
  readonly inputMapping: Record<string, string>
  readonly outputMapping: Record<string, string>
  readonly plugin: Plugin
  readonly toolName: string

  constructor(config: {
    id: string
    name: string
    description?: string
    plugin: Plugin
    toolName: string
    inputSchema: StandardSchema
    outputSchema: StandardSchema
    inputMapping: Record<string, string>
    outputMapping: Record<string, string>
  }) {
    this.id = config.id
    this.name = config.name
    this.description = config.description || ''
    this.plugin = config.plugin
    this.toolName = config.toolName
    this.inputSchema = config.inputSchema
    this.outputSchema = config.outputSchema
    this.inputMapping = config.inputMapping
    this.outputMapping = config.outputMapping
  }

  // 执行节点
  async execute(input: unknown): Promise<unknown> {
    // 1. 验证输入
    if (!this.validateInput(input)) {
      throw new Error(`Invalid input for node ${this.id}`)
    }

    // 2. 转换输入（规范 → Plugin 原始格式）
    const rawInput = this.transformInput(input)

    // 3. 调用 Plugin
    const rawOutput = await this.plugin.call(this.toolName, rawInput)

    // 4. 转换输出（Plugin 原始格式 → 规范格式）
    return this.transformOutput(rawOutput)
  }

  // 转换输入
  private transformInput(input: unknown): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    const inputObj = input as Record<string, unknown>

    for (const [nodeField, pluginField] of Object.entries(this.inputMapping)) {
      result[pluginField] = inputObj[nodeField]
    }

    return result
  }

  // 转换输出
  private transformOutput(output: unknown): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    const outputObj = output as Record<string, unknown>

    for (const [pluginField, nodeField] of Object.entries(this.outputMapping)) {
      result[nodeField] = outputObj[pluginField]
    }

    return result
  }

  // 验证输入
  validateInput(input: unknown): boolean {
    // TODO: 实现 Schema 验证
    return true
  }
}
```

### 4.3 Workflow（工作流）

```typescript
// domain/workflows/Workflow.ts

import { WorkflowNode } from '../nodes/WorkflowNode'
import { Edge, ValidationResult, WorkflowResult } from './types'

export class WorkflowImpl implements Workflow {
  readonly id: string
  name: string
  description: string
  nodes: WorkflowNode[] = []
  edges: Edge[] = []

  constructor(id: string, name: string, description?: string) {
    this.id = id
    this.name = name
    this.description = description || ''
  }

  addNode(node: WorkflowNode): void {
    this.nodes.push(node)
  }

  removeNode(nodeId: string): void {
    this.nodes = this.nodes.filter(n => n.id !== nodeId)
    this.edges = this.edges.filter(
      e => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
    )
  }

  connect(edge: Omit<Edge, 'id'>): void {
    const newEdge: Edge = {
      ...edge,
      id: `edge:${Date.now()}`
    }
    this.edges.push(newEdge)
  }

  disconnect(edgeId: string): void {
    this.edges = this.edges.filter(e => e.id !== edgeId)
  }

  // 验证工作流
  validate(): ValidationResult {
    const errors: string[] = []

    // 1. 检查节点是否存在
    for (const edge of this.edges) {
      const sourceExists = this.nodes.some(n => n.id === edge.sourceNodeId)
      const targetExists = this.nodes.some(n => n.id === edge.targetNodeId)

      if (!sourceExists) {
        errors.push(`Source node ${edge.sourceNodeId} not found`)
      }
      if (!targetExists) {
        errors.push(`Target node ${edge.targetNodeId} not found`)
      }
    }

    // 2. 检查类型兼容性
    // TODO: 实现类型检查

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // 执行工作流
  async execute(input: unknown): Promise<WorkflowResult> {
    // 1. 验证
    const validation = this.validate()
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      }
    }

    // 2. 拓扑排序
    const executionOrder = this.topologicalSort()

    // 3. 依次执行节点
    const context: Record<string, unknown> = {}
    context['__input__'] = input

    for (const node of executionOrder) {
      // 获取输入
      const nodeInput = this.getNodeInput(node.id, context)

      // 执行
      const nodeOutput = await node.execute(nodeInput)

      // 存储输出
      context[node.id] = nodeOutput
    }

    // 4. 返回最终结果
    const lastNode = executionOrder[executionOrder.length - 1]

    return {
      success: true,
      output: context[lastNode.id],
      nodeResults: context
    }
  }

  // 拓扑排序（确定执行顺序）
  private topologicalSort(): WorkflowNode[] {
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()

    // 初始化
    for (const node of this.nodes) {
      inDegree.set(node.id, 0)
      adjacency.set(node.id, [])
    }

    // 构建图
    for (const edge of this.edges) {
      adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId)
      inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) || 0) + 1)
    }

    // Kahn 算法
    const queue: string[] = []
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId)
    }

    const result: WorkflowNode[] = []
    while (queue.length > 0) {
      const nodeId = queue.shift()!
      const node = this.nodes.find(n => n.id === nodeId)
      if (node) result.push(node)

      for (const neighbor of adjacency.get(nodeId) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1)
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor)
        }
      }
    }

    return result
  }

  // 获取节点输入（从上下文和边连接中获取）
  private getNodeInput(nodeId: string, context: Record<string, unknown>): unknown {
    const inputEdges = this.edges.filter(e => e.targetNodeId === nodeId)

    if (inputEdges.length === 0) {
      return context['__input__']
    }

    // 合并所有输入
    const input: Record<string, unknown> = {}
    for (const edge of inputEdges) {
      const sourceOutput = context[edge.sourceNodeId] as Record<string, unknown>
      input[edge.targetField] = sourceOutput[edge.sourceField]
    }

    return input
  }
}
```

---

## 五、使用流程

### 5.1 配置 MCP Server

```
用户输入 MCP 配置（如 GitHub MCP）：

{
  "id": "github",
  "name": "GitHub",
  "type": "stdio",
  "command": "docker",
  "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN=xxx", "ghcr.io/github/github-mcp-server"]
}
```

### 5.2 发现并选择工具

```
1. 连接 MCP Server
2. 获取 Tool List：
   - issue_read
   - issue_create
   - pull_request_read
   - ...
3. 用户选择需要的工具，封装成 Plugin
```

### 5.3 创建 WorkflowNode

```
1. 选择 Plugin 中的一个 Tool
2. 配置规范化的 inputSchema / outputSchema
3. 配置 inputMapping / outputMapping
4. 保存为 WorkflowNode
```

### 5.4 编排 Workflow

```
1. 添加 WorkflowNode
2. 连接节点（Edge）
3. 验证 Workflow
4. 保存
```

### 5.5 执行 Workflow

```
用户：帮我汇总 easy-agent 仓库的 Issue 发到飞书
      ↓
AI 选择 Workflow
      ↓
执行 Workflow
      ↓
返回结果
```

---

## 六、MVP 功能范围

### 第一阶段（MVP）

| 模块 | 功能 |
|------|------|
| **McpPlugin** | 连接 stdio MCP Server、调用工具、断开连接 |
| **WorkflowNode** | 基础执行、输入输出映射 |
| **Workflow** | 串联执行、拓扑排序、简单验证 |
| **UI** | MCP Server 配置、工具选择、节点配置、Workflow 列表 |

### 第二阶段

| 模块 | 功能 |
|------|------|
| **Workflow** | 条件分支、并行执行、循环 |
| **Plugin** | MCP Server 管理、连接状态 |
| **UI** | 可视化画布、拖拽编排 |

---

## 七、技术依赖

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

---

## 八、后续扩展

### 8.1 Plugin 注册表

```typescript
// 统一管理所有 Plugin
class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map()

  register(plugin: Plugin): void
  get(id: string): Plugin | undefined
  list(): Plugin[]
  unregister(id: string): void
}
```

### 8.2 Node 注册表

```typescript
// 统一管理所有 WorkflowNode
class NodeRegistry {
  private nodes: Map<string, WorkflowNode> = new Map()

  register(node: WorkflowNode): void
  get(id: string): WorkflowNode | undefined
  list(): WorkflowNode[]
  listByPlugin(pluginId: string): WorkflowNode[]
}
```

### 8.3 存储

```typescript
// 持久化 Workflow
interface WorkflowStorage {
  save(workflow: Workflow): Promise<void>
  load(id: string): Promise<Workflow>
  list(): Promise<WorkflowSummary[]>
  delete(id: string): Promise<void>
}
```

---

## 九、总结

```
┌─────────────────────────────────────────────────────────────────────┐
│                           核心流程                                    │
│                                                                     │
│  MCP Server（配置）                                                  │
│        │                                                             │
│        ▼                                                             │
│  McpPlugin（封装工具）                                               │
│        │                                                             │
│        ▼                                                             │
│  WorkflowNode（规范 I/O）                                            │
│        │                                                             │
│        ▼                                                             │
│  Workflow（编排执行）                                                │
│        │                                                             │
│        ▼                                                             │
│  对话调用                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-30 | 初始文档 |
