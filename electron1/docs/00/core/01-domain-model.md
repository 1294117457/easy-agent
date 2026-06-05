# 01. 领域模型实现

> 版本: v0.2.0 MVP
> 日期: 2026-05-26
> 前置: 你理解领域模型 = 对象自己定义自己的行为

---

## 1. 什么是领域模型

领域模型是**纯业务概念**，代表 EasyAgent 的核心业务实体。它有三条铁律：

| 铁律 | 含义 |
|------|------|
| **无外部依赖** | 不 import 数据库、不 import SDK、不 import Electron |
| **行为内置** | 对象自己定义自己的验证、执行、保护规则 |
| **只放核心业务** | 持久化放 Adapter，工作流放 Adapter，领域模型只管业务 |

---

## 2. EasyAgent 的领域对象

```
Conversation（对话）
    ├── 知道自己怎么添加消息
    ├── 知道自己怎么重命名
    └── 知道自己怎么验证

Workflow（工作流）
    ├── 知道自己怎么验证（节点是否完整、边是否连通）
    ├── 知道自己怎么执行（拓扑排序获取执行顺序）
    ├── 知道自己怎么添加节点
    └── 知道自己怎么检测循环

Message（消息）
    ├── 知道自己属于哪个对话
    └── 知道自己是什么角色（user/assistant/system）

Prompt（提示词模板）
    ├── 知道自己能不能被删除（内置模板不能删）
    └── 知道自己怎么验证

McpServer（MCP 服务器）
    ├── 知道自己用什么协议连接（stdio / sse）
    └── 知道自己是否可用

McpTool（MCP 工具）
    └── 知道自己属于哪个服务器
```

---

## 3. 目录结构

```
electron/core/domain/
├── types.ts           # 所有领域类型定义（interface + type）
├── Conversation.ts   # Conversation 实体 + 行为
├── Workflow.ts       # Workflow 实体 + 行为（最核心）
├── Prompt.ts        # Prompt 实体 + 行为
└── index.ts         # 统一导出
```

---

## 4. types.ts — 所有领域类型

```
types.ts
├── 枚举类型
│   ├── NodeType         = 'input' | 'llm' | 'mcp_tool' | 'output' | 'condition'
│   ├── WorkflowStatus   = 'idle' | 'running' | 'paused' | 'completed' | 'failed'
│   ├── AgentStatus     = 'idle' | 'thinking' | 'working' | 'happy' | 'error'
│   └── MessageRole     = 'user' | 'assistant' | 'system'
│
├── 基础类型
│   └── Position        { x: number; y: number }
│
├── 领域接口（值对象，无行为）
│   ├── WorkflowNode    { id, type, label, position, config }
│   ├── WorkflowEdge    { id, source, target, label }
│   ├── Message         { id, conversationId, role, content, model, createdAt }
│   ├── McpServer       { id, name, type, command?, url?, enabled }
│   ├── McpTool         { id, serverId, name, description, inputSchema, enabled }
│   └── ApiKey          { id, provider, model, enabled }
│
├── 实体接口（用于序列化，行为放在 class 里）
│   ├── Workflow        { id, name, description?, nodes, edges, status, createdAt, updatedAt }
│   ├── Conversation    { id, name, workflowId?, createdAt, updatedAt }
│   └── Prompt          { id, name, description?, systemPrompt, isBuiltin, createdAt, updatedAt }
│
└── DTO（数据传输对象）
    ├── CreateWorkflowDTO      { name, description?, nodes, edges }
    ├── CreateConversationDTO  { name? }
    ├── AppendMessageDTO      { conversationId, role, content, model? }
    ├── CreatePromptDTO       { name, description?, systemPrompt, isBuiltin? }
    ├── CreateApiKeyDTO       { provider, key, model }
    └── ValidationResult       { valid: boolean; error?: string }
```

### 类型定义要点

```typescript
// 值对象用 interface，直接描述数据结构
export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  model?: string;
  createdAt: string;
}

// 实体在 interface 里只描述数据结构，行为放在 class 里
// （interface 不能放方法）
export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: WorkflowStatus;
  // ...
}
```

---

## 5. Conversation.ts — 对话实体

### 数据（私有）

```
Conversation 私有属性
├── id: string           # 唯一标识
├── name: string        # 对话名称
├── workflowId?: string  # 关联的工作流
├── createdAt: string   # 创建时间
├── updatedAt: string   # 更新时间
└── _messages: Message[] # 私有：消息列表
```

### 构造函数

```
构造函数
├── 参数：dto: CreateConversationDTO & { id?, workflowId? }
├── 行为：
│   ├── 生成 uuid 作为 id（如果未提供）
│   ├── 设置默认名称为"新对话"
│   └── 设置 createdAt = updatedAt = 当前时间
└── 工厂方法：static create(dto) → new Conversation(dto)
```

### 行为方法

```
addMessage(role, content, model?)
├── 创建新 Message（生成 id，设置 conversationId）
├── 追加到 _messages 列表
├── 更新时间戳
└── 返回新 Message

rename(newName)
├── 验证名称不能为空
├── 更新 name
└── 更新时间戳

getMessages()
├── 返回 _messages 的只读副本（防止外部修改）
└── 返回类型：ReadonlyArray<Message>

validate()
├── 检查名称是否为空
└── 返回 ValidationResult
```

---

## 6. Workflow.ts — 工作流实体（最核心）

### 数据（私有）

```
Workflow 私有属性
├── id: string
├── name: string
├── description?: string
├── _nodes: WorkflowNode[]   # 私有：节点列表
├── _edges: WorkflowEdge[]   # 私有：边列表
├── status: WorkflowStatus   # idle | running | paused | completed | failed
├── createdAt: string
└── updatedAt: string
```

