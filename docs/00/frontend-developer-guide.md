# EasyAgent 前端开发指南

> 版本: v0.1.0 MVP
> 日期: 2026-05-25
> 目标: 搭建 Vue 3 + TypeScript + Pinia + Vue Flow 前端应用

---

## 0. 架构概览（与已有知识的对照）

你已经熟悉 Vue + TS 开发，本项目的架构和你之前的项目高度一致：

| 你已有的经验 | 本项目的选择 | 说明 |
|------------|------------|------|
| Vue 3 + TS | 完全一致 | 组合式 API |
| Pinia | 完全一致 | 状态管理 |
| Vue Router | 完全一致 | 页面路由 |
| axios | axios | HTTP 请求 |
| CSS / Scoped CSS | 纯 CSS 变量 + Scoped | 不引入 Tailwind |

新增的内容：
- **Vue Flow**：可视化流程编排画布（新增）
- **SSE 流式对话**：用 `EventSource` 或原生 fetch 接收 SSE 流（新增）
- **Pinia Store 作为前后端中介**：Store 持有状态，调用 API，更新状态，组件只负责渲染

整体分层：**Component（视图）→ Store（Pinia）→ API（axios）→ Backend**，和你之前的项目结构一致。

---

## 1. 项目初始化

### 1.1 创建项目

```bash
npm create vite@latest packages/frontend -- --template vue-ts
cd packages/frontend
```

### 1.2 安装依赖

```bash
# 核心依赖
npm install \
  vue-router@4 \
  pinia \
  axios

# 流程图画布
npm install \
  @vue-flow/core \
  @vue-flow/background \
  @vue-flow/controls

# 可选工具类
npm install \
  clsx \
  tailwind-merge \
  @vueuse/core
```

### 1.3 配置路径别名

编辑 `vite.config.ts`：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
```

同步更新 `tsconfig.json` 中的 `paths`。

---

## 2. 目录结构

```
frontend/src/
├── main.ts
├── App.vue
├── router/
│   └── index.ts
├── views/
│   ├── ChatView.vue       # 对话主界面
│   ├── PluginView.vue     # 插件管理
│   ├── FlowView.vue       # 流程编排
│   ├── SettingsView.vue    # 设置（API Key + 模型）
│   └── HistoryView.vue    # 对话历史（新增）
├── components/
│   ├── AgentPet/
│   │   ├── AgentPet.vue
│   │   ├── PetBody.vue
│   │   ├── PetFace.vue
│   │   ├── PetAnimation.vue
│   │   └── PetStates.ts
│   ├── FlowCanvas/
│   │   ├── FlowCanvas.vue
│   │   ├── InputNode.vue
│   │   ├── LLMNode.vue
│   │   ├── MCPToolNode.vue
│   │   └── OutputNode.vue
│   ├── Sidebar.vue
│   ├── MessageBubble.vue
│   ├── PromptEditor.vue    # Prompt 模板编辑器（新增）
│   └── ConversationItem.vue # 历史对话列表项（新增）
├── stores/
│   ├── agent.ts           # 对话状态 + Agent Pet 心态
│   ├── plugin.ts         # MCP 插件状态
│   ├── workflow.ts        # 工作流状态
│   ├── conversation.ts    # 对话历史（新增）
│   └── prompt.ts          # Prompt 模板（新增）
├── api/
│   ├── client.ts
│   ├── keys.ts
│   ├── mcp.ts
│   ├── workflow.ts
│   ├── chat.ts           # 含 SSE 流式请求
│   ├── conversation.ts   # 对话 CRUD（新增）
│   └── prompt.ts          # Prompt CRUD（新增）
├── composables/
│   ├── useAgent.ts       # Agent 交互逻辑（含 SSE）
│   └── useFlow.ts
├── types/
│   ├── agent.ts
│   ├── workflow.ts
│   ├── mcp.ts
│   ├── api-key.ts
│   ├── conversation.ts   # 对话类型（新增）
│   └── prompt.ts          # Prompt 类型（新增）
└── styles/
    ├── variables.css
    └── global.css
