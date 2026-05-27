<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useConfigStore } from '@/stores/config';
import { useRouter } from 'vue-router';

const configStore = useConfigStore();
const router = useRouter();

const showDropdown = ref(false);
const btnRef = ref<HTMLButtonElement | null>(null);

const dropdownStyle = computed(() => {
  if (!btnRef.value) return {};
  const rect = btnRef.value.getBoundingClientRect();
  return {
    position: 'fixed' as const,
    top: `${rect.bottom + 4}px`,
    right: `${window.innerWidth - rect.right}px`,
    left: `${rect.left}px`,
  };
});

function toggleDropdown() {
  showDropdown.value = !showDropdown.value;
}

function closeDropdown() {
  showDropdown.value = false;
}

async function selectKey(id: string) {
  await configStore.setActiveKey(id);
  closeDropdown();
}

function goToSettings() {
  closeDropdown();
  router.push('/settings?tab=apikey');
}

function getProviderName(provider: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    qwen: '通义千问',
    deepseek: 'DeepSeek',
    gemini: 'Google Gemini',
  };
  return names[provider] || provider;
}
</script>

<template>
  <div class="selector-wrapper">
    <button ref="btnRef" class="selector-btn" @click.stop="toggleDropdown">
      <span class="label">模型:</span>
      <span class="value">{{ configStore.activeKey?.model || '未选择' }}</span>
      <span class="arrow">▼</span>
    </button>

    <Teleport to="body">
      <div v-if="showDropdown" class="dropdown-overlay" @click="closeDropdown">
        <div class="dropdown-panel" :style="dropdownStyle" @click.stop>
          <div class="section-title">选择模型</div>
          <div
            v-for="key in configStore.apiKeys"
            :key="key.id"
            :class="['dropdown-item', { active: key.id === configStore.activeKeyId }]"
            @click="selectKey(key.id)"
          >
            <span class="radio">{{ key.id === configStore.activeKeyId ? '●' : '○' }}</span>
            <span class="name">{{ key.model }}</span>
            <span class="provider">{{ getProviderName(key.provider) }}</span>
          </div>
          <div v-if="configStore.apiKeys.length === 0" class="empty-hint">
            暂未配置 API Key
          </div>
          <div class="dropdown-footer" @click="goToSettings">
            🔑 前往设置页面管理 API Key
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.selector-wrapper {
  position: relative;
}

.selector-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--color-bg-elevated, #f5f5f5);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.selector-btn:hover {
  border-color: var(--color-primary, #4f46e5);
}

.label {
  color: var(--color-text-secondary, #666);
}

.value {
  font-weight: 500;
  color: var(--color-text, #1a1a1a);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  font-size: 10px;
  color: var(--color-text-secondary, #999);
}

.dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
}

.dropdown-panel {
  background: var(--color-bg-surface, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 240px;
  max-height: 320px;
  overflow-y: auto;
}

.section-title {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary, #999);
  text-transform: uppercase;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.dropdown-item:hover {
  background: var(--color-bg-elevated, #f5f5f5);
}

.dropdown-item.active {
  background: rgba(79, 70, 229, 0.08);
}

.radio {
  width: 14px;
  font-size: 10px;
  color: var(--color-primary, #4f46e5);
}

.name {
  flex: 1;
  font-weight: 500;
}

.provider {
  font-size: 11px;
  color: var(--color-text-secondary, #999);
}

.empty-hint {
  padding: 16px 12px;
  text-align: center;
  color: var(--color-text-secondary, #999);
  font-size: 12px;
}

.dropdown-footer {
  padding: 10px 12px;
  border-top: 1px solid var(--color-border, #e0e0e0);
  color: var(--color-primary, #4f46e5);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-footer:hover {
  background: var(--color-bg-elevated, #f5f5f5);
}
</style>
