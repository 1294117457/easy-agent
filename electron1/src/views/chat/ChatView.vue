<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import { useChatStore } from '@/stores/chat';
import type { Conversation } from '@/stores/chat';
import { useConfigStore } from '@/stores/config';
import { provideSidebarCollapse } from '@/composables/useSidebarCollapse';
import SideTabList from '@/components/common/SideTabList.vue';
import type { TabItem } from '@/components/common/SideTabList.vue';
import MessageList from './MessageList.vue';
import InputArea from './InputArea.vue';
import ChatHeader from './ChatHeader.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';

provideSidebarCollapse();

const chatStore = useChatStore();
const configStore = useConfigStore();
const tabListRef = ref<InstanceType<typeof SideTabList>>();

const collapsed = computed(() => tabListRef.value?.isCollapsed() ?? false);

const conversationMap = computed<Record<string, Conversation>>(() => {
  const map: Record<string, Conversation> = {};
  for (const c of chatStore.conversations) {
    map[c.id] = c;
  }
  return map;
});

const items = computed<TabItem[]>(() =>
  chatStore.conversations.map((conv: Conversation) => ({
    key: conv.id,
    label: conv.name || '新对话',
  }))
);

function formatDay(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return '今天';
  } else if (diff < 2 * oneDay) {
    return '昨天';
  } else if (diff < 7 * oneDay) {
    return date.toLocaleDateString('zh-CN', { weekday: 'short' });
  }
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function handleSelectConversation(id: string) {
  chatStore.selectConversation(id);
}

function handleNewConversation() {
  chatStore.newConversation();
}

function handleDeleteConversation(e: Event, id: string) {
  e.stopPropagation();
  if (confirm('确定要删除这个对话吗？')) {
    chatStore.deleteConversation(id);
  }
}

onMounted(async () => {
  await Promise.all([
    configStore.loadConfig(),
    configStore.loadLLMConfig(),
    chatStore.loadConversations(),
  ]);

  chatStore.setupListeners();
});
</script>

<template>
  <div class="chat-view">
    <SideTabList
      ref="tabListRef"
      title="历史对话"
      :items="items"
      :active-key="chatStore.currentConversationId"
      @select="handleSelectConversation"
    >
      <template v-if="!collapsed" #header-bottom>
        <button class="new-btn" @click="handleNewConversation">
          <span class="icon">+</span>
          <span>新建对话</span>
        </button>
      </template>

      <template #item-left="{ item }">
        <LoadingSpinner
          v-if="conversationMap[item.key]?.status === 'loading'"
          type="spinner"
          :size="12"
        />
        <div class="time-block">
          <span class="time-day">{{ formatDay(conversationMap[item.key]?.createdAt ?? '') }}</span>
          <span class="time-clock">{{ formatTime(conversationMap[item.key]?.createdAt ?? '') }}</span>
        </div>
      </template>

      <template #item-right="{ item }">
        <button
          v-if="!collapsed"
          class="delete-btn"
          title="删除"
          @click="(e) => handleDeleteConversation(e, item.key)"
        >
          ×
        </button>
      </template>
    </SideTabList>

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

.new-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: calc(100% - 24px);
  margin: 12px;
  padding: 10px 12px;
  background: var(--color-primary, #4f46e5);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
  white-space: nowrap;
}

.new-btn:hover {
  background: #4338ca;
}

.new-btn .icon {
  font-size: 18px;
  font-weight: bold;
}

.time-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
}

.time-day {
  font-size: 10px;
  opacity: 0.7;
}

.time-clock {
  font-size: 11px;
  opacity: 0.7;
}

.delete-btn {
  padding: 4px 8px;
  background: transparent;
  color: transparent;
  border: none;
  border-radius: 4px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0;
}

.delete-btn:hover {
  opacity: 1;
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.tab-item:hover .delete-btn {
  opacity: 1;
}
</style>