```

---

## 3. 分步实现

### Step 1: CSS 变量和全局样式

```css
/* src/styles/variables.css */
:root {
  --color-bg: #1a1a2e;
  --color-bg-elevated: #1e1e2e;
  --color-bg-surface: #252536;
  --color-bg-hover: #2d2d44;
  --color-text: #ffffff;
  --color-text-secondary: #9CA3AF;
  --color-text-muted: #6B7280;
  --color-border: #2a2a3e;
  --color-primary: #4A90D9;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-purple: #8B5CF6;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

```css
/* src/styles/global.css */
@import './variables.css';
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { width: 100%; height: 100%; overflow: hidden; }
body { font-family: system-ui, sans-serif; background-color: var(--color-bg); color: var(--color-text); }
```

### Step 2: TypeScript 类型（含新增模块）

**`src/types/conversation.ts`**（新增）：

```typescript
// src/types/conversation.ts
export interface Conversation {
  id: string;
  name: string;
  workflowId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  createdAt: string;
}
```

**`src/types/prompt.ts`**（新增）：

```typescript
// src/types/prompt.ts
export interface Prompt {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Step 3: API 层（含对话历史和 Prompt）

**`src/api/chat.ts`**（含 SSE 流式请求）：

```typescript
// src/api/chat.ts
import client from './client';

export const chatApi = {
  send: (conversationId: string, message: string, model?: string) =>
    client.post<{ response: string }>('/chat', { conversationId, message, model })
      .then(r => r.data.response),

  // SSE 流式发送，返回 EventSource 或 fetch ReadableStream
  sendStream: (
    conversationId: string,
    message: string,
    model?: string,
    callbacks?: {
      onToken?: (token: string) => void;
      onToolCall?: (data: any) => void;
      onDone?: () => void;
      onError?: (err: string) => void;
    }
  ) => {
    return fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, message, model }),
    }).then(response => {
      const reader = response.body?.getReader();
      if (!reader) { callbacks?.onError?.('No response body'); return; }

      const decoder = new TextDecoder();
      let buffer = '';

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          // 按 SSE 事件解析
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const eventType = line.slice(7);
              continue;
            }
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'token') callbacks?.onToken?.(data.content);
              if (eventType === 'tool_call') callbacks?.onToolCall?.(data);
              if (eventType === 'done') callbacks?.onDone?.();
              if (eventType === 'error') callbacks?.onError?.(data.message);
            }
          }
          read();
        });
      }

      read();
    });
  },
};
```

**`src/api/conversation.ts`**（新增）：

```typescript
// src/api/conversation.ts
import client from './client';
import type { Conversation, Message } from '@/types/conversation';

export const conversationApi = {
  list: () => client.get<Conversation[]>('/conversations').then(r => r.data),
  create: (name?: string) =>
    client.post<Conversation>('/conversations', { name }).then(r => r.data),
  getMessages: (id: string) =>
    client.get<Message[]>(`/conversations/${id}/messages`).then(r => r.data),
  rename: (id: string, name: string) =>
    client.patch(`/conversations/${id}`, { name }),
  delete: (id: string) => client.delete(`/conversations/${id}`),
};
```

**`src/api/prompt.ts`**（新增）：

```typescript
// src/api/prompt.ts
import client from './client';
import type { Prompt } from '@/types/prompt';

export const promptApi = {
  list: () => client.get<Prompt[]>('/prompts').then(r => r.data),
  create: (data: { name: string; description?: string; systemPrompt: string }) =>
    client.post<Prompt>('/prompts', data).then(r => r.data),
  update: (id: string, data: Partial<{ name: string; description: string; systemPrompt: string }>) =>
    client.put(`/prompts/${id}`, data),
  delete: (id: string) => client.delete(`/prompts/${id}`),
};
```

### Step 4: Pinia Store（含对话历史和 Prompt）

**`src/stores/conversation.ts`**（新增）：

```typescript
// src/stores/conversation.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Conversation, Message } from '@/types/conversation';
import { conversationApi } from '@/api/conversation';

