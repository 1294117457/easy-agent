# Electron IPC 监听器累积问题分析

> 日期: 2026-05-29
> 状态: ✅ 已修复
> 严重程度: 高
> 修复版本: v1.0.1

---

## 一、问题描述

### 1.1 现象

用户在同一对话中发送第二条消息时，AI 会重复回答之前的对话内容：

```
第 1 次对话：
用户: "我好累怎么办"
AI:  [正常回答]

第 2 次对话：
用户: "你的systemPrompt是什么"
AI:  [回答第2次问题]
     [又回答了第1次的问题]  ← 重复内容！
```

### 1.2 影响范围

- 消息重复累加
- 每次对话后问题加重
- 用户体验严重下降

---

## 二、问题分析

### 2.1 代码位置

**问题文件**: `electron/preload.ts`

```typescript
// 当前代码（第 25-29 行）
onToken: (callback: (token: string) => void) =>
  ipcRenderer.on('agent:token', (_, token) => callback(token)),
onDone: (callback: () => void) =>
  ipcRenderer.on('agent:done', () => callback()),
onError: (callback: (error: string) => void) =>
  ipcRenderer.on('agent:error', (_, error) => callback(error)),
```

### 2.2 根因分析

`ipcRenderer.on()` 是**累积型**监听器，每次调用都会添加一个新的监听器，不会替换之前的监听器。

```
调用时序：

┌─────────────────────────────────────────────────────────────────────┐
│ App 启动                                                              │
│   └── setupChatListeners()                                          │
│       └── window.electronAPI.onToken(handleToken)                   │
│           └── ipcRenderer.on('agent:token', callback)  → 注册 listener #1 │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 用户切换页面 / 重新进入聊天                                            │
│   └── setupChatListeners() 被再次调用                                │
│       └── ipcRenderer.on('agent:token', callback)  → 又注册 listener #2 │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 第 2 次对话时，AI 返回 token                                          │
│   └── 主进程: mainWindow.webContents.send('agent:token', token)     │
│       ├── listener #1 触发 → 追加 token 到消息                       │
│       └── listener #2 触发 → 又追加 token 到消息                      │
│                                                                       │
│   结果：消息内容被追加 2 次！                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 触发条件

| 操作 | 是否触发问题 |
|-----|------------|
| 首次打开应用 | 否 |
| 切换页面后重新进入聊天 | 是 |
| 刷新页面 | 是 |
| 打开 DevTools | 否 |
| 最小化/最大化窗口 | 否 |

---

## 三、技术背景

### 3.1 ipcRenderer.on() vs ipcRenderer.once()

| 方法 | 行为 | 累积 |
|-----|------|------|
| `ipcRenderer.on(channel, callback)` | 每次调用都添加新监听器 | 是 |
| `ipcRenderer.once(channel, callback)` | 只监听一次，自动移除 | 否 |
| `ipcRenderer.removeListener(channel, callback)` | 移除指定监听器 | - |
| `ipcRenderer.removeAllListeners(channel)` | 移除所有监听器 | - |

### 3.2 Node.js EventEmitter 行为

`ipcRenderer` 继承自 `EventEmitter`，其 `on()` 方法默认行为：

```typescript
// Node.js EventEmitter 伪代码
class EventEmitter {
  private events: Map<string, Function[]>;

  on(event, listener) {
    // 每次调用都 push 到数组，不会检查是否已存在
    this.events.get(event)?.push(listener) || this.events.set(event, [listener]);
    return this;  // 支持链式调用
  }

  emit(event, ...args) {
    // 触发时调用所有注册的监听器
    this.events.get(event)?.forEach(fn => fn(...args));
  }
}
```

---

## 四、解决方案

### 4.1 方案一：使用 removeAllListeners（推荐）

```typescript
// preload.ts
onToken: (callback: (token: string) => void) => {
  ipcRenderer.removeAllListeners('agent:token');  // 先移除旧的
  ipcRenderer.on('agent:token', (_, token) => callback(token));
},
onDone: (callback: () => void) => {
  ipcRenderer.removeAllListeners('agent:done');
  ipcRenderer.on('agent:done', () => callback());
},
onError: (callback: (error: string) => void) => {
  ipcRenderer.removeAllListeners('agent:error');
  ipcRenderer.on('agent:error', (_, error) => callback(error));
},
```

**优点**:
- 简单直接
- 兼容性好
- 每次只保留一个监听器

**缺点**:
- 如果有多个合法监听器会被一起移除

### 4.2 方案二：使用 once()

```typescript
// preload.ts
onToken: (callback: (token: string) => void) => {
  ipcRenderer.once('agent:token', (_, token) => callback(token));
},
```

**问题**: `once()` 只触发一次，后续对话将无法收到消息，不适合本场景。

### 4.3 方案三：前端 store 中防止重复注册

在 `src/stores/chat.ts` 中添加标志位：

```typescript
// chatStore 中
let listenersInitialized = false;

