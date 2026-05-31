# MCP-Plugin-WorkflowNode UI 实现文档

> 生成时间：2026-05-31
> 版本：v1.0

---

## 一、UI 实现概述

本次 UI 开发完成了 MCP → Plugin → WorkflowNode → Workflow 的完整管理界面，包括：

1. **MCP Server 管理**：添加、编辑、连接、断开、删除 MCP Server
2. **Plugin 封装**：选择 Server 工具，封装为 Plugin
3. **WorkflowNode 创建**：配置 I/O Schema 和映射
4. **Workflow 编排**：创建工作流，添加节点，执行测试

---

## 二、新增文件清单

### 2.1 Store（状态管理）

| 文件路径 | 说明 |
|----------|------|
| `src/stores/workflow.ts` | 工作流相关状态和操作 |

### 2.2 API（接口调用）

| 文件路径 | 说明 |
|----------|------|
| `src/api/workflow.ts` | Workflow 相关 IPC 调用封装 |

### 2.3 View（页面组件）

| 文件路径 | 说明 |
|----------|------|
| `src/views/settings/McpSetting.vue` | MCP Server & Plugin 管理页面 |
| `src/views/settings/WorkflowSetting.vue` | Workflow & Node 管理页面 |

---

## 三、修改文件清单

| 文件路径 | 修改内容 |
|----------|----------|
| `src/api/config.ts` | 新增 MCP/Plugin/Workflow API |
| `electron/preload.ts` | 新增 IPC 通道暴露 |
| `src/views/settings/SettingsView.vue` | 新增菜单项 |

---

## 四、页面功能详情

### 4.1 MCP & Plugin 管理页面 (`McpSetting.vue`)

#### 功能区域

```
┌─────────────────────────────────────────────────────────────────┐
│ MCP & Plugin 管理                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ MCP Servers                              [+ 添加 Server]         │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ GitHub                        [已连接] [断开] [编辑] [删除]│ │
│ │ 类型: stdio | 命令: docker                                  │ │
│ │ 发现 5 个工具                                               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Plugins                                 [+ 创建 Plugin]          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ GitHub Issues                        [删除]                 │ │
│ │ 工具: issue_read, issue_create                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 功能点

| 功能 | 说明 |
|------|------|
| 添加 Server | 填写名称、类型、命令、参数、环境变量 |
| 连接 Server | 调用 IPC 连接，获取工具列表 |
| 编辑 Server | 修改 Server 配置 |
| 删除 Server | 断开并删除 |
| 创建 Plugin | 选择 Server + 选择工具 → 封装 |
| 删除 Plugin | 删除封装 |

#### 弹窗表单

**添加 Server**：
- 名称（文本输入）
- 类型（stdio / sse 下拉）
- 命令（文本输入，如 docker、npx）
- 参数（多行文本，每行一个参数）
- 环境变量 Key/Value（Token 等敏感信息）

**创建 Plugin**：
- 名称（文本输入）
- 描述（文本输入）
- 选择 Server（下拉，仅显示已连接的）
- 选择工具（多选 checkbox）

---

### 4.2 Workflow & Node 管理页面 (`WorkflowSetting.vue`)

#### 布局结构

```
┌───────────────────┬───────────────────┬───────────────────┐
│    Workflows      │   当前工作流的节点  │      所有节点      │
│                   │                    │                   │
│ [+ 新建]          │                    │                   │
│                   │                    │                   │
│ ● Issue 汇总      │ [读取 Issue]       │ [读取 Issue]      │
│   draft|05-31    │ [创建 Issue]       │ [创建 Issue]      │
│                   │                    │                   │
│   GitHub 周报     │     [验证]         │                   │
│   draft|05-30    │                    │                   │
│                   │                    │                   │
└───────────────────┴───────────────────┴───────────────────┘

执行工作流: Issue 汇总
┌─────────────────────────────────────────────────────────────┐
│ 输入参数 (JSON):                                            │
│ { "repo": "easy-agent", "issueId": 1 }                    │
│                                          [执行]             │
└─────────────────────────────────────────────────────────────┘

执行结果：
{
  "success": true,
  "output": { ... }
}
```

#### 功能点

| 功能 | 说明 |
|------|------|
| 创建 Workflow | 输入名称、描述 |
| 选择 Workflow | 点击切换当前工作流 |
| 删除 Workflow | 删除工作流 |
| 添加节点到 Workflow | 从所有节点添加到当前工作流 |
| 移除节点 | 从当前工作流移除 |
| 创建节点 | 配置 Plugin、工具、Schema、映射 |
| 删除节点 | 删除节点定义 |
| 验证 Workflow | 检查节点和连接是否正确 |
| 执行 Workflow | 传入输入，执行整个工作流 |

#### 创建节点表单

```
┌─────────────────────────────────────────────────────────────┐
│ 创建节点                                                   │
├─────────────────────────────────────────────────────────────┤
│ 名称: 读取 Issue                                          │
│ 描述: 读取 GitHub Issue                                   │
│                                                             │
│ Plugin: [GitHub Issues ▼]  工具: [issue_read ▼]           │
│                                                             │
│ 输入 Schema                            [+ 添加字段]         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ {                                                      │ │
│ │   "type": "object",                                    │ │
│ │   "properties": { "repo": { "type": "string" } }       │ │
│ │ }                                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 输入映射                              [+ 添加映射]         │
│   repo → owner/repo                                        │
│                                                             │
│ 输出 Schema                            [+ 添加字段]         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ { "type": "object", ... }                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 输出映射                              [+ 添加映射]         │
│   title → title                                            │
│   body → content                                           │
│                                                             │
│                            [取消]  [创建]                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 五、Store 设计

