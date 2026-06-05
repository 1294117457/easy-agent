# MCP Server 连接问题分析报告

**日期**: 2026-05-31
**状态**: 待修复

---

## 问题概览

| # | 问题描述 | 严重程度 | 状态 |
|---|---------|---------|------|
| 1 | 快速添加 MCP Server - "解析配置" 无反应 | 中 | 待排查 |
| 2 | 连接成功后显示"未连接" | 高 | 根因已定位 |
| 3 | 再次点击"连接"报 "An object could not be cloned" | 中 | 已修复（需验证） |

---

## 问题 1: "解析配置" 无反应

### 现象
点击"解析配置"按钮后，控制台无日志输出，页面无任何反应。

### 可能原因
- 按钮点击事件未正确绑定
- `parseConfig` 函数内部调用链断裂
- IPC 请求未发出

### 排查步骤
1. 检查 Console 是否有 `[Frontend] parseConfig called` 日志
2. 如果没有，检查按钮 `@click="parseConfig"` 是否正确绑定
3. 如果有，检查 IPC 调用 `workflowStore.parseMcpConfig()` 是否正确

### 相关代码
- `src/views/plugin/PluginView.vue` - `parseConfig()` 函数（第 34-58 行）
- `src/stores/workflow.ts` - `parseMcpConfig()` 函数（第 190-200 行）
- `electron/ipc/workflow.handler.ts` - `mcp:parseConfig` handler

---

## 问题 2: 连接成功后显示"未连接"

### 现象
1. 终端日志显示 `[McpManager] Successfully connected to server`
2. 但 UI 显示"未连接"状态
3. 服务器列表中可以看到服务器，但状态不对

### 根因分析

**核心问题**: 连接成功后，服务器没有添加到 `connectedServers` Set 中！

查看代码流程：

```
PluginView.vue connectWithConfig()
  ↓
IPC mcp:connectWithConfig
  ↓
mcpManager.connect() → 成功
  ↓
返回 { success: true, results: [{ id: "mcp_xxx", success: true }] }
  ↓
PluginView.vue 收到结果
  ↓
localConnectedServers.value.add(serverResult.id)  ← 添加到本地 Set
await workflowStore.addMcpServer()               ← 添加到 mcpServers
```

**问题**: `localConnectedServers` 是组件本地的 `ref`，只在组件内有效！当页面刷新或组件重载时，`localConnectedServers` 会被重置，导致状态丢失。

而 `workflowStore.connectedServers` 始终是空的，因为从未调用过 `workflowStore.connectMcpServer()`。

### 关键代码

```typescript
// PluginView.vue - 本地状态（会随组件销毁丢失）
const localConnectedServers = ref<Set<string>>(new Set());

// workflow.ts - store 状态（持久化）
const connectedServers = ref<Set<string>>(new Set());

// 问题：从未将服务器 ID 添加到 store 的 connectedServers！
// 正确做法应该是调用 workflowStore.connectMcpServer(server)
```

### 解决方案

**方案 A（推荐）**: 调用 `workflowStore.connectMcpServer()` 代替直接 IPC

```typescript
// 在 PluginView.vue 中
await workflowStore.connectMcpServer({
  id: serverResult.id,
  name: serverResult.name,
  type: 'http',
  url: serverConfig.url,
  headers: serverConfig.headers,
  enabled: true
});
```

**方案 B**: 保持现有逻辑，但需要同步到 store

```typescript
// 在 PluginView.vue 中
workflowStore.connectedServers.add(serverResult.id);
```

---

## 问题 3: 再次点击"连接"报 "An object could not be cloned"

### 现象
连接成功后，再次点击"连接"按钮，控制台报错：
```
An object could not be cloned.
```

### 根因
已修复。问题是 `inputValues` 作为 Vue Ref 传递给 IPC 时导致序列化失败。

### 修复方案
在 `PluginView.vue` 中使用展开运算符：

```typescript
// 修改前
workflowApi.mcpConnectWithConfig(configText.value, inputValues.value);

// 修改后
workflowApi.mcpConnectWithConfig(configText.value, { ...inputValues.value });
```

### 当前状态
✅ 已修复，代码已更新

---

## 终端日志关键信息

### 成功连接示例
```
[IPC] ★ mcp:connectWithConfig CALLED
[IPC] configText: {"servers":{"github":{"type":"http","url":"https://api.githubcopilot.com/mcp/insiders","headers":{...}}}}
[IPC] Parsed config successfully
[IPC] Connecting server: { "id": "mcp_1780228247690_github", "name": "github", ... }
[McpManager] Connecting to mcp_1780228247690_github via HTTP: https://api.githubcopilot.com/mcp/insiders
[McpManager] Headers: { Authorization: 'Bearer ...', ... }
[McpManager] Starting connection to mcp_1780228247690_github...
[McpManager] Successfully connected to server: mcp_1780228247690_github (http)
[IPC] Successfully connected to: github
[IPC] Return object: {"success":true,"results":[{"id":"mcp_1780228247690_github","name":"github","success":true}],"requiredInputs":[]}
```

### 连接失败示例（缺少 Authorization）
```
[McpManager] Headers: undefined
[McpManager] Failed to connect: missing required Authorization header
```

### Authorization 格式错误
```
[McpManager] Headers: { Authorization: 'Bearer YOUR_GITHUB_TOKEN_HERE', ... }
[McpManager] Failed to connect: Authorization header is badly formatted
```

---

## GitHub Copilot MCP 配置要求

### 必需的 headers
```json
{
  "Authorization": "Bearer YOUR_GITHUB_TOKEN",
  "X-MCP-Toolsets": "repos,issues",
  "X-MCP-Readonly": "true",
  "X-MCP-Lockdown": "false"
}
```

### Token 获取方式
1. GitHub Settings → Developer settings → Personal access tokens (classic)
2. 需要的权限: `repo`, `read:user`
3. 或使用 GitHub Copilot 订阅的 API Token

---

## 待办事项

- [ ] 排查"解析配置"无反应问题
- [ ] 修复连接成功后状态不更新的问题
- [ ] 验证"再次点击连接"不再报错
- [ ] 测试完整流程：配置 → 解析 → 连接 → 显示工具列表

---

## 相关文件

| 文件 | 用途 |
|------|------|
| `src/views/plugin/PluginView.vue` | 插件页面 UI |
| `src/stores/workflow.ts` | 状态管理 |
| `src/api/workflow.ts` | API 调用封装 |
| `electron/ipc/workflow.handler.ts` | IPC handlers |
| `electron/core/adapters/mcp/mcp.manager.ts` | MCP 连接管理 |
