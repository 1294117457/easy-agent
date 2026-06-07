<script setup lang="ts">
import { ref } from 'vue';
import { useChatStore } from '@/stores/chat';
import { storeToRefs } from 'pinia';

const chatStore = useChatStore();
const { isLoading } = storeToRefs(chatStore);

const inputText = ref('');

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isLoading.value) return;
  inputText.value = '';
  await chatStore.sendMessage(text);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}
</script>

<template>
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
</template>

<style scoped>
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
  min-height: 44px;
  max-height: 120px;
  font-family: inherit;
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
  white-space: nowrap;
  align-self: flex-end;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn:hover:not(:disabled) {
  background: #4338ca;
}
</style>
