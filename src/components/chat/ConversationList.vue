<script setup lang="ts">
import { useChatStore } from '@/stores/chat';
import { storeToRefs } from 'pinia';

const chatStore = useChatStore();
const { conversations, currentConversationId } = storeToRefs(chatStore);

function formatTimeRange(startAt: string, endedAt?: string): string {
  return formatDate(startAt);
}

function formatDate(dateStr: string) {
  if (!dateStr) return '未知时间';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '未知时间';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else if (diff < 2 * oneDay) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else if (diff < 7 * oneDay) {
    return date.toLocaleDateString('zh-CN', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function handleSelect(id: string) {
  chatStore.selectConversation(id);
}

function handleNew() {
  chatStore.newConversation();
}

function handleDelete(e: Event, id: string) {
  e.stopPropagation();
  if (confirm('确定要删除这个对话吗？')) {
    chatStore.deleteConversation(id);
  }
}
</script>

<template>
  <div class="conversation-list">
    <!-- 新建对话按钮 -->
    <button class="new-btn" @click="handleNew">
      <span class="icon">+</span>
      <span>新建对话</span>
    </button>

    <!-- 对话列表 -->
    <ul class="list">
      <li
        v-for="conv in conversations"
        :key="conv.id"
        :class="['item', { active: conv.id === currentConversationId, ended: !!conv.endedAt, loading: conv.status === 'loading' }]"
        @click="handleSelect(conv.id)"
      >
        <div class="conv-info">
          <span class="name">
            <span v-if="conv.status === 'loading'" class="loading-indicator"></span>
            {{ conv.name || '新对话' }}
          </span>
          <div class="time-info">
            <span class="time">{{ formatTimeRange(conv.createdAt, conv.endedAt) }}</span>
          </div>
        </div>
        <button class="delete-btn" @click="(e) => handleDelete(e, conv.id)" title="删除">
          ×
        </button>
      </li>

      <li v-if="conversations.length === 0" class="empty">
        暂无对话记录
      </li>
    </ul>
  </div>
</template>

<style scoped>
.conversation-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-surface, #fff);
}

.new-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--color-primary, #4f46e5);
  color: white;
  border: none;
  border-radius: 8px;
  margin: 12px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.new-btn:hover {
  background: #4338ca;
}

.new-btn .icon {
  font-size: 18px;
  font-weight: bold;
}

.list {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  padding: 0;
  margin: 0;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.item:hover {
  background: var(--color-bg-elevated, #f5f5f5);
}

.item.active {
  background: var(--color-primary, #4f46e5);
  color: white;
}

.item.ended {
  opacity: 0.7;
}

.item.ended .name {
  color: #000;
}

.item.active .date {
  color: rgba(255, 255, 255, 0.7);
}

.item.active .delete-btn {
  color: rgba(255, 255, 255, 0.7);
}

.item.active .delete-btn:hover {
  color: white;
  background: rgba(255, 255, 255, 0.2);
}

.conv-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.name {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.time {
  font-size: 11px;
  color: var(--color-text-secondary, #999);
}

.time-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.item.loading {
  opacity: 1;
  background: rgba(79, 70, 229, 0.1);
}

.loading-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-primary, #4f46e5);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 6px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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

.item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--color-text-secondary, #999);
  font-size: 14px;
}
</style>
