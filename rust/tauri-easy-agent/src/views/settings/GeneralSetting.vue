<script setup lang="ts">
import { ref } from 'vue';

const dataDir = ref('C:\\Users\\...\\easy-agent');
const enableDebugLog = ref(false);
const autoRestoreSession = ref(true);

function handleClearData() {
  if (confirm('确定要清除所有数据吗？这将删除所有对话和配置！')) {
    alert('功能开发中...');
  }
}
</script>

<template>
  <div class="general-setting">
    <h3>⚡ 通用设置</h3>

    <div class="setting-item">
      <label>数据目录</label>
      <div class="path-display">
        <span class="path-text">{{ dataDir }}</span>
        <button>浏览</button>
      </div>
    </div>

    <div class="setting-item">
      <label class="checkbox-label">
        <input type="checkbox" v-model="autoRestoreSession" />
        <span>启动时自动打开上次的对话</span>
      </label>
    </div>

    <div class="setting-item">
      <label class="checkbox-label">
        <input type="checkbox" v-model="enableDebugLog" />
        <span>启用调试日志</span>
      </label>
    </div>

    <div class="setting-item danger-zone">
      <label>危险区域</label>
      <button class="danger" @click="handleClearData">清除所有数据</button>
    </div>
  </div>
</template>

<style scoped>
.general-setting h3 {
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

.path-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.path-text {
  padding: 8px 12px;
  background: var(--color-bg-elevated, #f5f5f5);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-secondary, #666);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
}

.danger-zone {
  border-bottom: none;
  padding-top: 24px;
}

.danger-zone > label {
  color: #dc2626;
}

button {
  padding: 10px 20px;
  background: var(--color-primary, #4f46e5);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

button:hover {
  background: #4338ca;
}

button.danger {
  background: #dc2626;
}

button.danger:hover {
  background: #b91c1c;
}
</style>