export const useConversationStore = defineStore('conversation', () => {
  const conversations = ref<Conversation[]>([]);
  const currentConversationId = ref<string | null>(null);
  const messages = ref<Message[]>([]);

  const currentConversation = computed(() =>
    conversations.value.find(c => c.id === currentConversationId.value) ?? null
  );

  async function loadConversations() {
    conversations.value = await conversationApi.list();
  }

  async function createConversation(name?: string) {
    const conv = await conversationApi.create(name);
    conversations.value.unshift(conv);
    selectConversation(conv.id);
    return conv;
  }

  async function selectConversation(id: string) {
    currentConversationId.value = id;
    messages.value = await conversationApi.getMessages(id);
  }

  async function renameConversation(id: string, name: string) {
    await conversationApi.rename(id, name);
    const conv = conversations.value.find(c => c.id === id);
    if (conv) conv.name = name;
  }

  async function deleteConversation(id: string) {
    await conversationApi.delete(id);
    conversations.value = conversations.value.filter(c => c.id !== id);
    if (currentConversationId.value === id) {
      currentConversationId.value = null;
      messages.value = [];
    }
  }

  function appendMessage(msg: Message) {
    messages.value.push(msg);
  }

  return {
    conversations, currentConversationId, messages, currentConversation,
    loadConversations, createConversation, selectConversation,
    renameConversation, deleteConversation, appendMessage,
  };
});
```

**`src/stores/prompt.ts`**（新增）：

```typescript
// src/stores/prompt.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Prompt } from '@/types/prompt';
import { promptApi } from '@/api/prompt';

export const usePromptStore = defineStore('prompt', () => {
  const prompts = ref<Prompt[]>([]);
  const activePromptId = ref<string | null>(null);

  async function loadPrompts() {
    prompts.value = await promptApi.list();
    if (prompts.value.length > 0 && !activePromptId.value) {
      activePromptId.value = prompts.value[0].id;
    }
  }

  async function createPrompt(data: { name: string; description?: string; systemPrompt: string }) {
    const prompt = await promptApi.create(data);
    prompts.value.unshift(prompt);
    return prompt;
  }

  async function updatePrompt(id: string, data: Partial<{ name: string; description: string; systemPrompt: string }>) {
    await promptApi.update(id, data);
    const p = prompts.value.find(p => p.id === id);
    if (p) Object.assign(p, data);
  }

  async function deletePrompt(id: string) {
    await promptApi.delete(id);
    prompts.value = prompts.value.filter(p => p.id !== id);
    if (activePromptId.value === id) activePromptId.value = null;
  }

  function setActive(id: string) { activePromptId.value = id; }

  return { prompts, activePromptId, loadPrompts, createPrompt, updatePrompt, deletePrompt, setActive };
});
```

**`src/stores/agent.ts`**（升级，支持 SSE）：

```typescript
// src/stores/agent.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Message, PetMood } from '@/types/agent';
import { chatApi } from '@/api/chat';
import { useConversationStore } from './conversation';

export const useAgentStore = defineStore('agent', () => {
  const petMood = ref<PetMood>('idle');
  const isLoading = ref(false);

  const conversationStore = useConversationStore();

  async function sendMessage(content: string) {
    const convId = conversationStore.currentConversationId;
    if (!convId) {
      await conversationStore.createConversation();
    }

    const userMsg = {
      id: crypto.randomUUID(), role: 'user' as const,
      content, conversationId: convId || '', createdAt: new Date().toISOString(),
    };
    conversationStore.appendMessage(userMsg);

    petMood.value = 'thinking';
    isLoading.value = true;

    try {
      // 方式 1：普通请求（简单实现）
      // const response = await chatApi.send(convId || '', content);
      // petMood.value = 'happy';
      // conversationStore.appendMessage({ ... });

      // 方式 2：SSE 流式（完整实现）
      await chatApi.sendStream(convId || '', content, undefined, {
        onToken: (token) => {
          // 追加 token 到最后一条消息
          const msgs = conversationStore.messages;
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            last.content += token;
          } else {
            conversationStore.appendMessage({
              id: crypto.randomUUID(), conversationId: convId || '',
              role: 'assistant', content: token, createdAt: new Date().toISOString(),
            });
          }
        },
        onToolCall: (data) => {
          petMood.value = 'working';
        },
        onDone: () => {
          petMood.value = 'happy';
          isLoading.value = false;
        },
        onError: (err) => {
          petMood.value = 'error';
          isLoading.value = false;
        },
      });

    } catch (err: any) {
      petMood.value = 'error';
      isLoading.value = false;
    }
  }

  function setMood(mood: PetMood) { petMood.value = mood; }
  function clearMessages() { conversationStore.messages = []; petMood.value = 'idle'; }

  return { petMood, isLoading, sendMessage, setMood, clearMessages };
});
```

**`src/stores/workflow.ts`** 和 **`src/stores/plugin.ts`** — 与前一版一致。

### Step 5: Agent Pet 组件

```typescript
// src/components/AgentPet/PetStates.ts
import type { PetMood } from '@/types/agent';

