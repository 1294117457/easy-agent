# EasyAgent 前端（Renderer）开发指南

> 版本: v0.2.0 MVP
> 日期: 2026-05-26
> 说明: 前端指 Electron Renderer Process 内的 Vue 3 应用
> 前置: 你有 Vue 3 / TS / Pinia 开发经验
> 架构: electron-vite 单项目，代码位于 `src/`

---

## 0. 架构概览

```
easy-agent/
├── src/                          # 渲染进程 Vue 源码
│   ├── main.ts                  # Vue 入口
│   ├── App.vue                  # 根组件
│   ├── style.css                # 全局样式
│   ├── components/
│   │   └── Sidebar.vue          # 侧边栏
│   ├── views/
│   │   ├── ChatView.vue         # 对话视图
│   │   ├── FlowView.vue         # 工作流视图
│   │   ├── PluginView.vue       # 插件视图
│   │   ├── SettingsView.vue     # 设置视图
│   │   └── HistoryView.vue       # 历史视图
│   ├── stores/
│   │   └── agent.ts             # Pinia Store
│   ├── api/
│   │   ├── chat.ts              # IPC 对话 API
│   │   └── config.ts            # IPC 配置 API
│   └── types/
│       └── electron.d.ts         # ElectronAPI 类型声明
│
├── index.html                    # HTML 入口
├── electron.vite.config.ts      # electron-vite 配置
└── tsconfig.web.json            # 渲染进程 TypeScript 配置
```

**通信模型**：

```
Renderer Process (src/)
        │
        │ window.electronAPI.xxx()  ← 发起请求（invoke）
        │ window.electronAPI.onXxx() ← 监听主进程推送
        │
        ▼
Preload Bridge (electron/preload.ts → dist/preload/index.js)
        │
        │ IPC
        ▼
Main Process (electron/main.ts → dist/main/main.js)
```

**与之前 packages 结构的差异**：

| 对比项 | 旧架构（packages/renderer） | 新架构（electron-vite） |
|--------|--------------------------|----------------------|
| 项目根目录 | `packages/renderer/` | 项目根目录 |
| HTML 入口 | `packages/renderer/index.html` | 根目录 `index.html` |
| 构建配置 | 独立 `vite.config.ts` | `electron.vite.config.ts` 中的 `renderer` 字段 |
| Dev Server | 独立运行 `npm run dev` | 由 `electron-vite dev` 统一启动 |
| 类型声明来源 | 手动维护 `preload.d.ts` | `electron/preload.ts` 编译自动推断 |

---

## 1. 项目初始化

### 1.1 创建项目

electron-vite 初始化（已有项目则跳过）：

```bash
npm create @electron-vite/quick-start@latest
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

### 1.3 electron-vite 配置（electron.vite.config.ts）

```typescript
import { defineConfig } from 'electron-vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'electron/main.ts'),
          preload: resolve(__dirname, 'electron/preload.ts'),
        },
        output: { entryFileNames: '[name]/[name].js' },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload.ts'),
        output: { entryFileNames: 'preload/index.js' },
      },
    },
  },
  renderer: {
    plugins: [vue()],
    resolve: { alias: { '@': resolve(__dirname, 'src') } },
  },
});
```

### 1.4 配置 Electron 类型声明

**`src/types/electron.d.ts`**：

```typescript
interface ElectronAPI {
  ping?(): string;
  sendMessage(conversationId: string, message: string): Promise<void>;
  getHistory(conversationId: string): Promise<any[]>;
  getConversations(): Promise<any[]>;
  newConversation(): Promise<{ id: string; name: string }>;
  deleteConversation(id: string): Promise<boolean>;
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

## 2. 分步实现

### Step 1: IPC API 封装

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

### Step 2: Pinia Store

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
      onToken: (token) => {
        const last = messages.value[messages.value.length - 1];
        if (last?.role === 'assistant') {
          last.content += token;
        } else {
          messages.value.push({ id: crypto.randomUUID(), role: 'assistant', content: token, createdAt: new Date().toISOString() });
        }
      },
      onDone: () => { isLoading.value = false; },
      onError: (msg) => {
        isLoading.value = false;
        messages.value.push({ id: crypto.randomUUID(), role: 'assistant', content: `错误：${msg}`, createdAt: new Date().toISOString() });
      },
    });
  }

  async function sendMessage(content: string) {
    if (!currentConversationId.value) await newConversation();
    messages.value.push({ id: crypto.randomUUID(), conversationId: currentConversationId.value, role: 'user', content, createdAt: new Date().toISOString() });
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

  return { messages, isLoading, currentConversationId, conversations, setupListeners, sendMessage, newConversation, loadConversations, selectConversation };
});
```

### Step 3: 路由和 App 布局

**`src/main.ts`**：

```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './style.css';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/chat' },
    { path: '/chat', component: () => import('./views/ChatView.vue') },
    { path: '/flow', component: () => import('./views/FlowView.vue') },
    { path: '/plugins', component: () => import('./views/PluginView.vue') },
    { path: '/settings', component: () => import('./views/SettingsView.vue') },
    { path: '/history', component: () => import('./views/HistoryView.vue') },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
