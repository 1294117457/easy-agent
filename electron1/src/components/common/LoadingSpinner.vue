<script setup lang="ts">
defineProps<{
  type?: 'dots' | 'spinner';
  size?: number;
}>();
</script>

<template>
  <span v-if="type === 'spinner'" class="spinner" :style="{ width: `${size ?? 12}px`, height: `${size ?? 12}px` }" />
  <span v-else class="dots">
    <span class="dot" />
    <span class="dot" />
    <span class="dot" />
  </span>
</template>

<style scoped>
.spinner {
  display: inline-block;
  border: 2px solid var(--color-primary, #4f46e5);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-secondary, #999);
  animation: bounce 1.4s ease-in-out infinite both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
</style>