export interface MoodConfig {
  eyeExpression: 'normal' | 'happy' | 'thinking' | 'sad';
  bodyColor: string;
  accentColor: string;
  animation: 'float' | 'pulse' | 'spin' | 'bounce' | 'shake' | 'idle';
  message: string;
}

export const MOOD_CONFIG: Record<PetMood, MoodConfig> = {
  idle:     { eyeExpression: 'normal',  bodyColor: '#4A90D9', accentColor: '#6BB3F0', animation: 'idle',  message: '有什么可以帮你的吗？' },
  thinking:  { eyeExpression: 'thinking', bodyColor: '#F59E0B', accentColor: '#FCD34D', animation: 'pulse', message: '让我想想...' },
  working:  { eyeExpression: 'normal',   bodyColor: '#3B82F6', accentColor: '#60A5FA', animation: 'spin',  message: '正在执行任务...' },
  happy:    { eyeExpression: 'happy',   bodyColor: '#10B981', accentColor: '#34D399', animation: 'bounce', message: '任务完成！' },
  error:    { eyeExpression: 'sad',      bodyColor: '#EF4444', accentColor: '#F87171', animation: 'shake', message: '出了点小问题...' },
};
```

**`src/components/AgentPet/AgentPet.vue`**（与前一版一致）：

```vue
<!-- src/components/AgentPet/AgentPet.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { useAgentStore } from '@/stores/agent';
import { MOOD_CONFIG } from './PetStates';

const agentStore = useAgentStore();
const config = computed(() => MOOD_CONFIG[agentStore.petMood]);
const statusLabel = computed(() => ({
  idle: '待机中', thinking: '思考中', working: '工作中', happy: '已完成', error: '出错了',
} as const)[agentStore.petMood]);
</script>

<template>
  <div class="agent-pet" :class="`anim-${config.animation}`">
    <div class="pet-head" :style="{ background: config.bodyColor }">
      <div class="antenna" :style="{ background: config.accentColor }">
        <div class="antenna-dot" :style="{ background: config.accentColor }" />
      </div>
      <div class="eyes">
        <div class="eye" :class="`expr-${config.eyeExpression}`" />
        <div class="eye" :class="`expr-${config.eyeExpression}`" />
      </div>
      <div class="mouth" :class="`expr-${config.eyeExpression}`" />
    </div>
    <div class="status-badge" :style="{ background: `${config.bodyColor}20`, color: config.bodyColor }">
      <span class="dot" :style="{ background: config.bodyColor }" />
      {{ statusLabel }}
    </div>
    <div class="message-bubble">{{ config.message }}</div>
  </div>
</template>

<style scoped>
/* 与前一版一致，此处省略，详见完整代码 */
</style>
```

### Step 6: 路由和布局

**`src/router/index.ts`**：

```typescript
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/chat' },
    { path: '/chat', component: () => import('@/views/ChatView.vue') },
    { path: '/plugins', component: () => import('@/views/PluginView.vue') },
    { path: '/flow', component: () => import('@/views/FlowView.vue') },
    { path: '/settings', component: () => import('@/views/SettingsView.vue') },
    { path: '/history', component: () => import('@/views/HistoryView.vue') },
  ],
});
```

**`src/App.vue`** — 三栏布局（侧边 / 主内容 / Agent Pet）：

```vue
<!-- src/App.vue -->
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
.agent-panel { background: var(--color-bg-elevated); border-left: 1px solid var(--color-border); display: flex; align-items: flex-start; justify-content: center; padding-top: 24px; }
</style>
```

### Step 7: Sidebar（升级，支持对话历史）

```vue
<!-- src/components/Sidebar.vue -->
<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
import { useConversationStore } from '@/stores/conversation';
import { useWorkflowStore } from '@/stores/workflow';
import { storeToRefs } from 'pinia';
import { onMounted } from 'vue';