```

> **注意**：Electron 打包后没有 Web 服务器，路由模式用 `createWebHashHistory()`（Hash 路由），避免刷新后 404。

**`src/App.vue`**：

```vue
<script setup lang="ts">
import { RouterView } from 'vue-router';
import Sidebar from './components/Sidebar.vue';
</script>

<template>
  <div class="app-layout">
    <Sidebar />
    <main class="main-content">
      <RouterView />
    </main>
    <aside class="agent-panel">
      <div class="pet-placeholder">Agent Pet</div>
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

### Step 4: 对话视图

**`src/views/ChatView.vue`**（核心变化：不再有 SSE，改为 IPC 推送）：

```vue
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
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
}
</script>

<template>
  <div class="chat-view">
    <div class="messages">
      <div v-if="messages.length === 0" class="empty-state">
        <p>你好！我是 EasyAgent</p>
        <p>告诉我你想做什么，我来帮你完成。</p>
      </div>
      <div v-for="msg in messages" :key="msg.id" :class="['message', msg.role]">
        <div class="bubble">{{ msg.content }}</div>
      </div>
      <div v-if="isLoading" class="loading"><span class="dot" /><span class="dot" /><span class="dot" /></div>
    </div>
    <div class="input-area">
      <textarea v-model="inputText" class="input-box" placeholder="输入消息..." rows="1"
        :disabled="isLoading" @keydown="handleKeydown" />
      <button class="send-btn" :disabled="!inputText.trim() || isLoading" @click="handleSend">发送</button>
    </div>
  </div>
</template>
```

### Step 5: 设置视图

**`src/views/SettingsView.vue`**（含 API Key 和 Prompt 管理）：

```vue
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
    <section class="section">
      <h3>API Key 配置</h3>
      <div v-for="key in apiKeys" :key="key.id" class="item-row">
        <span>{{ key.provider }} / {{ key.model }}</span>
        <button class="danger" @click="handleDeleteKey(key.id)">删除</button>
      </div>
      <div class="form-row">
        <select v-model="newKeyForm.provider">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
        <input v-model="newKeyForm.key" placeholder="sk-..." />
        <input v-model="newKeyForm.model" placeholder="gpt-4o" style="width: 120px" />
        <button @click="handleAddKey">添加</button>
      </div>
    </section>
    <section class="section">
      <h3>Prompt 模板</h3>
      <div v-for="p in prompts" :key="p.id" class="item-row">
        <span>{{ p.name }}</span>
        <button class="danger" @click="configApi.deletePrompt(p.id); prompts = prompts.filter(x => x.id !== p.id)">删除</button>
      </div>
      <div class="form-column">
        <input v-model="newPromptForm.name" placeholder="模板名称" />
        <input v-model="newPromptForm.description" placeholder="描述（可选）" />
        <textarea v-model="newPromptForm.systemPrompt" placeholder="System Prompt..." rows="4" />
        <button @click="handleAddPrompt">保存</button>
      </div>
    </section>
  </div>
</template>
```

---

## 3. 启动和验证

```bash
# 单一命令
npm run dev
```

验证清单：
- [ ] Electron 窗口打开
- [ ] 前端页面渲染正常
- [ ] 打开 DevTools（F12 或 Cmd+Opt+I）
- [ ] 切换到设置页，添加一个 API Key
- [ ] 切换到聊天页，发送消息，确认有回复

---

## 4. 关键差异总结

| 对比项 | 之前 Web 版 | Electron 版 |
|--------|-----------|------------|
| HTTP 请求 | axios | `window.electronAPI` |
| SSE 流式 | EventSource / fetch 流 | IPC `onToken` 事件 |
| 跨域 | 需要 Vite 代理 | 不存在跨域 |
| 路由模式 | History | **Hash** |
| 数据库 | 远程 SQLite | 本地 SQLite（主进程） |
| 前端调试 | 浏览器 DevTools | Electron 内置 DevTools |
| Dev 启动 | 两个终端 | **单一命令** |

---

*文档版本: v0.2.0 | 最后更新: 2026-05-26*
