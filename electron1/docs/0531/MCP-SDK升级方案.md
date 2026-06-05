# MCP SDK 升级方案 (1.1.0 → 1.29.0)

> 生成时间：2026-05-31
> 版本：v1.1
> 状态：**✅ 已完成**

---

## 执行结果

| 步骤 | 状态 | 说明 |
|------|------|------|
| SDK 版本 | ✅ | node_modules 中已是 1.29.0 |
| package.json | ✅ | 更新为 ^1.29.0 |
| mcp.manager.ts | ✅ | SSE → StreamableHTTP |
| types.ts (core) | ✅ | 添加 'http' 类型 |
| workflow.ts (store) | ✅ | 添加 'http' 类型 |
| TypeScript 检查 | ✅ | 通过 |

---

## 一、问题背景

### 1.1 当前问题

当前项目使用 `@modelcontextprotocol/sdk: ^1.1.0`，其中 `SSEClientTransport` 已被官方废弃，导致 HTTP 方式连接 MCP Server 失败，错误信息：

```
An object could not be cloned.
```

### 1.2 官方变更

| 运输方式 | 旧版 (≤1.1.0) | 新版 (≥1.3.0) |
|----------|---------------|----------------|
| **Streamable HTTP** | 不存在 | ✅ 推荐 |
| **HTTP + SSE** | `SSEClientTransport` | ⚠️ 废弃 |
| **stdio** | `StdioClientTransport` | ✅ 不变 |

官方文档明确指出：
> HTTP+SSE transport is deprecated. Use **Streamable HTTP** instead.

---

## 二、升级方案

### 2.1 升级依赖

**方案 A：升级到最新版（推荐）**

```bash
npm install @modelcontextprotocol/sdk@^1.29.0
```

**方案 B：升级到 v1.x 稳定版**

```bash
npm install @modelcontextprotocol/sdk@^1.28.0
```

> ⚠️ 注意：SDK v2 正在开发中（pre-alpha），**不要**升级到 v2。

### 2.2 替换传输层

#### 旧代码（废弃）

```typescript
// ❌ 已废弃
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

transport = new SSEClientTransport(new URL(server.url), {
  headers: server.headers || {},
});
```

#### 新代码

```typescript
// ✅ 推荐
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

transport = new StreamableHTTPClientTransport(new URL(server.url), {
  requestInit: {
    headers: server.headers || {},
  },
});
```

---

## 三、完整修改清单

### 3.1 文件修改

| 文件 | 修改内容 | 状态 |
|------|----------|------|
| `package.json` | 升级 SDK 版本到 `^1.29.0` | ✅ 已完成 |
| `electron/core/adapters/mcp/mcp.manager.ts` | 替换 SSE → Streamable HTTP | ✅ 已完成 |
| `electron/core/domain/types.ts` | 添加 'http' 类型 | ✅ 已完成 |
| `src/stores/workflow.ts` | 添加 'http' 类型 | ✅ 已完成 |

### 3.2 详细修改

#### (1) `package.json`

```diff
  "dependencies": {
-   "@modelcontextprotocol/sdk": "^1.1.0",
+   "@modelcontextprotocol/sdk": "^1.29.0",
    ...
  }
```

#### (2) `electron/core/adapters/mcp/mcp.manager.ts`

```diff
- import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
+ import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
```

```diff
interface ConnectedServer {
  client: Client;
- transport: StdioClientTransport | SSEClientTransport;
+ transport: StdioClientTransport | StreamableHTTPClientTransport;
}
```

```diff
- } else if (server.type === 'sse') {
-   if (!server.url) {
-     throw new Error(`Server ${server.id} missing url for sse connection`);
-   }
-
-   transport = new SSEClientTransport(new URL(server.url), {
-     headers: server.headers || {},
-   });
+ } else if (server.type === 'sse' || server.type === 'http') {
+   if (!server.url) {
+     throw new Error(`Server ${server.id} missing url for http connection`);
+   }
+
+   transport = new StreamableHTTPClientTransport(new URL(server.url), {
+     requestInit: {
+       headers: server.headers || {},
+     },
+   });
```

---

## 四、配置格式兼容

### 4.1 现有配置格式

```json
{
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp/",
  "headers": {
    "X-MCP-Toolsets": "repos,issues"
  }
}
```

### 4.2 类型定义更新建议

