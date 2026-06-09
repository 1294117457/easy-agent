优点

```
1.状态机
    基于rust的enum
2.muti agetn
    基于rust的ownership、borrowing、lifetime很适合实现
```

难点

```
1.底层api（文件解析、apikey接入模型，mcp等接口）需要自己实现
2.需要精细了解LangGraph底层实现转移到rust
```

实现

```
在一边开发easyAgent的同时，一遍开发rustGraph，
    rustGraph来提供模型接入等等功能，
    哪些功能需要实现的我就用rust重构，
    最终实现一个rust的后端和rust的agent端，
```

理解langgraph的设计理念，

```
│   LangGraph 的好设计（保留）：                              │
│   ✅ State -> Node -> State 的数据流                       │
│   ✅ 条件边根据状态决定下一步                              │
│   ✅ START 和 END 的边界定义                               │
│   ✅ Checkpoint 的概念    
```

```
rustGraph/
├── src/
│   ├── core/                    ← 核心抽象（状态机、图）
│   │   ├── mod.rs
│   │   ├── state.rs            # State trait + 状态类型
│   │   ├── graph.rs            # Graph 定义 + 执行引擎
│   │   ├── node.rs             # Node trait
│   │   └── channel.rs          # Agent 间通信
│   │
│   ├── llm/                     ← LLM 接入
│   │   ├── mod.rs
│   │   ├── provider.rs         # trait Provider { chat(&self, msgs) }
│   │   ├── openai.rs           # OpenAI 实现
│   │   ├── ollama.rs           # Ollama 实现
│   │   └── anthropic.rs        # Anthropic 实现
│   │
│   ├── tools/                   ← 工具系统
│   │   ├── mod.rs
│   │   ├── tool.rs             # Tool trait
│   │   ├── registry.rs         # 工具注册表
│   │   └── builtin/            # 内置工具
│   │       ├── file.rs
│   │       ├── search.rs
│   │       └── calculator.rs
│   │
│   ├── mcp/                     ← MCP 协议
│   │   ├── mod.rs
│   │   ├── client.rs
│   │   ├── protocol.rs
│   │   └── transport.rs
│   │
│   └── agent/                   ← Agent 实现
│       ├── mod.rs
│       ├── single.rs            # 单 Agent
│       ├── multi.rs             # 多 Agent 协调
│       └── supervisor.rs        # 主管模式
```

domain - 定义 struct + trait（接口）
application - 实现业务 trait（用例）
infrastructure - 实现持久化 trait（存储）
services - 依赖注入，统一组装

在domain和application是依赖倒置，
  services 层负责"注入"：                                  │
│   把 infrastructure 的实现，注入到 application 中  