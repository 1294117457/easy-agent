# EasyAgent 系统架构设计文档

> 版本: v0.1.0
> 日期: 2026-05-25

---

## 1. 整体架构

### 1.1 架构概览

EasyAgent 采用 monorepo 前后端分离架构：

- **前端**：Vue 3 + TypeScript 单页应用（SPA）
- **后端**：Node.js + Express + TypeScript，以 `@langchain/langgraph` 为核心的 Agent 编排引擎
- **通信**：HTTP REST API + WebSocket（流式输出）
- **存储**：SQLite（本地）+ 加密存储

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户端                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Vue 3 前端                             │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │   │
│  │  │ 侧边栏   │ │ Agent   │ │ 编排    │ │ 设置页面     │   │   │
│  │  │ Sidebar │ │ Pet     │ │ 画布    │ │             │   │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └──────┬──────┘   │   │
│  └───────┼───────────┼───────────┼─────────────┼────────────┘   │
└──────────┼───────────┼───────────┼─────────────┼────────────────┘
           │           │           │             │
           │ HTTP / WebSocket        │             │
┌──────────▼───────────▼───────────▼─────────────▼────────────────┐
│                    Node.js + Express 后端                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   API Routes (REST)                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │   │
│  │  │ /api/keys│  │ /api/mcp │  │/api/wf   │  │/ws/exec│  │   │
│  │  └─────┬────┘  └────┬─────┘  └─────┬─────┘  └───┬────┘  │   │
│  └────────┼────────────┼─────────────┼─────────────┼────────┘   │
│  ┌────────▼────────────▼─────────────▼─────────────▼─────────┐ │
│  │                   Service Layer                            │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐   │ │
│  │  │AgentCore│  │ MCP     │  │Workflow │  │  Storage   │   │ │
│  │  │Service  │  │Client   │  │Executor │  │  Service   │   │ │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └─────┬──────┘   │ │
│  └───────┼────────────┼─────────────┼─────────────┼──────────┘ │
│  ┌───────▼─────────────▼─────────────▼─────────────▼──────────┐ │
│  │              LangGraph JS 编排内核                          │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  Graph: State + Nodes + Edges                      │  │ │
│  │  │  Nodes: LLM / MCP Tool / Input / Output            │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
           │                                        │
           │ MCP Protocol                          │
           ▼                                        ▼
┌──────────────────────┐            ┌──────────────────────────┐
│   MCP Server A       │            │    MCP Server B          │
│   (本地/远程)         │            │    (本地/远程)            │
│   - 健身数据采集      │            │    - 地图查询             │
│   - 教程/动作库        │            │    - 天气预报            │
└──────────────────────┘            └──────────────────────────┘
           │                                        │
           └──────────────┬─────────────────────────┘
                          ▼
                 ┌─────────────────┐
                 │   大模型 API     │
                 │ (OpenAI/Claude/ │
                 │  Gemini/…)      │
                 └─────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │   SQLite 本地    │
                 │   数据库         │
                 │  (配置/流程/Key) │
                 └─────────────────┘
```

### 1.2 架构分层

```
┌────────────────────────────────────────────────┐
│           Presentation Layer (前端)             │
│   Vue 3 + TypeScript + Pinia + Vue Flow        │
├────────────────────────────────────────────────┤
│           API Gateway (后端)                    │
│   Express + TypeScript + CORS + WebSocket      │
├────────────────────────────────────────────────┤
│           Business Logic Layer                  │
│   AgentService / MCPClient / WorkflowExecutor  │
├────────────────────────────────────────────────┤
│           Core Engine Layer                     │
│   @langchain/langgraph + @langchain/core       │
├────────────────────────────────────────────────┤
│           Integration Layer                     │
│   @modelcontextprotocol/sdk / LLM / Storage   │
├────────────────────────────────────────────────┤
│           Data Layer                           │
│   better-sqlite3 + AES-256-GCM 加密存储        │
└────────────────────────────────────────────────┘
```

---

## 2. 核心模块设计

### 2.1 AgentCore 服务（LangGraph JS 内核）

AgentCore 是整个系统的核心编排引擎，基于 `@langchain/langgraph` 实现。

LangGraph JS 的核心概念与 Python 版一致：
- **State** — 贯穿整个图执行的状态对象
- **Node** — 图中的计算节点
- **Edge** — 节点之间的连接
- **ConditionalEdge** — 基于条件的动态路由

**LangGraph 图结构**：

```typescript
// types/agent-state.ts
import type { BaseMessage } from '@langchain/core/messages';

