# Step 4: IPC 打通

> 版本: v0.1.0 MVP
> 日期: 2026-05-26
> 前置：Step 3 LLM 对话已完成
> 目标：前端通过 IPC 调用 Core，Core 返回结果，前端渲染响应

---

## 1. 创建 ipc/chat.handler.ts

```typescript
// electron/ipc/chat.handler.ts
import type { IpcMainInvokeEvent } from 'electron';
import type { EasyAgentCore } from '../core/index.js';

export function registerChatHandlers(
  ipcMain: any,
  core: EasyAgentCore,
  mainWindow: any
) {
  // 发送消息
  ipcMain.handle(
    'chat:send',
    async (_event: IpcMainInvokeEvent, conversationId: string, message: string) => {
      return new Promise((resolve, reject) => {
        core.sendMessage(conversationId, message, {
          onToken: (token) => {
            // 推送 token 到渲染进程
            mainWindow.webContents.send('agent:token', token);
          },
          onDone: () => {
            mainWindow.webContents.send('agent:done', null);
            resolve(null);
          },
          onError: (error: string) => {
            mainWindow.webContents.send('agent:error', error);
            reject(new Error(error));
          },
        });
      });
    }
  );

  // 获取对话历史
  ipcMain.handle('chat:history', (_event: IpcMainInvokeEvent, conversationId: string) => {
    return core.getStorage().getMessages(conversationId);
  });

  // 获取所有对话列表
  ipcMain.handle('chat:conversations', () => {
    return core.getStorage().listConversations();
  });

  // 创建新对话
  ipcMain.handle('chat:new', () => {
    return core.getStorage().createConversation({ name: '新对话' });
  });

  // 删除对话
  ipcMain.handle('chat:delete', (_event: IpcMainInvokeEvent, conversationId: string) => {
    return core.getStorage().deleteConversation(conversationId);
  });
}
```

## 2. 创建 ipc/config.handler.ts

```typescript
// electron/ipc/config.handler.ts
import type { IpcMainInvokeEvent } from 'electron';
import type { IStoragePort } from '../core/index.js';

export function registerConfigHandlers(
  ipcMain: any,
  storage: IStoragePort
) {
  // 获取所有配置
  ipcMain.handle('config:get', () => {
    return {
      apiKeys: storage.listApiKeys(),
      prompts: storage.listPrompts(),
    };
  });

  // 添加 API Key
  ipcMain.handle(
    'config:apiKey:create',
    (_event: IpcMainInvokeEvent, data: { provider: string; key: string; model: string }) => {
      return storage.createApiKey(data);
    }
  );

  // 删除 API Key
  ipcMain.handle('config:apiKey:delete', (_event: IpcMainInvokeEvent, id: string) => {
    return storage.deleteApiKey(id);
  });

  // 创建 Prompt
  ipcMain.handle(
    'config:prompt:create',
    (_event: IpcMainInvokeEvent, data: { name: string; description?: string; systemPrompt: string }) => {
      return storage.createPrompt(data);
    }
  );

  // 删除 Prompt
  ipcMain.handle('config:prompt:delete', (_event: IpcMainInvokeEvent, id: string) => {
    return storage.deletePrompt(id);
  });
}
```

## 3. 更新 preload.ts

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // ========== 对话 ==========
  sendMessage: (conversationId: string, message: string) =>
    ipcRenderer.invoke('chat:send', conversationId, message),

  getHistory: (conversationId: string) =>
    ipcRenderer.invoke('chat:history', conversationId),

  getConversations: () =>
    ipcRenderer.invoke('chat:conversations'),

  newConversation: () =>
    ipcRenderer.invoke('chat:new'),

  deleteConversation: (conversationId: string) =>
    ipcRenderer.invoke('chat:delete', conversationId),

  // ========== 配置 ==========
  getConfig: () =>
    ipcRenderer.invoke('config:get'),

  createApiKey: (data: { provider: string; key: string; model: string }) =>
    ipcRenderer.invoke('config:apiKey:create', data),

  deleteApiKey: (id: string) =>
    ipcRenderer.invoke('config:apiKey:delete', id),

  createPrompt: (data: { name: string; description?: string; systemPrompt: string }) =>
    ipcRenderer.invoke('config:prompt:create', data),

  deletePrompt: (id: string) =>
    ipcRenderer.invoke('config:prompt:delete', id),

  // ========== 事件推送 ==========
  onToken: (callback: (token: string) => void) =>
    ipcRenderer.on('agent:token', (_, token) => callback(token)),

  onDone: (callback: () => void) =>
    ipcRenderer.on('agent:done', () => callback()),

  onError: (callback: (error: string) => void) =>
    ipcRenderer.on('agent:error', (_, error) => callback(error)),
});
```

## 4. 更新 main.ts

```typescript
// electron/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { EasyAgentCore } from './core/index.js';
import { SQLiteAdapter } from './core/adapters/storage/sqlite.adapter.js';
import { registerChatHandlers } from './ipc/chat.handler.js';
import { registerConfigHandlers } from './ipc/config.handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow;
let core: EasyAgentCore;

function getDbPath() {
  const base = app.getPath('userData');
  return path.join(base, 'data', 'easy-agent.db');
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 注册 IPC Handler（在窗口创建后，以便传入 mainWindow）
  const storage = core.getStorage();
  registerChatHandlers(ipcMain, core, mainWindow);
  registerConfigHandlers(ipcMain, storage);
}

