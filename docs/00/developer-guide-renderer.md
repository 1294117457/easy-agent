# EasyAgent 前端（Renderer）开发指南

> 版本: v0.1.0 MVP
> 日期: 2026-05-26
> 说明: 前端指 Electron Renderer Process 内的 Vue 3 应用
> 前置: 你有 Vue 3 / TS / Pinia 开发经验

---

## 0. 架构概览

```
Electron Renderer Process
├── Vue 3 应用
│   ├── 通过 window.electronAPI 调用主进程
│   ├── 本地缓存用 Pinia + localStorage（不直接用 IndexedDB）
│   └── 不直接访问数据库，只通过 IPC 和主进程通信
│
└── IPC 通信方式
    ├── window.electronAPI.xxx()  → 发起请求
    ├── window.electronAPI.onXxx() → 监听主进程推送
    └── 响应和推送都是异步的
```

**与之前 Web 版的差异**：
- 不再有 axios，不再有 HTTP 请求
- API 调用全部换成 `window.electronAPI`（由 preload 暴露）
- 不再有跨域问题，不在需要 Vite 代理
- SSE 流式推送变成 IPC 的 `onToken` 事件

---

## 1. 项目初始化

### 1.1 创建项目

```bash
cd easy-agent
npm create vite@latest renderer -- --template vue-ts
cd renderer
```

### 1.2 安装依赖

```bash
npm install \
  vue-router@4 \
  pinia \
  @vue-flow/core \
  @vue-flow/background \
  @vue-flow/controls \
  @vueuse/core \
  clsx
```

### 1.3 配置 Vite（适配 Electron）

```typescript
// renderer/vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  base: './',  // Electron 打包需要相对路径
  build: {
    outDir: '../electron/dist/renderer',  // 输出到 Electron 目录
    emptyOutDir: true,
  },
  server: {
    port: 5173,  // Vite Dev Server
  },
});
```

### 1.4 配置 Electron 类型声明

```typescript
// renderer/src/types/electron.d.ts
interface ElectronAPI {
  sendMessage: (message: string) => Promise<string>;  // 返回 conversationId
  onToken: (cb: (token: string) => void) => void;
  onToolCall: (cb: (data: { serverId: string; toolName: string; arguments: any }) => void) => void;
  onDone: (cb: () => void) => void;
  onError: (cb: (msg: string) => void) => void;
  onStatusChange: (cb: (status: string) => void) => void;

  getConfig: () => Promise<{
    apiKeys: any[];
    prompts: any[];
    mcpServers: any[];
  }>;
  createApiKey: (data: { provider: string; key: string; model: string }) => Promise<any>;
  deleteApiKey: (id: string) => Promise<void>;
  createPrompt: (data: { name: string; description?: string; systemPrompt: string }) => Promise<any>;
  deletePrompt: (id: string) => Promise<void>;

  connectMcp: (config: any) => Promise<any>;
  disconnectMcp: (id: string) => Promise<void>;
  listMcpServers: () => Promise<any[]>;
  listMcpTools: (serverId: string) => Promise<any[]>;

  listWorkflows: () => Promise<any[]>;
  saveWorkflow: (data: any) => Promise<any>;
  deleteWorkflow: (id: string) => Promise<void>;
  executeWorkflow: (id: string, input: any) => Promise<any>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
```

---

## 2. 目录结构

```
renderer/src/
├── main.ts
├── App.vue
├── router/
│   └── index.ts
├── views/
│   ├── ChatView.vue
│   ├── FlowView.vue
│   ├── PluginView.vue
│   ├── SettingsView.vue
│   └── HistoryView.vue
├── components/
│   ├── AgentPet/
│   │   ├── AgentPet.vue
│   │   └── PetStates.ts
│   ├── FlowCanvas/
│   │   ├── FlowCanvas.vue
│   │   ├── InputNode.vue
│   │   ├── LLMNode.vue
│   │   ├── MCPToolNode.vue
│   │   └── OutputNode.vue
│   ├── Sidebar.vue
│   ├── MessageBubble.vue
│   └── ...
├── stores/              # Pinia Store
│   ├── agent.ts         # 对话 + Agent Pet 状态
│   ├── plugin.ts        # MCP 插件
│   ├── workflow.ts      # 工作流
│   ├── conversation.ts  # 对话历史
│   └── prompt.ts        # Prompt 模板
├── api/                 # IPC 封装（调用 electronAPI）
│   ├── chat.ts
│   ├── config.ts
│   ├── mcp.ts
│   └── workflow.ts
├── types/
│   ├── electron.d.ts   # ElectronAPI 类型声明
│   ├── agent.ts
│   ├── workflow.ts
│   └── ...
└── styles/
    ├── variables.css
    └── global.css
```

