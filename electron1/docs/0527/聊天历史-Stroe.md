# 前端重构开发指南

> 创建日期：2026-05-27
> 状态：待开发
> 优先级：高

---

## 一、概述

本次重构包含三个主要优化：

1. **聊天模块优化**：历史对话移入聊天界面左上角
2. **Store 重构**：拆分为 `chat.ts` 和 `config.ts`
3. **设置页面重构**：增加二级菜单结构

---

## 二、聊天模块优化

### 2.1 目标

将历史对话列表从独立页面（HistoryView）移入聊天界面，作为可展开的侧边栏。

### 2.2 界面设计

#### 聊天界面布局（展开前）

```
┌─────────────────────────────────────────────────────────┐
│ [☰]  新对话标题...                          [MCP] [⚙️]│
├─────────────────────────────────────────────────────────┤
│ │ 你: 你好                                           │ │
│ │                                                    │ │
│ │ AI: 你好！有什么可以帮助你的吗？                   │ │
├─────────────────────────────────────────────────────────┤
│ [输入消息...]                                    [发送] │
└─────────────────────────────────────────────────────────┘
```

#### 聊天界面布局（展开后）

```
┌────────────────────┬────────────────────────────────────┐
│ [☰]  新对话标题... │                          [MCP] [⚙️]│
├────────────────────┼────────────────────────────────────┤
│ 今天上午的讨论  10:30│ │ 你: 你好                       ││
│ Python 问题    昨天 │ │                                │ │
│ MCP 测试      周一  │ │ AI: 你好！有什么可以帮...     ││
│ ─────────────── │ │                                │ │
│ [新建对话]        │ │                                │ │
│                    │ ├────────────────────────────────────┤
│                    │ │ [输入消息...]             [发送] │
└────────────────────┴────────────────────────────────────┘
```

### 2.3 组件结构

```typescript
// src/views/ChatView.vue
<template>
  <div class="chat-view">
    <!-- 历史对话侧边栏 -->
    <aside class="history-sidebar" :class="{ open: showHistory }">
      <ConversationList
        :conversations="chatStore.conversations"
        :currentId="chatStore.currentConversationId"
        @select="handleSelectConversation"
        @new="handleNewConversation"
        @delete="handleDeleteConversation"
      />
    </aside>

    <!-- 主聊天区域 -->
    <main class="chat-main">
      <!-- 顶部栏 -->
      <header class="chat-header">
        <button class="toggle-btn" @click="toggleHistory">☰</button>
        <span class="title">{{ currentTitle }}</span>
        <div class="actions">
          <button class="mcp-btn" title="MCP 工具">MCP</button>
          <button class="settings-btn" @click="router.push('/settings')">⚙️</button>
        </div>
      </header>

      <!-- 消息列表 -->
      <MessageList :messages="chatStore.messages" />

      <!-- 输入区域 -->
      <InputArea @send="handleSend" />
    </main>
  </div>
</template>
```

### 2.4 状态管理

```typescript
// src/stores/chat.ts
interface ChatState {
  messages: Message[];
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  showHistory: boolean;  // 新增：控制历史侧边栏显示
}
```

### 2.5 组件拆分

```
src/components/
├── chat/
│   ├── ConversationList.vue    # 历史对话列表
│   ├── MessageList.vue        # 消息列表
│   ├── MessageBubble.vue      # 单条消息气泡
│   ├── InputArea.vue          # 输入区域
│   └── ChatHeader.vue         # 顶部栏
```

### 2.6 路由调整

- **删除**：`/history` 路由和 `HistoryView.vue`
- **保留**：`/chat` 作为唯一的聊天入口

---

## 三、Store 重构

### 3.1 重构目标

将当前混杂的 `agent.ts` 拆分为职责明确的独立 Store。

### 3.2 当前问题

```typescript
// src/stores/agent.ts（当前）
// 问题：混杂了对话状态和配置状态
const agentStore = defineStore('agent', () => {
  const messages = ref([]);           // 对话相关
  const isLoading = ref(false);       // 对话相关
  const providers = ref([]);          // 配置相关 ←
  const llmConfig = ref(null);       // 配置相关 ←
  // ...
});
```

### 3.3 目标结构

```
src/stores/
├── chat.ts      # 对话状态：消息、历史、加载状态
└── config.ts   # 配置状态：API Keys、Prompts、LLM 配置
```