app.whenReady().then(async () => {
  // 1. 初始化 Storage
  const storage = new SQLiteAdapter(getDbPath(), 'easy-agent-master-key');

  // 2. 初始化 Core
  core = new EasyAgentCore(storage);

  // 3. 启动窗口
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

## 5. 前端类型声明

```typescript
// renderer/src/types/electron.d.ts
interface ElectronAPI {
  // 对话
  sendMessage(conversationId: string, message: string): Promise<void>;
  getHistory(conversationId: string): Promise<any[]>;
  getConversations(): Promise<any[]>;
  newConversation(): Promise<any>;
  deleteConversation(conversationId: string): Promise<boolean>;

  // 配置
  getConfig(): Promise<{ apiKeys: any[]; prompts: any[] }>;
  createApiKey(data: { provider: string; key: string; model: string }): Promise<any>;
  deleteApiKey(id: string): Promise<boolean>;
  createPrompt(data: { name: string; description?: string; systemPrompt: string }): Promise<any>;
  deletePrompt(id: string): Promise<boolean>;

  // 事件
  onToken(callback: (token: string) => void): void;
  onDone(callback: () => void): void;
  onError(callback: (error: string) => void): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
```

## 6. 前端 Store（Pinia）

```typescript
// renderer/src/stores/agent.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAgentStore = defineStore('agent', () => {
  const messages = ref<any[]>([]);
  const isLoading = ref(false);
  const currentConversationId = ref<string | null>(null);
  const conversations = ref<any[]>([]);

  // 注册事件监听（只注册一次）
  function setupListeners() {
    window.electronAPI.onToken((token: string) => {
      const lastMsg = messages.value[messages.value.length - 1];
      if (lastMsg?.role === 'assistant') {
        lastMsg.content += token;
      } else {
        messages.value.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: token,
          createdAt: new Date().toISOString(),
        });
      }
    });

    window.electronAPI.onDone(() => {
      isLoading.value = false;
    });

    window.electronAPI.onError((error: string) => {
      isLoading.value = false;
      messages.value.push({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `错误：${error}`,
        createdAt: new Date().toISOString(),
      });
    });
  }

  async function sendMessage(content: string) {
    if (!currentConversationId.value) {
      await newConversation();
    }

    // 添加用户消息
    messages.value.push({
      id: crypto.randomUUID(),
      conversationId: currentConversationId.value,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    });

    isLoading.value = true;

    try {
      await window.electronAPI.sendMessage(currentConversationId.value!, content);
    } catch (err: any) {
      isLoading.value = false;
      messages.value.push({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `错误：${err.message}`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  async function newConversation() {
    const conv = await window.electronAPI.newConversation();
    currentConversationId.value = conv.id;
    messages.value = [];
    await loadConversations();
  }

  async function loadConversations() {
    conversations.value = await window.electronAPI.getConversations();
  }

  async function selectConversation(id: string) {
    currentConversationId.value = id;
    messages.value = await window.electronAPI.getHistory(id);
  }

  return {
    messages,
    isLoading,
    currentConversationId,
    conversations,
    setupListeners,
    sendMessage,
    newConversation,
    loadConversations,
    selectConversation,
  };
});
```

## 7. 前端组件（ChatView）

```typescript
// renderer/src/views/ChatView.vue（关键部分）
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAgentStore } from '@/stores/agent';
import { storeToRefs } from 'pinia';

const agentStore = useAgentStore();
const { messages, isLoading } = storeToRefs(agentStore);
const inputText = ref('');

onMounted(() => {
  agentStore.setupListeners();
  agentStore.newConversation();
});

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isLoading.value) return;
  inputText.value = '';
  await agentStore.sendMessage(text);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}
</script>

<template>
  <div class="chat-view">
    <!-- 消息列表 -->
    <div class="messages">
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['message', msg.role]"
      >
        {{ msg.content }}
      </div>
      <div v-if="isLoading" class="loading">思考中...</div>
    </div>

    <!-- 输入框 -->
    <div class="input-area">
      <textarea
        v-model="inputText"
        placeholder="输入消息..."
        rows="1"
        :disabled="isLoading"
        @keydown="handleKeydown"
      />
      <button @click="handleSend" :disabled="!inputText.trim() || isLoading">
        发送
      </button>
    </div>
  </div>
</template>
```

## 8. 验证

### 完整流程测试

```
步骤：
  1. 启动应用（electron npm run dev）
  2. 打开 DevTools，确认无报错
  3. 打开 Vue DevTools
  4. 输入："你好"
  5. 看到 AI 回复（逐字出现）
  6. 关闭应用，重新打开
  7. 历史对话还在
```

### 预期结果

```
浏览器界面：
  - 聊天区域显示消息
  - 用户消息在右侧，AI 消息在左侧
  - 输入框可以输入
  - 发送后消息立即出现
  - AI 回复逐字出现
  - loading 状态正常

重启后：
  - 对话列表还在
  - 历史消息还在
```

---

## 完成后检查清单

```
✅ ipc/chat.handler.ts 已创建
✅ ipc/config.handler.ts 已创建
✅ preload.ts 已更新（暴露完整 API）
✅ main.ts 已更新（注册所有 IPC Handler）
✅ renderer/src/types/electron.d.ts 已创建
✅ renderer/src/stores/agent.ts 已创建
✅ renderer/src/views/ChatView.vue 已对接
✅ 完整对话流程跑通
✅ 重启后数据持久化
```

---

## MVP 完成！

```
恭喜！MVP 已完成。

现在你有一个可以：
  ✅ 打开 Electron 窗口
  ✅ 配置 API Key
  ✅ 和 AI 对话
  ✅ 保存对话历史
  ✅ 流式显示回复

接下来可以加的功能：
  - Claude 适配器
  - MCP 插件接入
  - Workflow 工作流
  - Agent Pet 动画
  - 工作流画布
  - Prompt 模板管理
  ...
```

---

*文档版本: v0.1.0 | 最后更新: 2026-05-26*