const route = useRoute();
const conversationStore = useConversationStore();
const workflowStore = useWorkflowStore();
const { conversations } = storeToRefs(conversationStore);
const { workflows } = storeToRefs(workflowStore);
onMounted(() => { conversationStore.loadConversations(); workflowStore.loadWorkflows(); });

const navItems = [
  { path: '/chat', label: '聊天', icon: '💬' },
  { path: '/flow', label: '编排', icon: '⚡' },
  { path: '/plugins', label: '插件', icon: '🔌' },
  { path: '/settings', label: '设置', icon: '⚙' },
  { path: '/history', label: '历史', icon: '📜' },
];
</script>

<template>
  <nav class="sidebar">
    <div class="sidebar-header">
      <span class="logo-icon">🤖</span>
      <span class="logo-text">EasyAgent</span>
    </div>

    <RouterLink v-for="item in navItems" :key="item.path" :to="item.path"
      class="nav-item" :class="{ active: route.path === item.path }">
      <span class="nav-icon">{{ item.icon }}</span>
      <span class="nav-label">{{ item.label }}</span>
    </RouterLink>

    <!-- 对话历史快捷入口 -->
    <div class="section">
      <div class="section-title">最近对话</div>
      <div v-for="conv in conversations.slice(0, 3)" :key="conv.id"
        class="conv-item" @click="conversationStore.selectConversation(conv.id)">
        <span class="conv-icon">💬</span>
        <span class="conv-name">{{ conv.name }}</span>
      </div>
    </div>

    <!-- 工作流列表 -->
    <div class="section">
      <div class="section-title">工作流</div>
      <div v-for="wf in workflows.slice(0, 3)" :key="wf.id"
        class="workflow-item" @click="workflowStore.selectWorkflow(wf)">
        <span class="wf-dot" />
        <span>{{ wf.name }}</span>
      </div>
    </div>
  </nav>
</template>

<style scoped>
/* 样式省略，结构清晰 */
</style>
```

### Step 8: 对话视图（支持 SSE 流式 + 历史加载）

**`src/views/ChatView.vue`**：

```vue
<!-- src/views/ChatView.vue -->
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
  // 如果没有当前对话，自动创建一个
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
    <!-- 对话标题 -->
    <div class="chat-header">
      <span class="chat-title">{{ currentConversation?.name || '新对话' }}</span>
      <button class="new-chat-btn" @click="conversationStore.createConversation()">+ 新对话</button>
    </div>

    <!-- 消息列表 -->
    <div class="messages" ref="messagesEl">
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
      <button class="send-btn" :disabled="!inputText.trim() || isLoading" @click="handleSend">发送</button>
    </div>
  </div>
</template>

<style scoped>
/* 样式省略，结构与前一版一致 */
</style>
```

### Step 9: 历史视图 + Prompt 编辑器

**`src/views/HistoryView.vue`**（新增）：

```vue
<!-- src/views/HistoryView.vue -->
<script setup lang="ts">
import { onMounted } from 'vue';
import { useConversationStore } from '@/stores/conversation';
import { storeToRefs } from 'pinia';

const store = useConversationStore();
const { conversations } = storeToRefs(store);
onMounted(() => store.loadConversations());
</script>

<template>
  <div class="history-view">
    <div class="view-header">
      <h2>对话历史</h2>
      <button class="btn-primary" @click="store.createConversation()">+ 新对话</button>
    </div>

    <div class="conversation-list">
      <div v-for="conv in conversations" :key="conv.id" class="conv-card">
        <div class="conv-info" @click="store.selectConversation(conv.id)">
          <div class="conv-name">{{ conv.name }}</div>
          <div class="conv-date">{{ new Date(conv.updatedAt).toLocaleString() }}</div>
        </div>
        <button class="delete-btn" @click.stop="store.deleteConversation(conv.id)">删除</button>
      </div>
    </div>
  </div>
</template>
```

**`src/views/SettingsView.vue`** — 设置页（含 Prompt 管理）：

```vue
<!-- src/views/SettingsView.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { usePromptStore } from '@/stores/prompt';
import { storeToRefs } from 'pinia';
import { promptApi } from '@/api/prompt';
import { keysApi } from '@/api/keys';

