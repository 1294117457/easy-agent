<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';

const route = useRoute();
const navItems = [
  { path: '/chat', label: '对话', icon: '💬' },
  { path: '/flow', label: '工作流', icon: '🔀' },
  { path: '/plugins', label: '插件', icon: '🔌' },
  { path: '/settings', label: '设置', icon: '⚙️' },
];
</script>

<template>
  <nav class="sidebar">
    <div class="logo">EasyAgent</div>
    <ul class="nav-list">
      <li v-for="item in navItems" :key="item.path">
        <RouterLink
          :to="item.path"
          :class="['nav-item', { active: route.path === item.path }]"
        >
          <span class="icon">{{ item.icon }}</span>
          <span class="label">{{ item.label }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.sidebar {
  padding: 16px 0;
  background: var(--color-bg-elevated, #f5f5f5);
  border-right: 1px solid var(--color-border, #e0e0e0);
  display: flex;
  flex-direction: column;
  height: 100%;
}
.logo {
  padding: 0 16px 16px;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary, #4f46e5);
}
.nav-list {
  list-style: none;
  flex: 1;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  color: var(--color-text-secondary, #666);
  transition: background 0.2s;
}
.nav-item:hover,
.nav-item.active {
  background: var(--color-bg-surface, #fff);
  color: var(--color-text, #1a1a1a);
}
.nav-item.active {
  border-right: 3px solid var(--color-primary, #4f46e5);
}
.icon {
  font-size: 16px;
}
.label {
  font-size: 14px;
}
</style>
