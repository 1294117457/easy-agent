<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAgentStore } from '@/stores/agent';
import { storeToRefs } from 'pinia';

const agentStore = useAgentStore();
const { conversations, currentConversationId } = storeToRefs(agentStore);

onMounted(async () => {
  await agentStore.loadConversations();
});

async function handleSelect(id: string) {
  await agentStore.selectConversation(id);
}
</script>

<template>
  <div class="history-view">
    <h2>历史对话</h2>
    <ul class="conv-list">
      <li
        v-for="conv in conversations"
        :key="conv.id"
        :class="['conv-item', { active: conv.id === currentConversationId }]"
        @click="handleSelect(conv.id)"
      >
        <span class="conv-name">{{ conv.name }}</span>
        <span class="conv-date">{{ new Date(conv.updatedAt).toLocaleDateString() }}</span>
      </li>
      <li v-if="conversations.length === 0" class="empty">暂无历史对话</li>
    </ul>
  </div>
</template>

<style scoped>
.history-view {
  padding: 24px;
}
h2 {
  margin-bottom: 16px;
}
.conv-list {
  list-style: none;
}
.conv-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: var(--color-radius, 8px);
  cursor: pointer;
  transition: background 0.2s;
}
.conv-item:hover,
.conv-item.active {
  background: var(--color-bg-elevated, #f5f5f5);
}
.conv-item.active {
  background: var(--color-primary, #4f46e5);
  color: white;
}
.conv-name {
  font-size: 14px;
}
.conv-date {
  font-size: 12px;
  opacity: 0.7;
}
.empty {
  color: var(--color-text-secondary, #999);
  font-size: 14px;
  padding: 16px 0;
}
</style>
