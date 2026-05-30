<script setup lang="ts">
import { ref } from 'vue';

const theme = ref<'light' | 'dark' | 'system'>('system');
const fontSize = ref(14);

function applyTheme() {
  const root = document.documentElement;
  if (theme.value === 'dark') {
    root.classList.add('dark');
  } else if (theme.value === 'light') {
    root.classList.remove('dark');
  } else {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
  document.body.style.fontSize = `${fontSize.value}px`;
}
</script>

<template>
  <div class="appearance-setting">
    <h3>🎨 外观设置</h3>

    <div class="setting-item">
      <label>主题</label>
      <div class="theme-buttons">
        <button
          :class="['theme-btn', { active: theme === 'light' }]"
          @click="theme = 'light'; applyTheme()"
        >
          ☀️ 浅色
        </button>
        <button
          :class="['theme-btn', { active: theme === 'dark' }]"
          @click="theme = 'dark'; applyTheme()"
        >
          🌙 深色
        </button>
        <button
          :class="['theme-btn', { active: theme === 'system' }]"
          @click="theme = 'system'; applyTheme()"
        >
          💻 跟随系统
        </button>
      </div>
    </div>

    <div class="setting-item">
      <label>字体大小</label>
      <select v-model="fontSize" @change="applyTheme">
        <option :value="12">12px</option>
        <option :value="14">14px</option>
        <option :value="16">16px</option>
        <option :value="18">18px</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.appearance-setting h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--color-text, #1a1a1a);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.setting-item > label {
  font-size: 14px;
  color: var(--color-text, #1a1a1a);
}

.theme-buttons {
  display: flex;
  gap: 8px;
}

.theme-btn {
  padding: 8px 16px;
  background: var(--color-bg-elevated, #f5f5f5);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-text, #1a1a1a);
}

.theme-btn:hover {
  border-color: var(--color-primary, #4f46e5);
}

.theme-btn.active {
  background: var(--color-primary, #4f46e5);
  color: white;
  border-color: var(--color-primary, #4f46e5);
}

select {
  padding: 10px 12px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  background: var(--color-bg-surface, #fff);
  color: var(--color-text, #1a1a1a);
  font-size: 14px;
  cursor: pointer;
}

select:focus {
  outline: none;
  border-color: var(--color-primary, #4f46e5);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}
</style>