const promptStore = usePromptStore();
const { prompts } = storeToRefs(promptStore);
const { messages: _msgs, ...rest } = storeToRefs(usePromptStore());

// API Key 管理
const apiKeys = ref<any[]>([]);
const newKeyForm = ref({ provider: 'openai', key: '', model: 'gpt-4o' });

onMounted(async () => {
  await promptStore.loadPrompts();
  apiKeys.value = await keysApi.list();
});

async function handleAddKey() {
  const created = await keysApi.create(newKeyForm.value);
  apiKeys.value.push(created);
  newKeyForm.value = { provider: 'openai', key: '', model: 'gpt-4o' };
}

async function handleDeleteKey(id: string) {
  await keysApi.delete(id);
  apiKeys.value = apiKeys.value.filter(k => k.id !== id);
}
</script>

<template>
  <div class="settings-view">
    <h2>设置</h2>

    <!-- API Key 管理 -->
    <section class="settings-section">
      <h3>API Key 配置</h3>
      <div v-for="key in apiKeys" :key="key.id" class="key-item">
        <span>{{ key.provider }} / {{ key.model }}</span>
        <button @click="handleDeleteKey(key.id)">删除</button>
      </div>
      <div class="key-form">
        <select v-model="newKeyForm.provider" class="input">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
        <input v-model="newKeyForm.key" class="input" placeholder="sk-..." />
        <select v-model="newKeyForm.model" class="input">
          <option value="gpt-4o">GPT-4o</option>
          <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
        </select>
        <button class="btn-primary" @click="handleAddKey">添加</button>
      </div>
    </section>

    <!-- Prompt 模板管理 -->
    <section class="settings-section">
      <h3>Prompt 模板</h3>
      <div v-for="prompt in prompts" :key="prompt.id" class="prompt-item">
        <div>
          <div class="prompt-name">{{ prompt.name }}</div>
          <div class="prompt-desc">{{ prompt.description }}</div>
        </div>
        <button class="btn-danger" @click="promptStore.deletePrompt(prompt.id)">删除</button>
      </div>
      <div class="prompt-form">
        <input v-model="promptStore.activePromptId" class="input" placeholder="模板名称" />
        <textarea class="input textarea" placeholder="System Prompt..." />
        <button class="btn-primary">保存</button>
      </div>
    </section>
  </div>
</template>
```

### Step 10: 流程编排视图（与前一版一致）

FlowView + 节点组件（InputNode、LLMNode、MCPToolNode、OutputNode）与前一版完全一致，此处省略。

---

## 4. 启动和验证

```bash
cd packages/frontend
npm install
npm run dev
```

```
1. 打开 http://localhost:5173
2. 进入设置页，添加一个 API Key
3. 切换到聊天页，发送消息，确认 Agent 有响应
4. 访问历史页，确认对话保存成功
```

---

## 5. 下一步推进顺序

```
1. Step 1-2  → 样式 + 路由，页面能正常渲染
2. Step 3     → 完成 API 层（含 SSE），与后端互通
3. Step 4     → 完成 Store（新增对话历史 + Prompt）
4. Step 5     → Agent Pet 动画
5. Step 6     → App 布局
6. Step 7     → Sidebar（含对话快捷入口）
7. Step 8     → ChatView（支持 SSE 流式）
8. Step 9     → HistoryView + SettingsView（含 Prompt 管理）
9. Step 10    → FlowView + 节点组件
```

---

## 6. 常见问题

### SSE 在前端如何解析？

用 `fetch` + `ReadableStream`（如 Step 3 的示例代码），比 `EventSource` 更灵活，支持 POST 请求和双向流。

### Vue Flow 和 React Flow 一样吗？
基本一致，Vue Flow 是 React Flow 的直接移植：
- React: `props.nodes` / `props.setNodes` → Vue: `v-model:nodes`
- `useVueFlow` composable 对应 React 的 `useReactFlow`

### Pinia 状态持久化？
用 `pinia-plugin-persistedstate` 可将状态存入 localStorage。

---

*文档版本: v0.1.0 | 最后更新: 2026-05-25*
