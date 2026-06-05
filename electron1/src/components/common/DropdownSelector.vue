<script setup lang="ts">
import { ref, computed } from 'vue';

interface Option {
  id: string;
  label: string;
  subLabel?: string;
}

const props = defineProps<{
  label: string;
  value: string;
  options: Option[];
  activeId?: string;
  footerText?: string;
  emptyText?: string;
}>();

const emit = defineEmits<{
  select: [id: string];
  'footer-click': [];
}>();

const showDropdown = ref(false);
const btnRef = ref<HTMLButtonElement | null>(null);

const dropdownStyle = computed(() => {
  if (!btnRef.value) return {};
  const rect = btnRef.value.getBoundingClientRect();
  return {
    position: 'fixed' as const,
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    right: `${window.innerWidth - rect.right}px`,
  };
});

function toggleDropdown() {
  showDropdown.value = !showDropdown.value;
}

function closeDropdown() {
  showDropdown.value = false;
}

function handleSelect(id: string) {
  emit('select', id);
  closeDropdown();
}

const activeLabel = computed(() => {
  const found = props.options.find((o) => o.id === props.activeId);
  return found ? found.label : props.value;
});
</script>

<template>
  <div class="selector-wrapper">
    <button ref="btnRef" class="selector-btn" @click.stop="toggleDropdown">
      <span class="label">{{ label }}:</span>
      <span class="value">{{ activeLabel }}</span>
      <span class="arrow">▼</span>
    </button>

    <Teleport to="body">
      <div v-if="showDropdown" class="dropdown-overlay" @click="closeDropdown">
        <div class="dropdown-panel" :style="dropdownStyle" @click.stop>
          <div class="section-title">{{ label }}</div>
          <div
            v-for="opt in options"
            :key="opt.id"
            :class="['dropdown-item', { active: opt.id === activeId }]"
            @click="handleSelect(opt.id)"
          >
            <span class="radio">{{ opt.id === activeId ? '●' : '○' }}</span>
            <span class="name">{{ opt.label }}</span>
            <span v-if="opt.subLabel" class="sub">{{ opt.subLabel }}</span>
          </div>
          <div v-if="options.length === 0" class="empty-hint">
            {{ emptyText ?? '暂无数据' }}
          </div>
          <div v-if="footerText" class="dropdown-footer" @click="$emit('footer-click')">
            {{ footerText }}
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

.sub {
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
