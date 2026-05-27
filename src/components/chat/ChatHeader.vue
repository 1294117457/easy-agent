<script setup lang="ts">
import { useChatStore } from '@/stores/chat';
import { storeToRefs } from 'pinia';
import ModelSelector from './ModelSelector.vue';
import PromptSelector from './PromptSelector.vue';

const chatStore = useChatStore();
const { showHistory, currentTitle } = storeToRefs(chatStore);

function handleToggleHistory() {
  chatStore.toggleHistory();
}
</script>

<template>
  <header class="chat-header">
    <button class="toggle-btn" @click="handleToggleHistory" title="历史记录">
      {{ showHistory ? '×' : '☰' }}
    </button>

    <span class="title">{{ currentTitle }}</span>

    <!-- 选择器放在 MCP 旁边 -->
    <ModelSelector />
    <PromptSelector />

    <button class="action-btn mcp-btn">MCP</button>
  </header>
</template>

<style scoped>
.chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  background: var(--color-bg-surface, #fff);
}

.toggle-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-elevated, #f5f5f5);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: var(--color-primary, #4f46e5);
  color: white;
  border-color: var(--color-primary, #4f46e5);
}

.title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text, #1a1a1a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-btn {
  padding: 6px 12px;
  background: var(--color-bg-elevated, #f5f5f5);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--color-primary, #4f46e5);
  color: white;
  border-color: var(--color-primary, #4f46e5);
}
</style>