### 构造函数

```
构造函数
├── 参数：dto: CreateWorkflowDTO & { id? }
├── 行为：
│   ├── 生成 uuid
│   ├── 初始化空节点列表
│   ├── 初始化空边列表
│   └── 设置 status = 'idle'
└── 工厂方法：static create(dto) → new Workflow(dto)
```

### 节点管理行为

```
addNode(type, position, label?)
├── 根据 type 生成默认 label（'输入' / '大模型' / 'MCP 工具' / '输出' / '条件'）
├── 创建新 WorkflowNode（生成 id，设置 type, label, position, 空 config）
├── 追加到 _nodes 列表
├── 更新时间戳
└── 返回新节点

removeNode(nodeId)
├── 从 _nodes 过滤掉该节点
├── 同时删除所有与该节点相连的边
└── 更新时间戳

updateNode(nodeId, updates)
├── 查找对应节点
├── 合并更新（只更新提供的字段）
└── 更新时间戳
```

### 边管理行为

```
addEdge(source, target, label?)
├── 验证 source 节点存在
├── 验证 target 节点存在
├── 验证边不重复
├── 创建新 WorkflowEdge（生成 id，设置 source, target, label）
├── 追加到 _edges 列表
└── 更新时间戳

removeEdge(edgeId)
├── 从 _edges 过滤掉该边
└── 更新时间戳
```

### 验证行为（核心业务逻辑）

```
validate() → ValidationResult
├── 规则 1：至少有一个节点
├── 规则 2：至少有一个 LLM 节点
├── 规则 3：每个节点必须有入边（input 除外）和出边（output 除外）
├── 规则 4：所有边引用的节点必须存在
└── 规则 5：不能有循环引用（调用 hasCycle）

hasCycle() → boolean
├── 使用 DFS 检测有向环
├── visited 集合记录已访问节点
├── recStack 集合记录当前递归路径
└── 返回是否存在环
```

### 执行顺序行为

```
getExecutionOrder() → WorkflowNode[]
├── 使用拓扑排序
├── 从末端节点反向遍历
├── 返回节点执行顺序列表
└── 如果检测到环，抛出错误
```

### 访问器

```
get nodes() → ReadonlyArray<WorkflowNode>
├── 返回 _nodes 的只读副本
└── 防止外部直接修改节点列表

get edges() → ReadonlyArray<WorkflowEdge>
├── 返回 _edges 的只读副本
└── 防止外部直接修改边列表
```

---

## 7. Prompt.ts — 提示词模板实体

### 数据（私有）

```
Prompt 私有属性
├── id: string
├── name: string
├── description?: string
├── systemPrompt: string  # 核心内容
├── isBuiltin: boolean    # 是否内置（内置不可修改/删除）
├── createdAt: string
└── updatedAt: string
```

### 构造函数

```
构造函数
├── 参数：dto: CreatePromptDTO & { id?, isBuiltin? }
├── 行为：
│   ├── 生成 uuid
│   ├── 设置默认 isBuiltin = false
│   └── 设置时间戳
└── 工厂方法：static create(dto) → new Prompt(dto)
```

### 行为方法

```
update(updates)
├── 检查 isBuiltin，如果为 true 抛出错误"内置模板不能修改"
├── 只更新提供的字段（name / description / systemPrompt）
└── 更新时间戳

validate()
├── 检查名称不为空
├── 检查 systemPrompt 不为空
├── 检查 systemPrompt 不超过 10000 字符
└── 返回 ValidationResult

canDelete()
├── 检查 isBuiltin
└── 返回：true if not builtin, false if builtin
```

---

## 8. index.ts — 统一导出

```
index.ts
├── 导出所有类型 from './types.js'
├── 导出 Conversation class
├── 导出 Workflow class
└── 导出 Prompt class
```

---

## 9. 领域模型 vs 其他层的边界

```
domain/              — 只有业务概念，不碰外部世界
  ├── Workflow.ts      ✅ 工作流验证逻辑（循环检测、节点完整性）
  ├── Conversation.ts  ✅ 对话重命名、添加消息
  └── Prompt.ts       ✅ 模板更新权限检查

ports/               — 定义"需要什么能力"，不实现
adapters/            — 实现"具体怎么做"（HTTP / stdio / SQLite）
application/         — 组合 ports，不写业务规则
ipc/                 — 接收外部请求，调用 application
main.ts              — Electron 启动，不写业务逻辑
```

---

## 10. 记住三条铁律

```
铁律 1：domain/ 里永远不写 import 'electron'
铁律 2：domain/ 里永远不写 import 'better-sqlite3'
铁律 3：domain/ 里的行为必须是纯业务逻辑（验证、执行、保护）

如果发现领域模型需要数据库     → 应该把这个行为放到 Application 层
如果发现领域模型需要调用 LLM   → 应该把这个行为放到 Application 层
如果发现领域模型需要调用 MCP    → 应该把这个行为放到 Application 层
```

---

## 11. 文件清单

| 文件 | 类型 | 职责 |
|------|------|------|
| `types.ts` | 类型定义 | 所有 interface / type / enum |
| `Conversation.ts` | 实体 class | 对话：重命名、添加消息、验证 |
| `Workflow.ts` | 实体 class | 工作流：节点/边管理、验证、执行顺序、循环检测 |
| `Prompt.ts` | 实体 class | 模板：更新、验证、删除权限 |
| `index.ts` | 导出 | 统一导出所有类型和 class |

---

*文档版本: v0.2.0 | 最后更新: 2026-05-26*