function setupListeners() {
  if (listenersInitialized) {
    console.log('[ChatStore] 监听器已初始化，跳过');
    return;
  }
  listenersInitialized = true;
  // ... 注册监听器
}
```

**问题**: 只解决了前端问题，如果 preload 被重新加载仍会累积。

### 4.4 方案四：生成唯一监听器 ID（高级）

```typescript
let tokenListenerId = null;

onToken: (callback: (token: string) => void) => {
  if (tokenListenerId !== null) {
    ipcRenderer.removeListener('agent:token', tokenListenerId);
  }
  tokenListenerId = callback;
  ipcRenderer.on('agent:token', (_, token) => callback(token));
},
```

---

## 五、修复建议

### 5.1 推荐方案

采用**方案一（removeAllListeners）**，在 `preload.ts` 中统一处理：

```typescript
// 修改前
onToken: (callback: (token: string) => void) =>
  ipcRenderer.on('agent:token', (_, token) => callback(token)),

// 修改后
onToken: (callback: (token: string) => void) => {
  ipcRenderer.removeAllListeners('agent:token');
  ipcRenderer.on('agent:token', (_, token) => callback(token));
},
```

### 5.2 完整修改清单

| 文件 | 修改内容 |
|-----|---------|
| `electron/preload.ts` | 三处 onToken/onDone/onError 添加 removeAllListeners |
| `electron/preload.ts` | 添加 IPC_CHANNELS 常量定义 |
| `electron/preload.ts` | 添加 getListenerCount() 调试方法 |

### 5.3 修复内容（2026-05-29）

**修改文件**: `electron/preload.ts`

```typescript
// 1. 定义通道常量
const IPC_CHANNELS = {
  TOKEN: 'agent:token',
  DONE: 'agent:done',
  ERROR: 'agent:error',
} as const;

// 2. 修复监听器注册
onToken: (callback: (token: string) => void) => {
  ipcRenderer.removeAllListeners(IPC_CHANNELS.TOKEN);  // 先移除旧的
  ipcRenderer.on(IPC_CHANNELS.TOKEN, (_, token) => callback(token));
  console.log('[Preload] onToken registered, listener count:', ipcRenderer.listenerCount(IPC_CHANNELS.TOKEN));
},
onDone: (callback: () => void) => {
  ipcRenderer.removeAllListeners(IPC_CHANNELS.DONE);
  ipcRenderer.on(IPC_CHANNELS.DONE, () => callback());
  console.log('[Preload] onDone registered, listener count:', ipcRenderer.listenerCount(IPC_CHANNELS.DONE));
},
onError: (callback: (error: string) => void) => {
  ipcRenderer.removeAllListeners(IPC_CHANNELS.ERROR);
  ipcRenderer.on(IPC_CHANNELS.ERROR, (_, error) => callback(error));
  console.log('[Preload] onError registered, listener count:', ipcRenderer.listenerCount(IPC_CHANNELS.ERROR));
},