### 5.1 workflow.ts

```typescript
// 状态
mcpServers: McpServer[]           // MCP Server 列表
connectedServers: Set<string>     // 已连接的 Server ID
serverTools: Map<string, Tool[]>  // Server → 工具列表
plugins: Plugin[]                 // Plugin 列表
nodes: WorkflowNode[]             // 所有节点
workflows: Workflow[]             // 所有工作流
currentWorkflow: Workflow         // 当前选中的工作流
currentNodes: WorkflowNode[]       // 当前工作流的节点

// MCP Server 方法
loadMcpServers()                  // 加载列表
addMcpServer()                     // 添加
removeMcpServer()                  // 删除
connectMcpServer()                 // 连接
disconnectMcpServer()              // 断开
isServerConnected()                // 检查状态
getServerTools()                   // 获取工具

// Plugin 方法
createPlugin()                     // 创建
loadPlugins()                      // 加载
deletePlugin()                     // 删除

// Node 方法
createNode()                       // 创建
loadNodes()                        // 加载
deleteNode()                       // 删除

// Workflow 方法
loadWorkflows()                    // 加载
createWorkflow()                   // 创建
selectWorkflow()                   // 选择
addNodeToWorkflow()                // 添加节点
removeNodeFromWorkflow()           // 移除节点
connectNodes()                     // 连接节点
disconnectNodes()                  // 断开
validateWorkflow()                 // 验证
executeWorkflow()                  // 执行
deleteWorkflow()                   // 删除
```

---

## 六、API 封装

### 6.1 workflow.ts

```typescript
export const workflowApi = {
  // MCP
  mcpConnect, mcpDisconnect, mcpIsConnected, mcpListTools, mcpCallTool,

  // Plugin
  pluginCreate, pluginList, pluginGet, pluginDelete,

  // Node
  nodeCreate, nodeExecute, nodeList, nodeListByPlugin, nodeUpdate, nodeDelete,

  // Workflow
  workflowCreate, workflowList, workflowGet, workflowAddNode, workflowRemoveNode,
  workflowConnect, workflowDisconnect, workflowValidate, workflowExecute,
  workflowUpdate, workflowDelete, workflowGetNodes,
};
```

---

## 七、路由配置

### SettingsView 菜单

```typescript
const menuItems = [
  { key: 'apikey', label: 'API Key', icon: '🔑', component: ApiKeySetting },
  { key: 'prompt', label: 'Prompt 模板', icon: '📝', component: PromptSetting },
  { key: 'mcp', label: 'MCP & Plugin', icon: '🔌', component: McpSetting },       // 新增
  { key: 'workflow', label: 'Workflow', icon: '🔀', component: WorkflowSetting },  // 新增
  { key: 'appearance', label: '外观', icon: '🎨', component: AppearanceSetting },
  { key: 'general', label: '通用', icon: '⚡', component: GeneralSetting },
  { key: 'about', label: '关于', icon: 'ℹ️', component: AboutSetting },
];
```

---

## 八、使用流程

### 8.1 添加 GitHub MCP Server

```
1. 打开「设置」→「MCP & Plugin」
2. 点击「+ 添加 Server」
3. 填写配置：
   - 名称：GitHub
   - 类型：stdio
   - 命令：docker
   - 参数：
     run
     -i
     --rm
     -e
     GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx
     ghcr.io/github/github-mcp-server
4. 点击「保存」
5. 点击「连接」按钮
6. 连接成功后显示「发现 X 个工具」
```

### 8.2 创建 Plugin

```
1. 确保已连接 MCP Server
2. 点击「+ 创建 Plugin」
3. 填写：
   - 名称：GitHub Issues
   - 描述：GitHub Issue 操作
   - Server：GitHub（自动选择已连接的）
   - 工具：勾选 issue_read, issue_create
4. 点击「创建」
```

### 8.3 创建节点

```
1. 打开「设置」→「Workflow」
2. 左侧点击「+ 新建」创建工作流
3. 右侧点击「+ 添加节点」
4. 填写：
   - 名称：读取 Issue
   - Plugin：GitHub Issues
   - 工具：issue_read
   - 输入 Schema：添加 repo, issueId 字段
   - 输入映射：repo → owner/repo
   - 输出 Schema：添加 title, body, state 字段
   - 输出映射：title → title, body → content
5. 点击「创建」
```

### 8.4 添加到工作流并执行

```
1. 在「所有节点」中找到创建的节点
2. 点击「添加到工作流」
3. 中间面板显示节点
4. 点击「验证」检查配置
5. 在底部输入 JSON 参数
6. 点击「执行」测试
```

---

## 九、后续扩展

- [ ] MCP Server 持久化到数据库
- [ ] 可视化工作流编辑器（拖拽编排）
- [ ] 节点连接线（Edge）可视化
- [ ] 执行结果可视化展示
- [ ] 定时任务支持

---

## 十、版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-31 | 初始 UI 实现 |
