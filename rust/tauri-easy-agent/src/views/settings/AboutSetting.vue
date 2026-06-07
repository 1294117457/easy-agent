<script setup lang="ts">
</script>

<template>
  <div class="about-setting">
    <h3>ℹ️ 关于 EasyAgent</h3>

    <div class="about-info">
      <div class="app-icon">🤖</div>
      <h4>EasyAgent</h4>
      <p class="version">版本 0.1.0</p>
      <p class="desc">一个简单易用的 AI Agent 桌面应用</p>

      <div class="tech-stack">
        <span class="tech-tag">Electron</span>
        <span class="tech-tag">Vue 3</span>
        <span class="tech-tag">TypeScript</span>
        <span class="tech-tag">Pinia</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.about-setting h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--color-text, #1a1a1a);
}

.about-info {
  text-align: center;
  padding: 40px 20px;
}

.app-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.about-info h4 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
}

.version {
  color: var(--color-text-secondary, #666);
  margin-bottom: 8px;
}

.desc {
  color: var(--color-text-secondary, #666);
  margin-bottom: 24px;
}

.tech-stack {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tech-tag {
  padding: 6px 12px;
  background: var(--color-bg-elevated, #f5f5f5);
  border-radius: 16px;
  font-size: 12px;
  color: var(--color-text-secondary, #666);
}
</style>
