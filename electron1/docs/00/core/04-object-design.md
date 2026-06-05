# 04. 对象设计（面向对象实现）

> 版本: v0.2.0 MVP
> 日期: 2026-05-26
> 前置: 你理解领域模型 = 对象自己定义自己的行为

---

## 1. 核心原则

```
贫血对象 vs 领域模型

贫血对象：只有数据，没有行为
  class Workflow {
    id: string;
    name: string;
    nodes: any[];
    // ❌ 没有行为，验证逻辑散落在 Service 里
  }

领域模型：数据 + 行为打包在一起
  class Workflow {
    id: string;
    name: string;
    nodes: any[];

    validate(): ValidationResult     // ✅ 对象知道怎么验证自己
    getExecutionOrder(): Node[]       // ✅ 对象知道怎么执行自己
    addNode(type, pos): WorkflowNode // ✅ 对象知道怎么添加节点
  }
```

---

## 2. 实体 vs 值对象

| | 实体（Entity） | 值对象（Value Object） |
|--|--------------|---------------------|
| **标识** | 有唯一标识（id） | 无标识 |
| **相等性** | id 相同 = 同一对象 | 属性相同 = 同一对象 |
| **可变性** | 可变（有 setter） | 通常不可变 |
| **实现方式** | class | interface 或 readonly class |
| **示例** | Workflow, Conversation, Prompt | Message, McpServer, McpTool |

### 实体（用 class）

```
Workflow、Conversation、Prompt

设计要点：
├── 私有属性（防止外部直接修改）
├── 构造函数（私有，通过工厂方法创建）
├── 行为方法（validate、addNode、rename 等）
├── 访问器（getter，返回只读副本）
└── 工厂方法（static create）
```

### 值对象（用 interface）

```
Message、McpServer、McpTool、ApiKey、WorkflowNode、WorkflowEdge

设计要点：
├── 只描述数据结构
├── 无业务行为
├── 可以直接作为函数参数传递
└── 不需要 class 包装
```

---

## 3. Workflow 对象（最复杂的领域模型）

### 3.1 设计思路

```
Workflow 需要思考的问题：

用户操作 workflow：
  - 添加节点 / 删除节点 / 修改节点
  - 连接节点（添加边）/ 删除边

workflow 自己知道：
  - 结构是否有效（验证规则）
  - 执行顺序是什么（拓扑排序）
  - 是否有循环（死循环检测）
```

### 3.2 数据设计

```
私有属性（用 private 修饰）
├── id: string                   # 只读，构造函数设置
├── name: string                 # 可写，通过 rename() 修改
├── description?: string         # 可写
├── _nodes: WorkflowNode[]       # 私有，通过 addNode/removeNode 修改
├── _edges: WorkflowEdge[]       # 私有，通过 addEdge/removeEdge 修改
├── status: WorkflowStatus       # 可写
├── createdAt: string            # 只读
└── updatedAt: string            # 每次修改时自动更新

为什么用私有属性：
  防止外部直接操作 _nodes.push(...) 或 _nodes = []
  外部只能通过定义好的方法操作，保证数据一致性
```

### 3.3 构造函数设计

```
构造函数（私有，用 # 或 private）
├── 参数：dto: CreateWorkflowDTO & { id? }
├── 行为：
│   ├── 生成或使用提供的 id
│   ├── 初始化空 _nodes 和 _edges
│   ├── 设置 status = 'idle'
│   └── 设置时间戳
│
└── 为什么私有：
    强制使用工厂方法 Workflow.create(dto) 创建
    保证所有 Workflow 都经过验证流程
```

### 3.4 节点管理行为

```
addNode(type, position, label?)
├── 行为：
│   ├── 创建 WorkflowNode（生成 id，设置 type、label、position、空白 config）
│   ├── 追加到 _nodes
│   └── 更新 updatedAt
├── 返回：新建的 WorkflowNode
└── 边界情况：
    ├── label 为空时使用默认标签
    └── position 为空时使用 { x: 0, y: 0 }

removeNode(nodeId)
├── 行为：
│   ├── 从 _nodes 过滤掉该节点
│   ├── 从 _edges 过滤掉所有与该节点相连的边（级联删除）
│   └── 更新 updatedAt
└── 边界情况：节点不存在时什么都不做

updateNode(nodeId, updates)
├── 行为：
│   ├── 查找节点
│   ├── 合并 updates 到节点
│   └── 更新 updatedAt
└── 边界情况：节点不存在时抛出错误
```

### 3.5 边管理行为

```
addEdge(source, target, label?)
├── 行为：
│   ├── 验证 source 节点存在（不存在则抛错）
│   ├── 验证 target 节点存在（不存在则抛错）
│   ├── 验证边不重复（已存在则抛错）
│   ├── 创建 WorkflowEdge（生成 id，设置 source、target、label）
│   ├── 追加到 _edges
│   └── 更新 updatedAt
└── 边界情况：
    ├── source 不存在：抛出"源节点不存在"
    ├── target 不存在：抛出"目标节点不存在"
    └── 边已存在：抛出"该边已存在"

removeEdge(edgeId)
├── 行为：
│   ├── 从 _edges 过滤掉该边
│   └── 更新 updatedAt
└── 边界情况：边不存在时什么都不做
```

### 3.6 验证行为（核心业务逻辑）

