<script setup lang="ts">
import { ref, computed } from 'vue';
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

async function selectPrompt(id: string) {
  await configStore.setActivePrompt(id);
  closeDropdown();
}

function goToSettings() {
  closeDropdown();
  router.push('/settings?tab=prompt');
}
</script>

<template>
  <div class="selector-wrapper">
    <button ref="btnRef" class="selector-btn" @click.stop="toggleDropdown">
      <span class="label">Prompt:</span>
      <span class="value">{{ configStore.activePrompt?.name || '默认' }}</span>
      <span class="arrow">▼</span>
    </button>

    <Teleport to="body">
      <div v-if="showDropdown" class="dropdown-overlay" @click="closeDropdown">
        <div class="dropdown-panel" :style="dropdownStyle" @click.stop>
          <div class="section-title">选择 Prompt</div>
          <div
            v-for="p in configStore.prompts"
            :key="p.id"
            :class="['dropdown-item', { active: p.id === configStore.activePromptId }]"
            @click="selectPrompt(p.id)"
          >
            <span class="radio">{{ p.id === configStore.activePromptId ? '●' : '○' }}</span>
            <span class="name">{{ p.name }}</span>
          </div>
          <div v-if="configStore.prompts.length === 0" class="empty-hint">
            暂未配置 Prompt
          </div>
          <div class="dropdown-footer" @click="goToSettings">
            📝 前往设置页面管理 Prompt
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
  max-width: 80px;
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
  min-width: 200px;
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
