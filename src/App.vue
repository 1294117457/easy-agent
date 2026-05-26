<script setup lang="ts">
import { RouterView } from 'vue-router';
import Sidebar from './components/Sidebar.vue';
</script>

<template>
  <div class="app-layout">
    <Sidebar />
    <main class="main-content">
      <RouterView />
    </main>
    <aside class="agent-panel">
      <div class="pet-placeholder">
        <span>Agent Pet</span>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.app-layout {
  display: grid;
  grid-template-columns: 200px 1fr 240px;
  height: 100vh;
  overflow: hidden;
}
.main-content {
  overflow: auto;
}
.agent-panel {
  background: var(--color-bg-elevated, #f5f5f5);
  border-left: 1px solid var(--color-border, #e0e0e0);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 24px;
}
.pet-placeholder {
  padding: 16px;
  background: var(--color-bg-surface, #fff);
  border-radius: 12px;
  color: var(--color-text-secondary, #666);
}
</style>