---

## 3. 分步实现

### Step 1: IPC API 封装

之前 Web 版的 axios 实例，在这里换成 `window.electronAPI` 封装。

**`renderer/src/api/chat.ts`**：

```typescript
// renderer/src/api/chat.ts

// 注册 IPC 监听（全局只需注册一次）
export function setupChatListeners(
  callbacks: {
    onToken: (token: string) => void;
    onToolCall: (data: { serverId: string; toolName: string; args: any }) => void;
    onDone: () => void;
    onError: (msg: string) => void;
    onStatusChange: (status: string) => void;
  }
) {
  window.electronAPI.onToken(callbacks.onToken);
  window.electronAPI.onToolCall(callbacks.onToolCall);
  window.electronAPI.onDone(callbacks.onDone);
  window.electronAPI.onError(callbacks.onError);
  window.electronAPI.onStatusChange(callbacks.onStatusChange);
}

export const chatApi = {
  send: (message: string): Promise<string> => {
    return window.electronAPI.sendMessage(message);
  },
};
```

**`renderer/src/api/config.ts`**：

```typescript
// renderer/src/api/config.ts
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

**`renderer/src/api/mcp.ts`**：

```typescript
// renderer/src/api/mcp.ts
export const mcpApi = {
  connect: (config: { name: string; type: 'stdio' | 'sse'; command?: string; url?: string }) =>
    window.electronAPI.connectMcp(config),
  disconnect: (id: string) => window.electronAPI.disconnectMcp(id),
  listServers: () => window.electronAPI.listMcpServers(),
  listTools: (serverId: string) => window.electronAPI.listMcpTools(serverId),
};
```

**`renderer/src/api/workflow.ts`**：

```typescript
// renderer/src/api/workflow.ts
export const workflowApi = {
  list: () => window.electronAPI.listWorkflows(),
  save: (data: any) => window.electronAPI.saveWorkflow(data),
  delete: (id: string) => window.electronAPI.deleteWorkflow(id),
  execute: (id: string, input: any) => window.electronAPI.executeWorkflow(id, input),
};
```

### Step 2: Pinia Store（与之前 Web 版结构完全一致）

**`renderer/src/stores/agent.ts`**：

```typescript
// renderer/src/stores/agent.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Message, PetMood } from '@/types/agent';
import { chatApi, setupChatListeners } from '@/api/chat';
import { useConversationStore } from './conversation';