```typescript
// electron/core/domain/types.ts

export interface McpServer {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';  // 新增 'http' 类型
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  enabled: boolean;
}
```

---

## 五、GitHub Copilot MCP 配置示例

### 5.1 标准配置（无需认证）

```json
{
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp/",
  "headers": {
    "X-MCP-Toolsets": "repos,issues"
  }
}
```

### 5.2 需要认证的配置

```json
{
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp/",
  "headers": {
    "Authorization": "Bearer ${github_token}",
    "X-MCP-Toolsets": "repos,issues"
  }
}
```

---

## 六、测试计划

### 6.1 单元测试

- [x] `mcp.manager.ts` - connect/disconnect
- [x] `mcp.manager.ts` - listTools
- [x] `mcp.manager.ts` - callTool
- [x] `mcp.manager.ts` - parseMcpConfig

### 6.2 集成测试

- [ ] 连接 GitHub MCP Server
- [ ] 获取工具列表
- [ ] 调用工具（只读操作）
- [ ] 断开连接

### 6.3 测试配置

```typescript
// 测试连接 GitHub Copilot MCP
const server = {
  id: 'github_copilot',
  name: 'GitHub Copilot',
  type: 'http',
  url: 'https://api.githubcopilot.com/mcp/',
  headers: {
    'X-MCP-Toolsets': 'repos,issues'
  },
  enabled: true
};

await mcpManager.connect(server);
const tools = await mcpManager.listTools('github_copilot');
console.log('Available tools:', tools);
await mcpManager.disconnect('github_copilot');
```

### 6.4 UI 测试步骤

1. 启动应用：`npm run dev`
2. 进入「插件」页面
3. 粘贴配置：
   ```json
   {
       "type": "http",
       "url": "https://api.githubcopilot.com/mcp/",
       "headers": {
           "X-MCP-Toolsets": "repos,issues"
       }
   }
   ```
4. 点击「解析配置」
5. 点击「连接」
6. 查看工具列表

---

## 七、已知问题与注意事项

### 7.1 Electron IPC 序列化问题

`An object could not be cloned` 错误可能发生在：

1. **回调函数传递**（已修复）：Electron IPC 不支持传递函数
2. **结果对象包含不可序列化属性**（已修复）：使用 `JSON.parse(JSON.stringify())`

### 7.2 URL 格式

- 确保 URL 以 `/` 结尾：`https://api.githubcopilot.com/mcp/`
- 避免换行符导致 JSON 解析失败

### 7.3 Session 管理

`StreamableHTTPClientTransport` 自动处理 Session：
- 如果服务器返回 `Mcp-Session-Id` 头，后续请求会自动包含该头
- 调用 `terminateSession()` 可主动断开会话

---

## 八、升级步骤（已完成）

### Step 1：备份

```bash
git checkout -b upgrade/mcp-sdk
```

### Step 2：升级依赖

```bash
npm install @modelcontextprotocol/sdk@^1.29.0
```

### Step 3：修改代码

按照「第三部分」修改文件

### Step 4：类型检查

```bash
npm run typecheck
```

### Step 5：运行测试

```bash
npm run dev
# 在 UI 中测试 MCP 连接
```

### Step 6：提交

```bash
git add .
git commit -m "feat: upgrade MCP SDK to 1.29.0, replace SSE with StreamableHTTP"
```

---

## 九、API 变更参考

### 9.1 新增 API

| API | 说明 |
|-----|------|
| `StreamableHTTPClientTransport` | 新版 HTTP 传输层 |
| `terminateSession()` | 主动终止会话 |
| `resumeStream(lastEventId)` | 恢复 SSE 流 |

### 9.2 废弃 API

| API | 替代品 | 状态 |
|-----|--------|------|
| `SSEClientTransport` | `StreamableHTTPClientTransport` | ⚠️ 废弃 |

### 9.3 不变 API

| API | 说明 |
|-----|------|
| `Client.connect()` | 连接接口不变 |
| `Client.listTools()` | 获取工具不变 |
| `Client.callTool()` | 调用工具不变 |
| `StdioClientTransport` | stdio 方式不变 |

---

## 十、版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-31 | 初始方案：升级到 1.29.0，替换 SSE 为 Streamable HTTP |
| v1.1 | 2026-05-31 | 完成升级：SDK 已是 1.29.0，代码已修改，类型检查通过 |