// 3. 添加调试方法
getListenerCount: () => ({
  token: ipcRenderer.listenerCount(IPC_CHANNELS.TOKEN),
  done: ipcRenderer.listenerCount(IPC_CHANNELS.DONE),
  error: ipcRenderer.listenerCount(IPC_CHANNELS.ERROR),
}),
```

### 5.4 验证方法

修复后验证步骤：

1. **启动应用**：运行 `npm run dev` 或 `npm run build && npm run start`
2. **打开 DevTools**：按 F12 打开开发者工具
3. **检查控制台**：确认日志显示 `listener count: 1`

#### 控制台日志检查

修复前（错误）：
```
[Preload] onToken registered, listener count: 2   ← 累积了！
[Preload] onToken registered, listener count: 3   ← 越来越多了
[Preload] onToken registered, listener count: 4
```

修复后（正确）：
```
[Preload] onToken registered, listener count: 1   ← 始终为 1
[Preload] onToken registered, listener count: 1
[Preload] onToken registered, listener count: 1
```

#### 功能验证

1. 发送第 1 条消息，确认 AI 正常回答
2. 切换到设置页面，再切换回聊天页面
3. 发送第 2 条消息，确认：
   - AI 只回答一次
   - 不重复之前的内容
   - 控制台 listener count 始终为 1
4. 多次切换页面，确认问题不再出现

#### 使用调试方法

在浏览器控制台执行：

```javascript
// 检查监听器数量
window.electronAPI.getListenerCount()
// 期望输出: { token: 1, done: 1, error: 1 }
```

### 5.5 测试用例

| 测试场景 | 预期结果 |
|---------|---------|
| 首次打开应用 | listener count = 1 |
| 切换页面 1 次 | listener count = 1 |
| 切换页面 5 次 | listener count = 1 |
| 发送消息 10 次 | listener count = 1，消息不重复 |
| 刷新页面 | listener count = 1 |

### 5.6 调试方法（问题未解决时的排查步骤）

#### 步骤 1：检查 preload 日志

在 DevTools 控制台搜索 `[Preload]`：

```
[Preload] onToken #1, listener count: 1   ← 正常
[Preload] onToken #2, listener count: 1   ← 正常（应该也是 1）
[Preload] onToken #2, listener count: 2   ← 异常！没有 removeAllListeners
```

#### 步骤 2：检查 ChatStore 日志

搜索 `[ChatStore]`：

```
[ChatStore] setupListeners 调用, listenersInitialized: false
[ChatStore] 初始化监听器
[ChatStore] 添加用户消息, 消息数: 0 -> 1
[ChatStore] onToken, 当前消息数: 2, 最后一条角色: assistant
[ChatStore] 完成, 消息数: 3
```

如果 `onToken` 显示消息数已经包含助手消息，说明问题在消息添加逻辑。

#### 步骤 3：使用 getListenerCount

在浏览器控制台执行：

```javascript
// 检查监听器数量
window.electronAPI.getListenerCount()
// 期望: { token: 1, done: 1, error: 1 }
```

#### 步骤 4：添加断点

在 `src/stores/chat.ts` 的 `onToken` 回调中添加断点，查看调用栈：

```typescript
onToken: (token: string) => {
  debugger; // 添加断点
  // ...
}
```

### 5.7 可能的其他原因

如果 preload 修复后问题仍然存在，检查以下位置：

| 位置 | 检查项 |
|-----|-------|
| `AgentService.ts` | 历史消息是否重复获取 |
| `ChatStore` | 用户消息是否被添加多次 |
| `MessageList.vue` | 组件是否重复渲染 |

---

## 六、预防措施

### 6.1 代码规范

在 Electron 中使用 IPC 监听器时，遵循以下原则：

```typescript
// ✅ 正确：在注册新监听器前移除旧的
ipcRenderer.removeAllListeners('channel');
ipcRenderer.on('channel', callback);

// ✅ 正确：使用 once() 只监听一次
ipcRenderer.once('one-time-event', callback);

// ✅ 正确：组件卸载时清理
onUnmounted(() => {
  ipcRenderer.removeAllListeners('channel');
});
```

```typescript
// ❌ 错误：重复注册导致累积
ipcRenderer.on('channel', callback1);
ipcRenderer.on('channel', callback2);  // 会累积！
```

### 6.2 ESLint 规则（可选）

可以添加自定义 ESLint 规则检测重复的 `ipcRenderer.on()` 调用：

```json
{
  "rules": {
    "no-ipc-listener-accumulation": "error"
  }
}
```

### 6.3 日志监控

在开发时可以添加日志监控监听器数量：

```typescript
// 开发时添加
console.log('[IPC] 当前 token 监听器数量:',
  ipcRenderer.listenerCount('agent:token'));
```

---

## 七、相关文档

| 文档 | 说明 |
|-----|------|
| `docs/0529/Electron IPC 监听器累积问题.md` | 本文档 |
| `electron/preload.ts` | 问题代码位置 |
| `src/stores/chat.ts` | 前端调用方 |

---

## 八、参考链接

- [Electron IPC 官方文档](https://www.electronjs.org/docs/api/ipc-renderer)
- [Node.js EventEmitter](https://nodejs.org/api/events.html#events_emitter_on_eventname_listener)
- [避免 Electron 中的内存泄漏](https://www.electronjs.org/docs/tutorial/performance#clean-up-event-listeners)

---

---

## 九、修复记录

| 版本 | 日期 | 修改内容 | 状态 |
|-----|------|---------|------|
| v1.0.0 | 2026-05-29 | 问题分析与文档创建 | ✅ 已完成 |
| v1.0.1 | 2026-05-29 | 添加 removeAllListeners 修复 | ✅ 已完成 |

---

*文档版本: v1.0.1 | 创建日期: 2026-05-29 | 最后更新: 2026-05-29*