export interface AgentState {
  messages: BaseMessage[];
  nextStep: string;
  context: Record<string, unknown>;
  toolsResults: Record<string, unknown>;
  currentToolArgs: Record<string, unknown>;
}

// graph/nodes/llm-router.ts
export async function llmRouterNode(state: AgentState): Promise<Partial<AgentState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const llm = getLlmFromConfig(state.context.activeModel as string);

  const response = await llm.invoke([
    ...state.messages,
    SystemMessage.from(`你是 EasyAgent 的核心路由器。
根据用户输入，决定是直接回复还是调用工具。
如果需要调用工具，返回格式：TOOL:tool_name:args_json
如果直接回复，直接输出内容。`),
  ]);

  const content = typeof response === 'string' ? response : response.content as string;

  if (content.startsWith('TOOL:')) {
    const [, toolName, argsJson] = content.split(':');
    return {
      nextStep: toolName,
      currentToolArgs: JSON.parse(argsJson || '{}'),
    };
  }

  return {
    nextStep: 'RESPOND',
    context: { ...state.context, finalResponse: content },
  };
}

// graph/nodes/tool-executor.ts
export async function toolExecutorNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const { nextStep: toolName, currentToolArgs } = state;
  const mcpClient = getMcpClient();

  const result = await mcpClient.callTool(toolName, currentToolArgs);

  return {
    toolsResults: { ...state.toolsResults, [toolName]: result },
    messages: [
      ...state.messages,
      new AIMessage({ content: `工具 ${toolName} 执行结果: ${JSON.stringify(result)}` }),
    ],
    nextStep: 'ROUTE',
  };
}

// graph/nodes/response-builder.ts
export async function responseBuilderNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  return {
    nextStep: 'END',
    messages: [
      ...state.messages,
      new AIMessage({ content: state.context.finalResponse as string }),
    ],
  };
}
```

**图编译与执行**：

```typescript
// graph/compiler.ts
import { StateGraph } from '@langchain/langgraph';
import { MemoryStateManager } from '@langchain/langgraph/state';
import type { AgentState } from '../types/agent-state';
import { llmRouterNode } from './nodes/llm-router';
import { toolExecutorNode } from './nodes/tool-executor';
import { responseBuilderNode } from './nodes/response-builder';

export function createAgentGraph() {
  const workflow = new StateGraph<AgentState>({
    channels: {
      messages: {
        value: (x: unknown[], y: unknown[]) => [...x, ...y],
        default: () => [],
      },
      nextStep: { default: () => 'ROUTE' },
      context: { default: () => ({}) },
      toolsResults: { default: () => ({}) },
      currentToolArgs: { default: () => ({}) },
    },
  });

  // 注册节点
  workflow.addNode('ROUTE', llmRouterNode);
  workflow.addNode('TOOL', toolExecutorNode);
  workflow.addNode('RESPOND', responseBuilderNode);

  // 设置入口点
  workflow.addEntryPoint('ROUTE');

  // 条件边：ROUTE → TOOL 或 RESPOND
  workflow.addConditionalEdges(
    'ROUTE',
    (state: AgentState) => state.nextStep === 'RESPOND' ? 'RESPOND' : 'TOOL',
    {
      RESPOND: 'RESPOND',
      TOOL: 'TOOL',
    }
  );

  // TOOL 执行完后回到 ROUTE 重新决策
  workflow.addEdge('TOOL', 'ROUTE');
  workflow.addEdge('RESPOND', '__end__');

  return workflow.compile();
}

