<script setup lang="ts">
import { useSidebarCollapse } from '@/composables/useSidebarCollapse';

export interface TabItem {
  key: string;
  label: string;
  icon?: string;
}

withDefaults(defineProps<{
  title?: string;
  items: TabItem[];
  activeKey?: string;
}>(), {});

const emit = defineEmits<{
  select: [key: string];
}>();

const collapsed = useSidebarCollapse();

defineExpose({ isCollapsed: () => collapsed.value });

function toggleCollapse() {
  collapsed.value = !collapsed.value;
}

function handleSelect(key: string) {
  emit('select', key);
}
</script>

<template>
  <nav :class="['side-tab-list', { collapsed }]">
    <div class="header">
      <span v-if="title && !collapsed" class="title">{{ title }}</span>
      <button class="collapse-btn" @click="toggleCollapse" :title="collapsed ? '展开' : '收起'">
        {{ collapsed ? '›' : '‹' }}
      </button>
    </div>

    <div class="header-bottom">
      <slot name="header-bottom" />
    </div>

    <ul class="tab-list">
      <li v-for="item in items" :key="item.key">
        <button
          :class="['tab-item', { active: activeKey === item.key }]"
          @click="handleSelect(item.key)"
        >
          <span class="item-left">
            <slot name="item-left" :item="item" />
          </span>
          <span v-if="item.icon && !$slots['item-left']?.({ item })" class="icon">{{ item.icon }}</span>
          <span class="label">{{ item.label }}</span>
          <span class="item-right">
            <slot name="item-right" :item="item" />
          </span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.side-tab-list {
  --sidebar-width: 200px;
  --header-height: 40px;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: var(--sidebar-width);
  background: var(--color-bg-elevated, #f5f5f5);
  border-right: 1px solid var(--color-border, #e0e0e0);
  overflow: hidden;
  transition: width 0.3s ease;
  flex-shrink: 0;
}

.side-tab-list.collapsed {
  width: 48px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  padding: 0 12px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  overflow: hidden;
}

.title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary, #4f46e5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-text-secondary, #666);
  transition: background 0.2s, color 0.2s;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: var(--color-bg-surface, #fff);
  color: var(--color-primary, #4f46e5);
}

.header-bottom {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border, #e0e0e0);
}

.tab-list {
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
  overflow-y: auto;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  color: var(--color-text-secondary, #666);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
}

.tab-item:hover {
  background: var(--color-bg-surface, #fff);
  color: var(--color-text, #1a1a1a);
}

.tab-item.active {
  background: var(--color-primary, #4f46e5);
  color: white;
}

.item-left {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
}

.icon {
  font-size: 16px;
  flex-shrink: 0;
}

.label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

/* 折叠时：隐藏 label，只显示左右两侧插槽 */
.collapsed .tab-item .label {
  display: none;
}

.collapsed .tab-item {
  justify-content: center;
  padding: 10px 12px;
}

.collapsed .item-left,
.collapsed .item-right {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}
</style>