export const useAgentStore = defineStore('agent', () => {
  const petMood = ref<PetMood>('idle');
  const isLoading = ref(false);
  const conversationStore = useConversationStore();

  // 初始化 IPC 监听（只注册一次）
  setupChatListeners({
    onToken: (token) => {
      // 流式追加 token 到最后一条消息
      const msgs = conversationStore.messages;
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        last.content += token;
      } else {
        conversationStore.appendMessage({
          id: crypto.randomUUID(), conversationId: conversationStore.currentConversationId || '',
          role: 'assistant', content: token, createdAt: new Date().toISOString(),
        });
      }
    },
    onToolCall: () => { petMood.value = 'working'; },
    onDone: () => { petMood.value = 'happy'; isLoading.value = false; },
    onError: () => { petMood.value = 'error'; isLoading.value = false; },
    onStatusChange: (status) => { petMood.value = status as PetMood; },
  });

  async function sendMessage(content: string) {
    if (!conversationStore.currentConversationId) {
      await conversationStore.createConversation();
    }

    // 保存用户消息
    conversationStore.appendMessage({
      id: crypto.randomUUID(),
      conversationId: conversationStore.currentConversationId || '',
      role: 'user', content, createdAt: new Date().toISOString(),
    });

    petMood.value = 'thinking';
    isLoading.value = true;

    try {
      await chatApi.send(content);
    } catch (err: any) {
      petMood.value = 'error';
      conversationStore.appendMessage({
        id: crypto.randomUUID(),
        conversationId: conversationStore.currentConversationId || '',
        role: 'assistant',
        content: `出错了: ${err.message}`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  function setMood(mood: PetMood) { petMood.value = mood; }

  return { petMood, isLoading, sendMessage, setMood };
});
```

**`renderer/src/stores/conversation.ts`**：

```typescript
// renderer/src/stores/conversation.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Conversation, Message } from '@/types/agent';

export const useConversationStore = defineStore('conversation', () => {
  const conversations = ref<Conversation[]>([]);
  const currentConversationId = ref<string | null>(null);
  const messages = ref<Message[]>([]);

  const currentConversation = computed(() =>
    conversations.value.find(c => c.id === currentConversationId.value) ?? null
  );

  function appendMessage(msg: Message) {
    messages.value.push(msg);
  }

  async function createConversation(name?: string) {
    // Electron IPC 方式：直接创建，不走 HTTP
    // 这里需要前端自己维护 ID（因为 SQLite 在主进程）
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const conv: Conversation = { id, name: name || '新对话', createdAt: now, updatedAt: now };
    conversations.value.unshift(conv);
    currentConversationId.value = id;
    messages.value = [];
    return conv;
  }

  async function selectConversation(id: string) {
    currentConversationId.value = id;
    messages.value = [];
    // TODO: 从 SQLite 加载历史消息（IPC 调用）
  }

  return {
    conversations, currentConversationId, messages, currentConversation,
    appendMessage, createConversation, selectConversation,
  };
});
```

### Step 3: CSS 变量和布局

与之前 Web 版完全一致，此处省略。只需确保 `vite.config.ts` 中的 `base: './'` 配置正确。

### Step 4: 路由和 App 布局

**`renderer/src/router/index.ts`**：

```typescript
// renderer/src/router/index.ts
import { createRouter, createWebHashHistory } from 'vue-router';  // Hash 模式更适配 Electron

export default createRouter({
  history: createWebHashHistory(),  // Electron 打包后用 Hash 路由避免需要服务器配置
  routes: [
    { path: '/', redirect: '/chat' },
    { path: '/chat', component: () => import('@/views/ChatView.vue') },
    { path: '/flow', component: () => import('@/views/FlowView.vue') },
    { path: '/plugins', component: () => import('@/views/PluginView.vue') },
    { path: '/settings', component: () => import('@/views/SettingsView.vue') },
    { path: '/history', component: () => import('@/views/HistoryView.vue') },
  ],
});
```

> **注意**：Electron 打包后没有 Web 服务器，路由模式用 `createWebHashHistory()`（Hash 路由），避免刷新后 404。

**`renderer/src/App.vue`**：

```vue
<!-- renderer/src/App.vue -->
<script setup lang="ts">
import { RouterView } from 'vue-router';
import Sidebar from '@/components/Sidebar.vue';
import AgentPet from '@/components/AgentPet/AgentPet.vue';
</script>

<template>
  <div class="app-layout">
    <Sidebar />
    <main class="main-content">
      <RouterView />
    </main>
    <aside class="agent-panel">
      <AgentPet />
    </aside>
  </div>
</template>

<style scoped>
.app-layout { display: grid; grid-template-columns: 200px 1fr 240px; height: 100vh; overflow: hidden; }
.main-content { overflow: auto; }
.agent-panel {
  background: var(--color-bg-elevated); border-left: 1px solid var(--color-border);
  display: flex; align-items: flex-start; justify-content: center; padding-top: 24px;
}
</style>
```

### Step 5: 对话视图（核心变化：不再有 SSE，改为 IPC 推送）

**`renderer/src/views/ChatView.vue`**：

```vue
<!-- renderer/src/views/ChatView.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAgentStore } from '@/stores/agent';
import { useConversationStore } from '@/stores/conversation';
import { storeToRefs } from 'pinia';
import MessageBubble from '@/components/MessageBubble.vue';

const agentStore = useAgentStore();
const conversationStore = useConversationStore();
const { messages, currentConversation } = storeToRefs(conversationStore);
const { isLoading } = storeToRefs(agentStore);
const inputText = ref('');

onMounted(async () => {
  if (!conversationStore.currentConversationId) {
    await conversationStore.createConversation();
  }
});

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isLoading.value) return;
  inputText.value = '';
  await agentStore.sendMessage(text);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
}
</script>

<template>
  <div class="chat-view">
    <!-- 对话标题栏 -->
    <div class="chat-header">
      <span class="chat-title">{{ currentConversation?.name || '新对话' }}</span>
      <button class="new-chat-btn" @click="conversationStore.createConversation()">+ 新对话</button>
    </div>

    <!-- 消息列表 -->
    <div class="messages">
      <div v-if="messages.length === 0" class="empty-state">
        <p>你好！我是 EasyAgent</p>
        <p>告诉我你想做什么，我来帮你完成。</p>
      </div>
      <MessageBubble v-for="msg in messages" :key="msg.id" :message="msg" />
      <div v-if="isLoading" class="loading-dots">
        <span /><span /><span />
      </div>
    </div>

    <!-- 输入框 -->
    <div class="input-area">
      <textarea v-model="inputText" class="input-box" placeholder="输入消息..." rows="1"
        :disabled="isLoading" @keydown="handleKeydown" />
      <button class="send-btn" :disabled="!inputText.trim() || isLoading" @click="handleSend">
        发送
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 与之前 Web 版一致 */
</style>
```

### Step 6: 设置视图（含 API Key 和 Prompt 管理）

**`renderer/src/views/SettingsView.vue`**：

```vue
<!-- renderer/src/views/SettingsView.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { configApi } from '@/api/config';

