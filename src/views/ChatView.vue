<script setup lang="ts">
import { onMounted } from 'vue';
import { useChatStore } from '@/stores/chat';
import ConversationList from '@/components/chat/ConversationList.vue';
import MessageList from '@/components/chat/MessageList.vue';
import InputArea from '@/components/chat/InputArea.vue';
import ChatHeader from '@/components/chat/ChatHeader.vue';

const chatStore = useChatStore();

onMounted(async () => {
  chatStore.setupListeners();
  await chatStore.loadConversations();
  // 如果没有对话，创建新对话
  if (chatStore.conversations.length === 0) {
    await chatStore.newConversation();
  } else {
    // 默认选中第一个对话
    await chatStore.selectConversation(chatStore.conversations[0].id);
  }
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