### 3.4 chat.ts 设计

```typescript
// src/stores/chat.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { chatApi, setupChatListeners } from '@/api/chat';

export const useChatStore = defineStore('chat', () => {
  // 状态
  const messages = ref<Message[]>([]);
  const conversations = ref<Conversation[]>([]);
  const currentConversationId = ref<string | null>(null);
  const isLoading = ref(false);
  const showHistory = ref(false);  // 历史侧边栏显示状态

  // 计算属性
  const currentConversation = computed(() =>
    conversations.value.find(c => c.id === currentConversationId.value)
  );

  // 初始化监听器
  function setupListeners() {
    setupChatListeners({
      onToken: (token: string) => {
        // 流式响应处理
        const lastMsg = messages.value[messages.value.length - 1];
        if (lastMsg?.role === 'assistant') {
          lastMsg.content += token;
        } else {
          messages.value.push(createAssistantMessage(token));
        }
      },
      onDone: () => { isLoading.value = false; },
      onError: (msg: string) => { /* 错误处理 */ },
    });
  }

  // 方法
  async function sendMessage(content: string) { /* ... */ }
  async function newConversation() { /* ... */ }
  async function selectConversation(id: string) { /* ... */ }
  async function deleteConversation(id: string) { /* ... */ }
  function toggleHistory() { showHistory.value = !showHistory.value; }

  return {
    // 状态
    messages,
    conversations,
    currentConversationId,
    isLoading,
    showHistory,
    // 计算属性
    currentConversation,
    // 方法
    setupListeners,
    sendMessage,
    newConversation,
    selectConversation,
    deleteConversation,
    toggleHistory,
  };
});
```

### 3.5 config.ts 设计

```typescript
// src/stores/config.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { configApi } from '@/api/config';

export const useConfigStore = defineStore('config', () => {
  // 状态
  const apiKeys = ref<ApiKey[]>([]);
  const prompts = ref<Prompt[]>([]);
  const llmConfig = ref<LLMConfig | null>(null);
  const providers = ref<LLMProvider[]>([]);

  // 方法
  async function loadConfig() { /* 加载配置 */ }
  async function createApiKey(data: CreateApiKeyDTO) { /* ... */ }
  async function deleteApiKey(id: string) { /* ... */ }
  async function setActiveKey(keyId: string) { /* ... */ }
  async function createPrompt(data: CreatePromptDTO) { /* ... */ }
  async function deletePrompt(id: string) { /* ... */ }

  return {
    apiKeys,
    prompts,
    llmConfig,
    providers,
    loadConfig,
    createApiKey,
    deleteApiKey,
    setActiveKey,
    createPrompt,
    deletePrompt,
  };
});
```

### 3.6 组件中使用

```typescript
// ChatView.vue
const chatStore = useChatStore();
const configStore = useConfigStore();

// 使用
chatStore.sendMessage('你好');
chatStore.toggleHistory();

// 配置
configStore.createApiKey({ provider: 'deepseek', key: 'xxx', model: 'deepseek-chat' });
```

---

## 四、设置页面重构

### 4.1 目标

将设置页面从单页改为带二级菜单的结构，便于扩展。

### 4.2 菜单结构

```
设置
├── 模型 ⚙️
│   ├── API Key 管理
│   ├── Prompt 模板
│   └── 模型参数
├── 外观 🎨
│   ├── 主题
│   └── 字体大小
├── 通用 ⚡
│   ├── 数据目录
│   ├── 调试日志
│   └── 清除数据
└── 关于 ℹ️
    └── 版本信息
```

### 4.3 组件结构

```
src/views/
└── SettingsView.vue      # 主容器，处理路由
    /settings/
        ├── ModelSettings.vue
        ├── AppearanceSettings.vue
        ├── GeneralSettings.vue
        └── AboutSettings.vue
```

### 4.4 界面设计

```
┌─────────────────────────────────────────────────────────┐
│                    设置                                 │
├──────────────┬────────────────────────────────────────┤
│ 模型         │ API Key 管理                           │
│ 外观         │                                        │
│ 通用         │ ┌────────────────────────────────────┐│
│ 关于         │ │ 🤖 OpenAI      gpt-4o     [删除] ││
│              │ │ 🔵 DeepSeek    deepseek... [删除] ││
│              │ └────────────────────────────────────┘│
│              │                                        │
│              │ 添加新 Key:                            │
│              │ [Provider ▾] [Model ▾] [API Key...]  │
│              │ [测试连接] [添加]                      │
│              │                                        │
│              ├────────────────────────────────────────┤
│              │ Prompt 模板                            │
│              │ ...                                    │
└──────────────┴────────────────────────────────────────┘
```