const apiKeys = ref<any[]>([]);
const prompts = ref<any[]>([]);
const newKeyForm = ref({ provider: 'openai', key: '', model: 'gpt-4o' });
const newPromptForm = ref({ name: '', description: '', systemPrompt: '' });

onMounted(async () => {
  const config = await configApi.getConfig();
  apiKeys.value = config.apiKeys;
  prompts.value = config.prompts;
});

async function handleAddKey() {
  const created = await configApi.createApiKey(newKeyForm.value);
  apiKeys.value.push(created);
  newKeyForm.value = { provider: 'openai', key: '', model: 'gpt-4o' };
}

async function handleDeleteKey(id: string) {
  await configApi.deleteApiKey(id);
  apiKeys.value = apiKeys.value.filter(k => k.id !== id);
}

async function handleAddPrompt() {
  const created = await configApi.createPrompt(newPromptForm.value);
  prompts.value.push(created);
  newPromptForm.value = { name: '', description: '', systemPrompt: '' };
}
</script>

<template>
  <div class="settings-view">
    <h2>设置</h2>

    <!-- API Key -->
    <section class="section">
      <h3>API Key 配置</h3>
      <div v-for="key in apiKeys" :key="key.id" class="item-row">
        <span>{{ key.provider }} / {{ key.model }}</span>
        <button @click="handleDeleteKey(key.id)">删除</button>
      </div>
      <div class="form-row">
        <select v-model="newKeyForm.provider">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
        <input v-model="newKeyForm.key" placeholder="sk-..." />
        <input v-model="newKeyForm.model" placeholder="gpt-4o" />
        <button @click="handleAddKey">添加</button>
      </div>
    </section>

    <!-- Prompt 模板 -->
    <section class="section">
      <h3>Prompt 模板</h3>
      <div v-for="p in prompts" :key="p.id" class="item-row">
        <span>{{ p.name }}</span>
        <button @click="configApi.deletePrompt(p.id); prompts = prompts.filter(x => x.id !== p.id)">删除</button>
      </div>
      <div class="form-column">
        <input v-model="newPromptForm.name" placeholder="模板名称" />
        <input v-model="newPromptForm.description" placeholder="描述" />
        <textarea v-model="newPromptForm.systemPrompt" placeholder="System Prompt..." rows="4" />
        <button @click="handleAddPrompt">保存</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-view { padding: 24px; }
.section { margin-bottom: 32px; }
.section h3 { margin-bottom: 12px; color: var(--color-text-secondary); }
.item-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; }
.form-row { display: flex; gap: 8px; margin-top: 8px; }
.form-column { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
input, select, textarea {
  padding: 8px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-bg-surface); color: var(--color-text);
}
button { padding: 8px 16px; background: var(--color-primary); color: white; border-radius: var(--radius-md); }
</style>
```

### Step 7: 流程编排视图（与之前 Web 版一致）

Vue Flow 的用法在 Electron 环境下完全不变，此处省略。FlowView + 节点组件与之前 Web 版完全一致。

---

## 4. 启动和验证

```bash
# 终端 1：启动 Vite Dev Server（前端开发）
cd renderer && npm run dev

# 终端 2：启动 Electron（主进程）
cd electron && npm run dev
```

验证清单：
- [ ] Electron 窗口打开
- [ ] 前端页面渲染正常
- [ ] 打开 DevTools（F12 或 Cmd+Opt+I）
- [ ] 切换到设置页，添加一个 API Key
- [ ] 切换到聊天页，发送消息，确认有回复

---

## 5. 关键差异总结

| 对比项 | 之前 Web 版 | Electron 版 |
|-------|-----------|------------|
| HTTP 请求 | axios | `window.electronAPI` |
| SSE 流式 | EventSource / fetch 流 | IPC `onToken` 事件 |
| 跨域 | 需要 Vite 代理 | 不存在跨域 |
| 路由模式 | History | **Hash** |
| 数据库 | 远程 SQLite | 本地 SQLite（主进程） |
| 前端调试 | 浏览器 DevTools | Electron 内置 DevTools |

---

*文档版本: v0.1.0 | 最后更新: 2026-05-26*