// 使用
const graph = createAgentGraph();
const result = await graph.invoke({
  messages: [new HumanMessage('附近有什么健身房？')],
  nextStep: 'ROUTE',
  context: { activeModel: 'gpt-4o' },
  toolsResults: {},
  currentToolArgs: {},
});
```

**State 状态流转**：

```
User Input
    │
    ▼
┌─────────────────┐
│     ROUTE       │ ←── LLM 决策：调用工具还是直接回复
│  (llmRouter)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │ 条件路由  │
    ▼         ▼
┌────────┐  ┌─────────────────┐
│  TOOL  │  │    RESPOND      │
│调用工具 │  │   直接回复用户   │
└───┬────┘  └────────┬─────────┘
    │                │
    ▼                ▼
┌─────────┐    ┌──────────────┐
│ 工具结果 │    │  Assistant   │
│ 写回State│    │  Response    │
└────┬────┘    └──────┬───────┘
     │                 │
     └────────┬────────┘
              ▼
         [回到 ROUTE 或 END]
```

### 2.2 MCP 客户端设计

使用 `@modelcontextprotocol/sdk` 连接外部 MCP Server。

**MCP 连接管理**：

```typescript
// services/mcp-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface McpServerConfig {
  id: string;
  name: string;
  type: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
}

export class MCPClientManager {
  private connections = new Map<string, Client>();

  async addServer(config: McpServerConfig): Promise<Tool[]> {
    let transport: StdioClientTransport | SSEClientTransport;

    if (config.type === 'stdio') {
      transport = new StdioClientTransport({
        command: config.command!,
        args: config.args || [],
      });
    } else {
      transport = new SSEClientTransport(new URL(config.url!));
    }

    const client = new Client(
      { name: 'easy-agent', version: '0.1.0' },
      { capabilities: { tools: {} } }
    );

    await client.connect(transport);
    this.connections.set(config.id, client);

    const listResult = await client.request(
      { method: 'tools/list' },
      { ...Tool$ListSchema }
    );

    return listResult.tools;
  }

  async callTool(
    serverId: string,
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<unknown> {
    const client = this.connections.get(serverId);
    if (!client) {
      throw new Error(`MCP Server ${serverId} not found`);
    }

    const result = await client.request(
      {
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: arguments_,
        },
      },
      Tool$CallSchema
    );

    return result.content;
  }

  async removeServer(serverId: string): Promise<void> {
    const client = this.connections.get(serverId);
    if (client) {
      await client.close();
      this.connections.delete(serverId);
    }
  }

  getConnectedServers(): string[] {
    return Array.from(this.connections.keys());
  }
}
```

**MCP 工具 → LangGraph 节点映射**：

```typescript
// graph/nodes/mcp-tool.ts
export function createMcpToolNode(
  tool: Tool,
  serverId: string,
  mcpManager: MCPClientManager
) {
  return async function mcpToolNode(state: AgentState): Promise<Partial<AgentState>> {
    const args = state.currentToolArgs;

    const result = await mcpManager.callTool(serverId, tool.name, args as Record<string, unknown>);

    return {
      toolsResults: { ...state.toolsResults, [tool.name]: result },
      messages: [
        ...state.messages,
        new AIMessage({
          content: `[${tool.name}] 执行结果: ${JSON.stringify(result)}`,
        }),
      ],
      nextStep: 'ROUTE',
    };
  };
}
```

### 2.3 流程编排（Workflow）设计

**编排数据模型**：

```typescript
// types/workflow.ts
export type NodeType = 'input' | 'llm' | 'mcp_tool' | 'output' | 'condition';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  config: NodeConfig;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;  // 条件边标签: "是" / "否"
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface NodeConfig {
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

  // 条件节点
  condition?: string;
}
```

**工作流执行引擎**：

```typescript
// services/workflow-executor.ts
import { StateGraph } from '@langchain/langgraph';
import type { AgentState } from '../types/agent-state';
import { createMcpToolNode } from '../graph/nodes/mcp-tool';
import { llmNode } from '../graph/nodes/llm';
import { inputNode } from '../graph/nodes/input';
import { outputNode } from '../graph/nodes/output';
import { conditionNode } from '../graph/nodes/condition';

