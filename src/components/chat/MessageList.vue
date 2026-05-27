<script setup lang="ts">
import { useChatStore } from '@/stores/chat';
import { storeToRefs } from 'pinia';
import { watch, nextTick, ref } from 'vue';

const chatStore = useChatStore();
const { messages, isLoading } = storeToRefs(chatStore);
const messageListRef = ref<HTMLElement>();

// 自动滚动到底部
watch(messages, async () => {
  await nextTick();
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
  }
}, { deep: true });
</script>

<template>
  <div ref="messageListRef" class="message-list">
    <!-- 空状态 -->
    <div v-if="messages.length === 0" class="empty-state">
      <p>你好！我是 EasyAgent</p>
      <p>告诉我你想做什么，我来帮你完成。</p>
    </div>

    <!-- 消息列表 -->
    <div
      v-for="msg in messages"
      :key="msg.id"
      :class="['message', msg.role]"
    >
      <div class="bubble">{{ msg.content }}</div>
    </div>

    <!-- 加载中 -->
    <div v-if="isLoading" class="loading">
      <span class="dot" />
      <span class="dot" />
      <span class="dot" />
    </div>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
  min-height: 0;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary, #666);
  gap: 8px;
}

.message {
  display: flex;
}

.message.user {
  justify-content: flex-end;
}

.message.assistant {
  justify-content: flex-start;
}

.bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.message.user .bubble {
  background: var(--color-primary, #4f46e5);
  color: white;
  border-bottom-right-radius: 4px;
}

.message.assistant .bubble {
  background: var(--color-bg-elevated, #f5f5f5);
  color: var(--color-text, #1a1a1a);
  border-bottom-left-radius: 4px;
}

.loading {
  display: flex;
  gap: 4px;
  padding: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-secondary, #999);
  animation: bounce 1.4s ease-in-out infinite both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
</style>
