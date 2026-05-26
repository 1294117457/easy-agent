# Step 4: IPC 打通

> 版本: v0.2.0 MVP
> 日期: 2026-05-26
> 前置：Step 3 LLM 对话已完成
> 目标：前端通过 IPC 调用 Core，Core 返回结果，前端渲染响应
> 架构: electron-vite，electron/ 目录（主进程）+ src/ 目录（渲染进程）

---

## 1. 创建 ipc/chat.handler.ts

**`electron/ipc/chat.handler.ts`**：

```typescript
import type { IpcMain, BrowserWindow } from 'electron';
import type { EasyAgentCore } from '../core/index.js';

export function registerChatHandlers(
  ipcMain: IpcMain,
  core: EasyAgentCore,
  mainWindow: BrowserWindow
) {
  ipcMain.handle(
    'chat:send',
    async (_, conversationId: string, message: string) => {
      return new Promise<void>((resolve, reject) => {
        core.sendMessage(conversationId, message, {
          onToken: (token) => {
            mainWindow.webContents.send('agent:token', token);
          },
          onDone: () => {
            mainWindow.webContents.send('agent:done', null);
            resolve();
          },
          onError: (error: string) => {
            mainWindow.webContents.send('agent:error', error);
            reject(new Error(error));
          },
        });
      });
    }
  );

  ipcMain.handle('chat:history', (_, conversationId: string) => {
    return core.getStorage().getMessages(conversationId);
  });

  ipcMain.handle('chat:conversations', () => {
    return core.getStorage().listConversations();
  });

  ipcMain.handle('chat:new', () => {
    return core.getStorage().createConversation({ name: '新对话' });
  });

  ipcMain.handle('chat:delete', (_, conversationId: string) => {
    return core.getStorage().deleteConversation(conversationId);
  });
}
```

---

## 2. 创建 ipc/config.handler.ts

**`electron/ipc/config.handler.ts`**：

```typescript
import type { IpcMain } from 'electron';
import type { IStoragePort } from '../core/index.js';

export function registerConfigHandlers(
  ipcMain: IpcMain,
  storage: IStoragePort
) {
  ipcMain.handle('config:get', () => {
    return {
      apiKeys: storage.listApiKeys(),
      prompts: storage.listPrompts(),
    };
  });

  ipcMain.handle(
    'config:apiKey:create',
    (_, data: { provider: string; key: string; model: string }) => {
      return storage.createApiKey(data);
    }
  );

  ipcMain.handle('config:apiKey:delete', (_, id: string) => {
    return storage.deleteApiKey(id);
  });

  ipcMain.handle(
    'config:prompt:create',
    (_, data: { name: string; description?: string; systemPrompt: string }) => {
      return storage.createPrompt(data);
    }
  );

  ipcMain.handle('config:prompt:delete', (_, id: string) => {
    return storage.deletePrompt(id);
  });
}
```

---

## 3. 更新 electron/preload.ts

