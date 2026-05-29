<script setup lang="ts">
import { onMounted } from 'vue';
import { useChatStore } from '@/stores/chat';
import { useConfigStore } from '@/stores/config';
import ConversationList from '@/components/chat/ConversationList.vue';
import MessageList from '@/components/chat/MessageList.vue';
import InputArea from '@/components/chat/InputArea.vue';
import ChatHeader from '@/components/chat/ChatHeader.vue';

const chatStore = useChatStore();
const configStore = useConfigStore();

onMounted(async () => {
  // 加载配置和聊天数据
  await Promise.all([
    configStore.loadConfig(),
    configStore.loadLLMConfig(),
    chatStore.loadConversations(),
  ]);

  chatStore.setupListeners();
  // 不自动创建对话，等待用户发送第一条消息
});
</script>

<template>
  <div class="chat-view">
    <!-- 历史对话侧边栏 -->
    <aside class="history-sidebar" :class="{ open: chatStore.showHistory }">
      <ConversationList />
    </aside>

    <!-- 主聊天区域 -->
    <main class="chat-main">
      <ChatHeader />
      <div class="messages-container">
        <MessageList />
      </div>
      <div class="input-container">
        <InputArea />
      </div>
    </main>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.history-sidebar {
  width: 0;
  overflow: hidden;
  transition: width 0.3s ease;
  border-right: 1px solid var(--color-border, #e0e0e0);
  background: var(--color-bg-surface, #fff);
}

.history-sidebar.open {
  width: 280px;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.messages-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 16px;
}

.input-container {
  padding: 0 16px 16px;
  flex-shrink: 0;
}
</style>
