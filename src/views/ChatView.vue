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
    <div class="messages">
      <div v-if="messages.length === 0" class="empty-state">
        <p>你好！我是 EasyAgent</p>
        <p>告诉我你想做什么，我来帮你完成。</p>
      </div>
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['message', msg.role]"
      >
        <div class="bubble">{{ msg.content }}</div>
      </div>
      <div v-if="isLoading" class="loading">
        <span class="dot" />
        <span class="dot" />
        <span class="dot" />
      </div>
    </div>

    <div class="input-area">
      <textarea
        v-model="inputText"
        class="input-box"
        placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
        rows="1"
        :disabled="isLoading"
        @keydown="handleKeydown"
      />
      <button
        class="send-btn"
        :disabled="!inputText.trim() || isLoading"
        @click="handleSend"
      >
        发送
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}
.messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 16px;
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
.input-area {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border, #e0e0e0);
}
.input-box {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 12px;
  background: var(--color-bg-surface, #fff);
  color: var(--color-text, #1a1a1a);
  font-size: 14px;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
}
.input-box:focus {
  border-color: var(--color-primary, #4f46e5);
}
.send-btn {
  padding: 10px 20px;
  background: var(--color-primary, #4f46e5);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  transition: opacity 0.2s;
}
.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