```
validate() → ValidationResult

验证规则：
├── 规则 1：至少一个节点
│   └── _nodes.length > 0
│
├── 规则 2：至少一个 LLM 节点
│   └── _nodes.some(n => n.type === 'llm')
│
├── 规则 3：节点连通性
│   ├── input 类型节点：可以没有入边
│   ├── output 类型节点：可以没有出边
│   └── 其他类型节点：必须有入边和出边
│
├── 规则 4：边引用的节点必须存在
│   └── 所有 _edges.source 和 _edges.target 都在 _nodes 中
│
└── 规则 5：无循环引用
    └── hasCycle() === false

hasCycle() → boolean
├── 算法：DFS（有向图环检测）
├── 数据结构：
│   ├── visited: Set<string>    # 已完全访问的节点
│   └── recStack: Set<string>  # 当前递归路径上的节点
├── 逻辑：
│   ├── 从每个未访问节点开始 DFS
│   ├── 访问时加入 recStack
│   ├── 遇到已在 recStack 的节点 → 发现环
│   └── 访问完毕移出 recStack
└── 返回：是否存在环

getExecutionOrder() → WorkflowNode[]
├── 算法：拓扑排序（从末端反向）
├── 数据结构：result 数组（存储排序结果）
├── 逻辑：
│   ├── visit(nodeId)
│   │   ├── 已访问：返回
│   │   ├── 在递归栈中：抛错（检测到环）
│   │   ├── 加入递归栈
│   │   ├── 递归访问所有指向此节点的节点（反向拓扑）
│   │   ├── 移出递归栈
│   │   ├── 标记为已访问
│   │   └── 将节点加入 result
│   └── 对所有节点执行 visit
└── 返回：result（逆序即为执行顺序）
```

### 3.7 访问器设计

```
为什么需要 getter：
  _nodes 是私有数组，如果直接返回，外部可以 push / splice
  需要返回只读副本

get nodes() → ReadonlyArray<WorkflowNode>
└── return [...this._nodes]

get edges() → ReadonlyArray<WorkflowEdge>
└── return [...this._edges]

为什么用 ReadonlyArray：
  语义更清晰，告诉调用者这是只读的
  TypeScript 会阻止 push / splice / sort 等操作
```

---

## 4. Conversation 对象

```
私有属性
├── id: string
├── name: string
├── workflowId?: string
├── createdAt: string
├── updatedAt: string
└── _messages: Message[]（私有）

构造函数（私有）
├── 参数：dto: CreateConversationDTO & { id?, workflowId? }
└── 默认名称：'新对话'

行为方法：
├── addMessage(role, content, model?)
│   ├── 创建新 Message（生成 id）
│   ├── 追加到 _messages
│   ├── 更新时间戳
│   └── 返回 Message
│
├── rename(newName)
│   ├── 验证名称非空
│   ├── 更新 name
│   └── 更新时间戳
│
├── getMessages()
│   └── 返回 _messages 只读副本
│
├── validate()
│   ├── 检查名称非空
│   └── 返回 ValidationResult
│
└── 工厂方法
    └── static create(dto?) → new Conversation(dto)

为什么 Conversation 不需要循环检测：
  Conversation 是线性消息列表，没有分支和循环
  只有 Workflow 才有图的拓扑结构，需要检测环
```

---

## 5. Prompt 对象

```
私有属性
├── id: string
├── name: string
├── description?: string
├── systemPrompt: string
├── isBuiltin: boolean（只读）
├── createdAt: string（只读）
└── updatedAt: string

构造函数（私有）
├── 参数：dto: CreatePromptDTO & { id?, isBuiltin? }
└── 默认 isBuiltin = false

行为方法：
├── update(updates)
│   ├── 检查 isBuiltin，builtin 则抛错
│   ├── 更新提供的字段
│   └── 更新时间戳
│
├── validate()
│   ├── 检查名称非空
│   ├── 检查 systemPrompt 非空
│   ├── 检查 systemPrompt 长度 ≤ 10000
│   └── 返回 ValidationResult
│
├── canDelete()
│   └── return !this.isBuiltin
│
└── 工厂方法
    └── static create(dto) → new Prompt(dto)

isBuiltin 的保护逻辑：
  if (this.isBuiltin) throw new Error('内置模板不能修改')
  这个检查在 update() 里，是领域模型自我保护的能力
```

---

## 6. 继承和抽象的使用

### 什么时候用 class，什么时候用 interface？

```
值对象（无行为）→ interface
  → Message、McpServer、McpTool、ApiKey
  → 直接定义数据结构，不需要 class

实体（有行为）    → class
  → Workflow、Conversation、Prompt
  → 需要方法验证、操作、保护
```

### 为什么不使用继承？

```
❌ 错误做法：创建基类，然后继承
  class Node { id, position, ... }
  class LLMNode extends Node { model, temperature, ... }
  class MCPToolNode extends Node { serverId, toolName, ... }

原因：
  1. 节点类型是固定的（就 5 种），不需要运行时动态增加
  2. 继承层次过深会导致代码复杂
  3. 类型标签 + config 比继承更灵活

✅ 正确做法：type 标签 + config
  interface WorkflowNode {
    type: 'input' | 'llm' | 'mcp_tool' | 'output' | 'condition'
    config: NodeConfig
  }

  // 不同类型通过 config 区分
  // addNode('llm') 创建 LLM 节点
  // addNode('mcp_tool') 创建 MCP 工具节点
```

---

## 7. 总结：面向对象设计的 checklist

```
✅ 实体用 class，值对象用 interface
✅ 数据用 private，通过 getter 暴露只读副本
✅ 行为写在对象里，不写在 Service 里
✅ 用工厂方法替代 new 关键字
✅ 私有方法用 private 修饰
✅ ValidationResult 作为方法的返回值类型
✅ 循环检测、死循环检测等业务规则放在领域模型里
✅ get nodes() / get edges() 返回 ReadonlyArray 副本
```

---

*文档版本: v0.2.0 | 最后更新: 2026-05-26*
