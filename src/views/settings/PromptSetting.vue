<script setup lang="ts">
import { ref } from 'vue';
import { useConfigStore } from '@/stores/config';

const configStore = useConfigStore();

const newPromptForm = ref({ name: '', description: '', systemPrompt: '' });

async function handleAddPrompt() {
  if (!newPromptForm.value.name.trim() || !newPromptForm.value.systemPrompt.trim()) return;
  const data = { ...newPromptForm.value };
  await configStore.createPrompt(data);
  newPromptForm.value = { name: '', description: '', systemPrompt: '' };
}

function handleDeletePrompt(id: string) {
  if (confirm('确定要删除这个 Prompt 模板吗？')) {
    configStore.deletePrompt(id);
  }
}
</script>

<template>
  <div class="prompt-setting">
    <h3>📝 Prompt 模板</h3>

    <div class="add-form">
      <h5>添加新的 Prompt</h5>
      <div class="form-column">
        <input v-model="newPromptForm.name" placeholder="模板名称（必填）" />
        <input v-model="newPromptForm.description" placeholder="描述（可选）" />
        <textarea v-model="newPromptForm.systemPrompt" placeholder="System Prompt 内容..." rows="5"></textarea>
        <button @click="handleAddPrompt" :disabled="!newPromptForm.name || !newPromptForm.systemPrompt">
          保存
        </button>
      </div>
    </div>

    <div class="subsection">
      <h4>已配置的 Prompt</h4>
      <div class="prompt-list">
        <div
          v-for="p in configStore.prompts"
          :key="p.id"
          :class="['prompt-item', { active: p.isActive }]"
        >
          <div class="prompt-info">
            <div class="prompt-header">
              <span class="prompt-name">{{ p.name }}</span>
              <span v-if="p.isActive" class="active-badge">使用中</span>
              <span v-if="p.isBuiltin" class="builtin-badge">内置</span>
            </div>
            <p v-if="p.description" class="prompt-desc">{{ p.description }}</p>
            <p class="prompt-preview">
              {{ (p.systemPrompt || '').substring(0, 60) }}{{ (p.systemPrompt || '').length > 60 ? '...' : '' }}
            </p>
          </div>
          <div class="prompt-actions">
            <button v-if="!p.isActive && !p.isBuiltin" @click="configStore.setActivePrompt(p.id)">
              设为默认
            </button>
            <button class="danger" @click="handleDeletePrompt(p.id)" :disabled="p.isBuiltin">
              删除
            </button>
          </div>
        </div>

        <div v-if="configStore.prompts.length === 0" class="empty-hint">
          暂无 Prompt 模板
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prompt-setting h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--color-text, #1a1a1a);
}

.subsection {
  margin-bottom: 32px;
}

.subsection h4 {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: var(--color-text, #1a1a1a);
}

.prompt-list {
  margin-bottom: 16px;
}

.prompt-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 16px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  margin-bottom: 8px;
  background: var(--color-bg-surface, #fff);
  transition: all 0.2s;
}

.prompt-item:hover {
  border-color: var(--color-border-hover, #c0c0c0);
}

.prompt-item.active {
  border-color: var(--color-primary, #4f46e5);
  background: rgba(79, 70, 229, 0.05);
}

.prompt-info {
  flex: 1;
  min-width: 0;
}

.prompt-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.prompt-name {
  font-weight: 500;
  color: var(--color-text, #1a1a1a);
}

.prompt-item.active .prompt-name {
  color: var(--color-primary, #4f46e5);
}

.active-badge {
  color: var(--color-primary, #4f46e5);
  font-size: 12px;
  font-weight: 500;
  padding: 4px 8px;
  background: rgba(79, 70, 229, 0.1);
  border-radius: 4px;
}

.builtin-badge {
  font-size: 11px;
  padding: 2px 6px;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 4px;
}

.prompt-desc {
  font-size: 13px;
  color: var(--color-text-secondary, #666);
  margin: 4px 0;
}

.prompt-preview {
  font-size: 12px;
  color: #999;
  margin: 4px 0 0;
  font-family: monospace;
  background: #f9f9f9;
  padding: 4px 8px;
  border-radius: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 16px;
}

.prompt-actions button {
  padding: 6px 12px;
  font-size: 13px;
}

.add-form {
  padding: 20px;
  background: var(--color-bg-surface, #f9f9f9);
  border-radius: 12px;
  border: 1px solid var(--color-border, #e0e0e0);
  margin-bottom: 32px;
}

.add-form h5 {
  margin-bottom: 16px;
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.form-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.empty-hint {
  padding: 24px;
  text-align: center;
  color: #999;
  border: 1px dashed #ddd;
  border-radius: 8px;
  background: #fafafa;
}

input,
textarea {
  padding: 10px 12px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  background: var(--color-bg-surface, #fff);
  color: var(--color-text, #1a1a1a);
  font-size: 14px;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: var(--color-primary, #4f46e5);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

textarea {
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
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

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background: #4338ca;
}

button.danger {
  background: #dc2626;
  padding: 8px 12px;
}

button.danger:hover:not(:disabled) {
  background: #b91c1c;
}
</style>