**`electron/preload.ts`**：

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => 'pong',

  // 对话
  sendMessage: (conversationId: string, message: string) =>
    ipcRenderer.invoke('chat:send', conversationId, message),
  getHistory: (conversationId: string) =>
    ipcRenderer.invoke('chat:history', conversationId),
  getConversations: () => ipcRenderer.invoke('chat:conversations'),
  newConversation: () => ipcRenderer.invoke('chat:new'),
  deleteConversation: (conversationId: string) =>
    ipcRenderer.invoke('chat:delete', conversationId),

  // 配置
  getConfig: () => ipcRenderer.invoke('config:get'),
  createApiKey: (data: { provider: string; key: string; model: string }) =>
    ipcRenderer.invoke('config:apiKey:create', data),
  deleteApiKey: (id: string) => ipcRenderer.invoke('config:apiKey:delete', id),
  createPrompt: (data: { name: string; description?: string; systemPrompt: string }) =>
    ipcRenderer.invoke('config:prompt:create', data),
  deletePrompt: (id: string) => ipcRenderer.invoke('config:prompt:delete', id),

  // 事件推送
  onToken: (callback: (token: string) => void) =>
    ipcRenderer.on('agent:token', (_, token) => callback(token)),
  onDone: (callback: () => void) =>
    ipcRenderer.on('agent:done', () => callback()),
  onError: (callback: (error: string) => void) =>
    ipcRenderer.on('agent:error', (_, error) => callback(error)),
});
```

---

## 4. 更新 electron/main.ts

**`electron/main.ts`**（添加 IPC 注册调用）：

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { EasyAgentCore } from './core/index.js';
import { SQLiteAdapter } from './core/adapters/storage/sqlite.adapter.js';
import { registerChatHandlers } from './ipc/chat.handler.js';
import { registerConfigHandlers } from './ipc/config.handler.js';

let mainWindow: BrowserWindow | null = null;
let core: EasyAgentCore | null = null;

function getDbPath(): string {
  return join(app.getPath('userData'), 'data', 'easy-agent.db');
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // 注册 IPC Handler（core 已初始化）
  if (core) {
    registerChatHandlers(ipcMain, core, mainWindow);
    registerConfigHandlers(ipcMain, core.getStorage());
  }
}

app.whenReady().then(async () => {
  const storage = new SQLiteAdapter(getDbPath(), 'easy-agent-master-key');
  core = new EasyAgentCore(storage);
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

---

## 5. 创建 src/types/electron.d.ts

**`src/types/electron.d.ts`**：

```typescript
interface ElectronAPI {
  ping?(): string;
  sendMessage(conversationId: string, message: string): Promise<void>;
  getHistory(conversationId: string): Promise<any[]>;
  getConversations(): Promise<any[]>;
  newConversation(): Promise<{ id: string; name: string }>;
  deleteConversation(conversationId: string): Promise<boolean>;
  getConfig(): Promise<{ apiKeys: any[]; prompts: any[] }>;
  createApiKey(data: { provider: string; key: string; model: string }): Promise<any>;
  deleteApiKey(id: string): Promise<boolean>;
  createPrompt(data: { name: string; description?: string; systemPrompt: string }): Promise<any>;
  deletePrompt(id: string): Promise<boolean>;
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

---

## 6. 创建 src/api/chat.ts

**`src/api/chat.ts`**：

```typescript
export function setupChatListeners(callbacks: {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  window.electronAPI.onToken(callbacks.onToken);
  window.electronAPI.onDone(callbacks.onDone);
  window.electronAPI.onError(callbacks.onError);
}

export const chatApi = {
  send: (conversationId: string, message: string) =>
    window.electronAPI.sendMessage(conversationId, message),
  getHistory: (conversationId: string) =>
    window.electronAPI.getHistory(conversationId),
  getConversations: () => window.electronAPI.getConversations(),
  newConversation: () => window.electronAPI.newConversation(),
  deleteConversation: (id: string) =>
    window.electronAPI.deleteConversation(id),
};
```

---

## 7. 创建 src/stores/agent.ts

**`src/stores/agent.ts`**：

```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { chatApi, setupChatListeners } from '@/api/chat';

export const useAgentStore = defineStore('agent', () => {
  const messages = ref<any[]>([]);
  const isLoading = ref(false);
  const currentConversationId = ref<string | null>(null);
  const conversations = ref<any[]>([]);

  function setupListeners() {
    setupChatListeners({
      onToken: (token: string) => {
        const last = messages.value[messages.value.length - 1];
        if (last?.role === 'assistant') {
          last.content += token;
        } else {
          messages.value.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: token,
            createdAt: new Date().toISOString(),
          });
        }
      },
      onDone: () => { isLoading.value = false; },
      onError: (msg: string) => {
        isLoading.value = false;
        messages.value.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `错误：${msg}`,
          createdAt: new Date().toISOString(),
        });
      },
    });
  }

  async function sendMessage(content: string) {
    if (!currentConversationId.value) await newConversation();
    messages.value.push({
      id: crypto.randomUUID(),
      conversationId: currentConversationId.value,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    });
    isLoading.value = true;
    try {
      await chatApi.send(currentConversationId.value!, content);
    } catch { isLoading.value = false; }
  }

  async function newConversation() {
    const conv = await chatApi.newConversation();
    currentConversationId.value = conv.id;
    messages.value = [];
    await loadConversations();
    return conv;
  }

  async function loadConversations() {
    conversations.value = await chatApi.getConversations();
  }

  async function selectConversation(id: string) {
    currentConversationId.value = id;
    messages.value = await chatApi.getHistory(id);
  }

  return {
    messages, isLoading, currentConversationId, conversations,
    setupListeners, sendMessage, newConversation, loadConversations, selectConversation,
  };
});
```

---

## 8. 创建 src/api/config.ts

**`src/api/config.ts`**：

```typescript
export const configApi = {
  getConfig: () => window.electronAPI.getConfig(),
  createApiKey: (data: { provider: string; key: string; model: string }) =>
    window.electronAPI.createApiKey(data),
  deleteApiKey: (id: string) => window.electronAPI.deleteApiKey(id),
  createPrompt: (data: { name: string; description?: string; systemPrompt: string }) =>
    window.electronAPI.createPrompt(data),
  deletePrompt: (id: string) => window.electronAPI.deletePrompt(id),
};
```

---

## 9. 验证

```bash
npm run dev
```

### 完整流程测试

1. 打开 DevTools，确认无报错
2. 切换到设置页，添加 API Key
3. 切换到聊天页，输入"你好"
4. 看到 AI 回复（逐字出现）
5. 关闭应用，重新打开
6. 历史对话还在

---

## MVP 完成！

```
✅ npm run dev 单一命令启动
✅ Electron 窗口正常显示
✅ SQLite 存储能保存数据
✅ OpenAI 能调用
✅ IPC 打通，前端能调用后端
✅ 流式显示回复
✅ 重启后数据持久化

接下来可以加的功能：
  - Claude 适配器
  - MCP 插件接入
  - Workflow 工作流
  - Vue Flow 画布
  - Agent Pet 动画
  - Prompt 模板管理
```

---

## 完成后检查清单

```
✅ electron/ipc/chat.handler.ts 已创建
✅ electron/ipc/config.handler.ts 已创建
✅ electron/preload.ts 已更新
✅ electron/main.ts 已更新
✅ src/types/electron.d.ts 已创建
✅ src/api/chat.ts 已创建
✅ src/api/config.ts 已创建
✅ src/stores/agent.ts 已创建
✅ 完整对话流程跑通
✅ 重启后数据持久化
```

---

*文档版本: v0.2.0 | 最后更新: 2026-05-26*