export class WorkflowExecutor {
  constructor(
    private mcpManager: MCPClientManager,
    private llmFactory: LLMFactory
  ) {}

  compile(workflow: Workflow) {
    const graphBuilder = new StateGraph<AgentState>({
      channels: this.getDefaultChannels(),
    });

    // 1. 注册节点
    for (const node of workflow.nodes) {
      const langGraphNode = this.createNode(node);
      graphBuilder.addNode(node.id, langGraphNode);
    }

    // 2. 注册边
    for (const edge of workflow.edges) {
      if (edge.label) {
        // 条件边
        graphBuilder.addConditionalEdges(
          edge.source,
          (state: AgentState) => this.evaluateCondition(edge.label!, state),
          { [edge.target]: edge.target }
        );
      } else {
        // 普通边
        graphBuilder.addEdge(edge.source, edge.target);
      }
    }

    // 3. 设置入口和结束点
    const entryNode = workflow.nodes.find(n => n.type === 'input');
    if (entryNode) {
      graphBuilder.addEntryPoint(entryNode.id);
    }

    const outputNodes = workflow.nodes.filter(n => n.type === 'output');
    for (const outputNode of outputNodes) {
      graphBuilder.addEdge(outputNode.id, '__end__');
    }

    return graphBuilder.compile();
  }