### 4.5 路由设计

```typescript
// src/router/index.ts
const routes = [
  { path: '/settings', redirect: '/settings/model' },
  { path: '/settings/model', component: ModelSettings },
  { path: '/settings/appearance', component: AppearanceSettings },
  { path: '/settings/general', component: GeneralSettings },
  { path: '/settings/about', component: AboutSettings },
];
```

### 4.6 设置数据结构

```typescript
// src/stores/settings.ts（新建）
interface AppSettings {
  appearance: {
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
  };
  general: {
    dataDir: string;
    enableDebugLog: boolean;
    autoRestoreSession: boolean;
  };
  model: {
    temperature: number;
    maxTokens: number;
    defaultModel?: string;
  };
}
```

---

## 五、MCP 预留集成点

### 5.1 为后续 MCP 集成预留的位置

#### 聊天界面

```
┌─────────────────────────────────────────────────────────┐
│ [☰]  对话标题                    [MCP 🔌] [⚙️] │
```

- `[MCP 🔌]` 按钮：打开 MCP 工具面板

#### 消息气泡扩展

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];      // 预留：工具调用
  toolResults?: ToolResult[];   // 预留：工具结果
  timestamp: number;
}
```

#### MCP Store 预留

```typescript
// src/stores/mcp.ts（后续实现）
interface MCPStore {
  servers: McpServer[];
  availableTools: McpTool[];
  enabledTools: Set<string>;
  callHistory: ToolCall[];

  connect(server: McpServerConfig): Promise<void>;
  disconnect(serverId: string): void;
  listTools(): McpTool[];
  callTool(toolName: string, args: object): Promise<ToolResult>;
}
```

---

## 六、文件变更清单

### 6.1 新增文件

```
src/stores/
+   chat.ts           # 新建：对话状态
+   config.ts         # 新建：配置状态

src/components/chat/
+   ConversationList.vue    # 新建：历史对话列表
+   MessageList.vue        # 新建：消息列表
+   MessageBubble.vue       # 新建：消息气泡
+   InputArea.vue          # 新建：输入区域

src/views/settings/
+   ModelSettings.vue       # 新建：模型设置
+   AppearanceSettings.vue  # 新建：外观设置
+   GeneralSettings.vue    # 新建：通用设置
+   AboutSettings.vue       # 新建：关于页面
```

### 6.2 删除文件

```
-   src/views/HistoryView.vue    # 删除：合并到聊天界面
-   src/stores/agent.ts          # 删除：拆分为 chat.ts 和 config.ts
```

### 6.3 修改文件

```
~   src/views/ChatView.vue       # 修改：整合历史侧边栏
~   src/views/SettingsView.vue   # 修改：改为二级菜单
~   src/components/Sidebar.vue   # 修改：移除历史入口
~   src/App.vue                  # 修改：可能需要调整布局
~   src/router/index.ts          # 修改：添加设置子路由
```

---

## 七、实施步骤

### Phase 1: Store 重构（优先级：高）
1. 创建 `src/stores/chat.ts`
2. 创建 `src/stores/config.ts`
3. 迁移 `agent.ts` 中的代码
4. 更新组件引用

### Phase 2: 聊天界面优化（优先级：高）
1. 创建 `ConversationList.vue` 组件
2. 修改 `ChatView.vue` 添加侧边栏
3. 删除 `HistoryView.vue`
4. 移除侧边栏的历史入口

### Phase 3: 设置页面重构（优先级：中）
1. 创建 `settings/` 目录和组件
2. 实现二级菜单结构
3. 迁移现有设置逻辑

### Phase 4: MCP 预留（优先级：低）
1. 添加 MCP 按钮
2. 定义 MCP Store 类型
3. 预留工具调用 UI

---

## 八、注意事项

1. **向后兼容**：Store 重构时注意保持 API 兼容性
2. **状态持久化**：新增的设置项需要持久化到数据库
3. **响应式**：所有变更需要保持移动端响应式
4. **测试**：每个 phase 完成后进行功能测试
