<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { configApi } from '@/api/config';

const apiKeys = ref<any[]>([]);
const prompts = ref<any[]>([]);
const newKeyForm = ref({ provider: 'openai', key: '', model: 'gpt-4o' });
const newPromptForm = ref({ name: '', description: '', systemPrompt: '' });

onMounted(async () => {
  const config = await configApi.getConfig();
  apiKeys.value = config.apiKeys;
  prompts.value = config.prompts;
});

async function handleAddKey() {
  if (!newKeyForm.value.key.trim()) return;
  const created = await configApi.createApiKey(newKeyForm.value);
  apiKeys.value.push(created);
  newKeyForm.value = { provider: 'openai', key: '', model: 'gpt-4o' };
}

async function handleDeleteKey(id: string) {
  await configApi.deleteApiKey(id);
  apiKeys.value = apiKeys.value.filter((k) => k.id !== id);
}

async function handleAddPrompt() {
  if (!newPromptForm.value.name.trim() || !newPromptForm.value.systemPrompt.trim()) return;
  const created = await configApi.createPrompt(newPromptForm.value);
  prompts.value.push(created);
  newPromptForm.value = { name: '', description: '', systemPrompt: '' };
}
</script>

<template>
  <div class="settings-view">
    <h2>设置</h2>

    <section class="section">
      <h3>API Key 配置</h3>
      <div v-for="key in apiKeys" :key="key.id" class="item-row">
        <span>{{ key.provider }} / {{ key.model }}</span>
        <button class="danger" @click="handleDeleteKey(key.id)">删除</button>
      </div>
      <div class="form-row">
        <select v-model="newKeyForm.provider">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
        <input v-model="newKeyForm.key" placeholder="sk-..." />
        <input v-model="newKeyForm.model" placeholder="gpt-4o" style="width: 120px" />
        <button @click="handleAddKey">添加</button>
      </div>
    </section>

    <section class="section">
      <h3>Prompt 模板</h3>
      <div v-for="p in prompts" :key="p.id" class="item-row">
        <span>{{ p.name }}</span>
        <button class="danger" @click="configApi.deletePrompt(p.id); prompts = prompts.filter(x => x.id !== p.id)">删除</button>
      </div>
      <div class="form-column">
        <input v-model="newPromptForm.name" placeholder="模板名称" />
        <input v-model="newPromptForm.description" placeholder="描述（可选）" />
        <textarea
          v-model="newPromptForm.systemPrompt"
          placeholder="System Prompt..."
          rows="4"
        />
        <button @click="handleAddPrompt">保存</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-view {
  padding: 24px;
  max-width: 640px;
}
h2 {
  margin-bottom: 24px;
  font-size: 20px;
}
.section {
  margin-bottom: 32px;
}
.section h3 {
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--color-text-secondary, #666);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}
.form-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.form-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
input,
select,
textarea {
  padding: 8px 12px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--color-radius, 8px);
  background: var(--color-bg-surface, #fff);
  color: var(--color-text, #1a1a1a);
  font-size: 14px;
  flex: 1;
}
textarea {
  resize: vertical;
}
button {
  padding: 8px 16px;
  background: var(--color-primary, #4f46e5);
  color: white;
  border: none;
  border-radius: var(--color-radius, 8px);
  font-size: 14px;
  cursor: pointer;
}
button.danger {
  background: #dc2626;
}
button:hover {
  opacity: 0.9;
}
</style>