  private createNode(node: WorkflowNode) {
    switch (node.type) {
      case 'mcp_tool':
        return createMcpToolNode(
          { name: node.config.toolName!, description: '' } as Tool,
          node.config.mcpServerId!,
          this.mcpManager
        );
      case 'llm':
        return llmNode(this.llmFactory, node.config);
      case 'input':
        return inputNode(node.config);
      case 'output':
        return outputNode(node.config);
      case 'condition':
        return conditionNode(node.config);
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  private evaluateCondition(label: string, state: AgentState): boolean {
    // 简单条件评估，可扩展
    if (label === '是') return true;
    if (label === '否') return false;
    return true;
  }

  private getDefaultChannels() {
    return {
      messages: {
        value: (x: unknown[], y: unknown[]) => [...x, ...y],
        default: () => [],
      },
      nextStep: { default: () => '' },
      context: { default: () => ({}) },
      toolsResults: { default: () => ({}) },
      currentToolArgs: { default: () => ({}) },
    };
  }
}
```

### 2.4 API Key 管理设计

**加密存储方案**：

```typescript
// services/key-manager.ts
import * as crypto from 'crypto';
import { scrypt, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const ITERATIONS = 100000;

export class KeyManager {
  private masterKey: Buffer;

  constructor(password: string, salt?: Buffer) {
    const saltBuffer = salt || randomBytes(SALT_LENGTH);
    this.masterKey = this.deriveKey(password, saltBuffer);
  }

  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.scryptSync(password, salt, KEY_LENGTH, {
      N: 2 ** 14,
      r: 8,
      p: 1,
    });
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // 格式: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

**API 路由设计**：

```
API Routes
├── /api/keys
│   ├── GET    /               → 列出所有 Key（不返回明文）
│   ├── POST   /               → 添加新 Key
│   ├── PUT    /:id           → 更新 Key
│   ├── DELETE /:id           → 删除 Key
│   └── POST   /:id/test      → 测试 Key 有效性
│
├── /api/mcp
│   ├── GET    /servers       → 列出已接入的 MCP Server
│   ├── POST   /servers       → 添加 MCP Server
│   ├── DELETE /servers/:id   → 移除 MCP Server
│   ├── GET    /servers/:id/tools → 获取 Server 提供的工具列表
│   └── PUT    /servers/:id/tools/:toolId → 更新工具启用状态
│
├── /api/workflows
│   ├── GET    /              → 列出所有工作流
│   ├── POST   /              → 创建工作流
│   ├── GET    /:id           → 获取工作流详情
│   ├── PUT    /:id           → 更新工作流
│   ├── DELETE /:id           → 删除工作流
│   ├── POST   /:id/execute   → 执行工作流
│   └── GET    /:id/history   → 执行历史
│
├── /api/chat
│   └── POST   /              → 对话接口（触发 Agent）
│
└── /ws/exec
    └── WebSocket /            → 流程执行流式输出
```

**WebSocket 流式执行**：

```typescript
// routes/chat.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws/exec' });

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', async (data: Buffer) => {
      const { workflowId, input } = JSON.parse(data.toString());

      const graph = workflowExecutor.compile(loadedWorkflow);
      const stream = await graph.stream(input);

      for await (const chunk of stream) {
        ws.send(JSON.stringify({
          type: 'chunk',
          data: chunk,
        }));
      }

      ws.send(JSON.stringify({ type: 'done' }));
    });
  });
}
```

---

## 3. 前端架构设计

### 3.1 整体结构

```
frontend/src/
├── App.vue                    # 根组件
├── main.ts                    # 入口
├── views/                     # 页面级组件
│   ├── ChatView.vue           # 聊天主界面
│   ├── PluginView.vue         # 插件管理
│   ├── FlowView.vue           # 流程编排
│   └── SettingsView.vue       # 设置页
├── components/                # 可复用组件
│   ├── AgentPet/              # Agent 桌面宠物
│   │   ├── AgentPet.vue      # 主组件
│   │   ├── PetBody.vue       # 身体
│   │   ├── PetFace.vue       # 面部表情
│   │   ├── PetAnimation.vue  # 动画逻辑
│   │   └── PetStates.ts      # 状态定义
│   ├── FlowCanvas/            # 流程图画布
│   │   ├── FlowCanvas.vue    # 画布容器
│   │   ├── InputNode.vue
│   │   ├── LLMNode.vue
│   │   ├── MCPToolNode.vue
│   │   └── OutputNode.vue
│   ├── Sidebar.vue
│   └── ...
├── stores/                    # Pinia Store
│   ├── agent.ts               # Agent 状态
│   ├── plugin.ts              # 插件状态
│   ├── workflow.ts           # 工作流状态
│   └── settings.ts            # 设置状态
├── api/                       # API 调用
│   ├── client.ts              # Fetch 实例
│   ├── keys.ts
│   ├── mcp.ts
│   └── workflow.ts
├── composables/               # 组合式函数
│   ├── useAgent.ts
│   └── useMCP.ts
├── types/                     # TypeScript 类型
│   ├── api.ts
│   ├── mcp.ts
│   └── workflow.ts
└── styles/
    ├── variables.css
    └── global.css
```

### 3.2 Agent Pet（桌面宠物）设计

**状态定义**：

```typescript
// components/AgentPet/PetStates.ts
export type PetMood = 'idle' | 'thinking' | 'working' | 'happy' | 'error';

export interface PetState {
  mood: PetMood;
  isLoading: boolean;
  currentTask: string | null;
  message: string;
}

export const MoodConfig: Record<PetMood, {
  eyeExpression: 'normal' | 'happy' | 'thinking' | 'sad';
  bodyColor: string;
  animation: 'float' | 'pulse' | 'spin' | 'bounce' | 'shake';
  message: string;
}> = {
  idle: {
    eyeExpression: 'normal',
    bodyColor: '#4A90D9',
    animation: 'float',
    message: '有什么可以帮你的吗？',
  },
  thinking: {
    eyeExpression: 'thinking',
    bodyColor: '#F59E0B',
    animation: 'pulse',
    message: '让我想想...',
  },
  working: {
    eyeExpression: 'normal',
    bodyColor: '#3B82F6',
    animation: 'spin',
    message: '正在执行任务...',
  },
  happy: {
    eyeExpression: 'happy',
    bodyColor: '#10B981',
    animation: 'bounce',
    message: '任务完成！',
  },
  error: {
    eyeExpression: 'sad',
    bodyColor: '#EF4444',
    animation: 'shake',
    message: '出了点小问题...',
  },
};
```

**交互流程**：

```
用户发送消息
    │
    ▼
AgentPet.setMood('thinking')
    │
    ▼
前端 → POST /api/chat → 后端 LangGraph 执行
    │
    ▼
WebSocket 流式返回
    │
    ├─→ 中间结果 → AgentPet.setMood('working') + 显示进度
    │
    └─→ 最终结果 → AgentPet.setMood('happy') + 显示回复
```

### 3.3 流程编排画布设计

使用 **Vue Flow**（`@vue-flow/core`）实现可视化编排。

**节点类型定义**：

```typescript
// 每个节点类型对应的 Vue Flow 节点定义
export const NodeTypes = {
  input: {
    type: 'input',
    label: '输入',
    icon: 'INPUT',
    color: '#10B981',
    handles: { source: ['bottom'], target: [] },
  },
  llm: {
    type: 'llm',
    label: '大模型',
    icon: 'LLM',
    color: '#8B5CF6',
    handles: { source: ['bottom'], target: ['top'] },
  },
  mcp_tool: {
    type: 'mcp_tool',
    label: 'MCP 工具',
    icon: 'MCP',
    color: '#F59E0B',
    handles: { source: ['bottom'], target: ['top'] },
  },
  condition: {
    type: 'condition',
    label: '条件分支',
    icon: 'IF',
    color: '#3B82F6',
    handles: { source: ['bottom', 'right'], target: ['top'] },
  },
  output: {
    type: 'output',
    label: '输出',
    icon: 'OUT',
    color: '#EF4444',
    handles: { source: [], target: ['top'] },
  },
};
```

**画布操作流程**：

```
从左侧插件列表拖拽节点
    │
    ▼
放置到画布上 → 配置节点参数
    │
    ▼
拖拽连接线 → 串联节点
    │
    ▼
点击"运行" → 编译为 LangGraph → 流式执行
```

---

## 4. 数据存储设计

### 4.1 SQLite 表结构

使用 `better-sqlite3`，同步 API，性能高。

```sql
-- API Key 表（加密存储）
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    model TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- MCP Server 表
CREATE TABLE mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('stdio', 'sse')),
    command TEXT,
    url TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- MCP 工具表
CREATE TABLE mcp_tools (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL REFERENCES mcp_servers(id),
    name TEXT NOT NULL,
    description TEXT,
    input_schema TEXT,  -- JSON
    enabled INTEGER DEFAULT 1
);

-- 工作流表
CREATE TABLE workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    graph_data TEXT NOT NULL,  -- JSON: { nodes: [], edges: [] }
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 执行历史表
CREATE TABLE execution_history (
    id TEXT PRIMARY KEY,
    workflow_id TEXT REFERENCES workflows(id),
    input_data TEXT,   -- JSON
    output_data TEXT,  -- JSON
    status TEXT CHECK(status IN ('success', 'failed', 'running')),
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

**存储服务**：

```typescript
// services/storage.ts
import Database from 'better-sqlite3';
import { join } from 'path';

export class StorageService {
  private db: Database.Database;

  constructor(dbPath: string = './data/easy-agent.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize() {
    // 建表语句...
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (...)
      CREATE TABLE IF NOT EXISTS mcp_servers (...)
      CREATE TABLE IF NOT EXISTS mcp_tools (...)
      CREATE TABLE IF NOT EXISTS workflows (...)
      CREATE TABLE IF NOT EXISTS execution_history (...)
    `);
  }

  // Workflow CRUD
  createWorkflow(workflow: Workflow): Workflow { /* ... */ }
  getWorkflow(id: string): Workflow | null { /* ... */ }
  updateWorkflow(id: string, data: Partial<Workflow>): Workflow { /* ... */ }
  deleteWorkflow(id: string): void { /* ... */ }
  listWorkflows(): Workflow[] { /* ... */ }

  // API Key CRUD
  createApiKey(key: ApiKey): ApiKey { /* ... */ }
  listApiKeys(): Omit<ApiKey, 'encryptedKey'>[] { /* ... */ }
  getDecryptedKey(id: string): string { /* ... */ }

  // MCP CRUD
  createMcpServer(server: McpServer): McpServer { /* ... */ }
  listMcpServers(): McpServer[] { /* ... */ }
  createMcpTool(tool: McpTool): McpTool { /* ... */ }
  listMcpTools(serverId: string): McpTool[] { /* ... */ }
}
```

---

## 5. 部署架构（MVP）

### 5.1 开发/本地部署

```
┌─────────────────────────────────────┐
│          本地机器                    │
│  ┌──────────┐    ┌──────────────┐  │
│  │ Vue Dev  │    │ Node.js Dev  │  │
│  │ Server   │    │ Server       │  │
│  │ :5173    │    │ :3000        │  │
│  └────┬─────┘    └──────┬───────┘  │
│       │                 │          │
│       └────────┬────────┘          │
│                │ localhost        │
│                ▼                   │
│         ┌──────────────┐          │
│         │   SQLite     │          │
│         │   数据库      │          │
│         └──────────────┘          │
└─────────────────────────────────────┘
```

### 5.2 生产部署（远期）

```
                         ┌─────────────┐
                         │   Nginx     │
                         │  (反向代理)  │
                         └──────┬──────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
       ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
       │  Vue 构建产物 │ │ Node.js       │ │  PostgreSQL  │
       │  (静态文件)   │ │ (PM2)         │ │  (远期)      │
       │              │ │              │ │              │
       └──────────────┘ └──────┬───────┘ └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  MCP Servers  │
                        │  (外部/内部)   │
                        └──────────────┘
```

---

## 6. 安全考虑

| 威胁 | 缓解措施 |
|------|----------|
| API Key 泄露 | AES-256-GCM 加密存储 + PBKDF2 派生 Master Key |
| 恶意 MCP 插件 | MVP 仅本地使用，签名机制远期规划 |
| 工作流注入 | 输入参数白名单校验 |
| CSRF/XSS | Express CORS 配置 + Vue 模板转义 |
| 数据篡改 | SQLite 数据库文件权限控制 |

---

## 7. 扩展性设计

### 7.1 模块可插拔

```
┌──────────────────────────────────────────┐
│              PluginRegistry               │
│  ┌────────┐ ┌────────┐ ┌────────┐       │
│  │ MCP A │ │ MCP B  │ │Plugin C │  ...  │
│  │Server │ │Server  │ │        │       │
│  └────┬───┘ └────┬───┘ └───┬────┘       │
│       │          │         │            │
│       └──────────┼─────────┘            │
│                  ▼                       │
│           ┌─────────────┐                │
│           │  PluginBus  │                │
│           │ (事件总线)   │                │
│           └──────┬──────┘                │
└──────────────────┼───────────────────────┘
                   │
                   ▼
            ┌──────────────┐
            │  LangGraph    │
            │  JS Kernel    │
            └──────────────┘
```

### 7.2 去中心化扩展路径

```
Phase 1 (MVP)        Phase 2             Phase 3
本地 SQLite     →   远程 PostgreSQL  →   分布式存储
单用户          →   多用户 + 认证     →   P2P 网络
中心化 MCP     →   公共 MCP 市场     →   去中心化 MCP 协议
```

---

## 8. 后端目录结构（完整）

```
server/src/
├── index.ts                 # 入口，监听端口
├── app.ts                   # Express App 定义，中间件配置
├── config.ts               # 环境变量配置
│
├── routes/                  # 路由层
│   ├── keys.ts             # /api/keys
│   ├── mcp.ts              # /api/mcp
│   ├── workflow.ts         # /api/workflows
│   └── chat.ts             # /api/chat
│
├── services/                # 业务逻辑层
│   ├── agent.ts            # Agent 核心服务
│   ├── mcp-client.ts       # MCP 客户端管理
│   ├── storage.ts          # SQLite 存储服务
│   └── key-manager.ts       # Key 加密管理
│
├── graph/                   # LangGraph 图定义
│   ├── compiler.ts         # 图编译
│   └── nodes/
│       ├── llm-router.ts
│       ├── tool-executor.ts
│       ├── response-builder.ts
│       └── ...
│
├── db/                      # 数据库
│   ├── index.ts             # 数据库连接
│   └── schema.ts            # 表结构
│
├── types/                   # 类型定义
│   ├── workflow.ts
│   ├── mcp.ts
│   └── api-key.ts
│
└── utils/                   # 工具函数
    └── crypto.ts
```

---

*文档版本: v0.1.0 | 最后更新: 2026-05-25*
