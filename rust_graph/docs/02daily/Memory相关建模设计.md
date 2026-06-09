struct Memory{
  recordsVec<Record>//核心操作记录
  stateMap:HashMap<RecordId,State>//state记录，Record有改动才更新，回溯时找到最近的那个state
  agentIndexs:HashMap<AgentId,Vec<RecordId>>//AgentId对应的Record的索引数组的映射
}

Record{
  recordId
  agentId
  content
  ...timestamp....
}

State{
  PublicConfig:Config
  AgentConfig:HashMap<AgentId,Config>
}

Agent{
  agentId,
  windowSize//根据这个来决定recordIndexs大小以及回溯时从Memory.agentIndex中恢复多少recordIndexs
  recordIndexs:Vec<RecordId>  //当前的记录索引，决定context_cache的内容
  context_cache:Vec<Record.content>
  agentConfig//和Memory.stateMap.agentConfig[agentId]同步
}



后续设想注意点

```
│   关键设计原则：                                                 │
│   ├── Agent 是核心，拥有 Memory 引用，负责 LLM 调用              │
│   ├── Node 是 Agent 的容器，管理生命周期                        │
│   ├── Graph 协调多个 Node，可选共享 Memory                      │
│   ├── Storage 独立于运行时，负责持久化                          │
│   └── Record 增加 node_id，便于追踪和恢复  
```


Graph {
    agents: Vec<Agent>
    edges: Vec<Edge>           # (from_agent_id, to_agent_id, condition)
    memory: Memory             # 全局共享，Graph 只读/写 record
    state: State               # 全局共享配置
}
