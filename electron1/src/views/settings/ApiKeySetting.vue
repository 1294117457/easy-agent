<script setup lang="ts">
import { ref, computed } from 'vue';
import { useConfigStore } from '@/stores/config';

const configStore = useConfigStore();

const newKeyForm = ref({ provider: 'openai', key: '', model: 'gpt-4o', baseURL: '', useCustomModel: false });
const testingKey = ref<string | null>(null);
const testResult = ref<{ success: boolean; message: string } | null>(null);

const currentModels = computed(() => {
  const provider = configStore.providers.find((p) => p.id === newKeyForm.value.provider);
  return provider?.models || [];
});

const showBaseURL = computed(() => newKeyForm.value.provider === 'qwen');
const showModelSelect = computed(() => !newKeyForm.value.useCustomModel);

function onProviderChange() {
  const provider = configStore.providers.find((p) => p.id === newKeyForm.value.provider);
  if (provider && provider.models.length > 0) {
    newKeyForm.value.model = provider.models[0];
  }
  newKeyForm.value.baseURL = '';
}

async function handleAddKey() {
  if (!newKeyForm.value.key.trim()) return;

  const data: { provider: string; key: string; model: string; baseURL?: string } = {
    provider: newKeyForm.value.provider,
    key: newKeyForm.value.key,
    model: newKeyForm.value.model,
  };

  if (newKeyForm.value.provider === 'qwen' && newKeyForm.value.baseURL) {
    data.baseURL = newKeyForm.value.baseURL;
  }

  await configStore.createApiKey(data);
  await configStore.setActiveKey(configStore.apiKeys[configStore.apiKeys.length - 1].id);

  newKeyForm.value = { provider: newKeyForm.value.provider, key: '', model: newKeyForm.value.model, baseURL: '', useCustomModel: false };
}

async function handleDeleteKey(id: string) {
  await configStore.deleteApiKey(id);
}

async function handleSetDefault(keyId: string) {
  await configStore.setActiveKey(keyId);
}

async function handleTestConnection() {
  testingKey.value = 'new';
  testResult.value = null;

  try {
    const result = await configStore.testConnection({
      provider: newKeyForm.value.provider,
      apiKey: newKeyForm.value.key,
      model: newKeyForm.value.model,
      baseURL: newKeyForm.value.baseURL,
    });
    testResult.value = result;
  } catch (error) {
    testResult.value = { success: false, message: (error as Error).message };
  } finally {
    testingKey.value = null;
  }
}

function isDefaultKey(keyId: string) {
  return configStore.llmConfig?.keyId === keyId;
}

function getProviderName(provider: string) {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Claude',
    qwen: 'Qwen 千问',
    groq: 'Groq (免费)',
    deepseek: 'DeepSeek',
    gemini: 'Gemini',
    xiaomi: '小爱同学',
  };
  return names[provider] || provider;
}

function getProviderIcon(provider: string) {
  const icons: Record<string, string> = {
    openai: '🤖',
    anthropic: '🧠',
    qwen: '🐱',
    groq: '⚡',
    deepseek: '🔵',
    gemini: '✨',
    xiaomi: '📱',
  };
  return icons[provider] || '🔑';
}
</script>

<template>
  <div class="apikey-setting">
    <h3>🔑 API Key 管理</h3>

    <div class="add-form">
      <h5>添加新的 API Key</h5>
      <div class="form-row">
        <select v-model="newKeyForm.provider" @change="onProviderChange">
          <option v-for="p in configStore.providers" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>

        <template v-if="showModelSelect">
          <select v-model="newKeyForm.model">
            <option v-for="m in currentModels" :key="m" :value="m">{{ m }}</option>
          </select>
        </template>
        <template v-else>
          <input v-model="newKeyForm.model" placeholder="输入模型名称" style="flex: 1; min-width: 120px" />
        </template>

        <label class="custom-toggle">
          <input type="checkbox" v-model="newKeyForm.useCustomModel" />
          <span>自定义</span>
        </label>
      </div>

      <div class="form-row" v-if="showBaseURL">
        <input v-model="newKeyForm.baseURL" placeholder="Base URL (可选)" class="full-width" />
      </div>

      <div class="form-row">
        <input v-model="newKeyForm.key" placeholder="输入 API Key" class="full-width" />
      </div>

      <div class="form-row">
        <button @click="handleTestConnection" :disabled="!newKeyForm.key" class="test-btn">
          {{ testingKey ? '测试中...' : '测试连接' }}
        </button>
        <button @click="handleAddKey" :disabled="!newKeyForm.key">添加</button>
      </div>

      <div v-if="testResult" :class="['test-result', testResult.success ? 'success' : 'error']">
        {{ testResult.success ? '✅ 连接成功！' : `❌ 连接失败: ${testResult.message}` }}
      </div>
    </div>
    <h4>已配置的 API Key</h4>
    <div class="subsection">
      <div class="api-keys-list">
        <div
          v-for="key in configStore.apiKeys"
          :key="key.id"
          :class="['api-key-item', { active: isDefaultKey(key.id) }]"
        >
          <div class="key-info">
            <span class="provider-badge">{{ getProviderIcon(key.provider) }}</span>
            <span class="key-detail">
              <strong>{{ getProviderName(key.provider) }}</strong>
              / {{ key.model }}
            </span>
          </div>
          <div class="key-actions">
            <span v-if="isDefaultKey(key.id)" class="active-badge">使用中</span>
            <button v-else @click="handleSetDefault(key.id)">设为默认</button>
            <button class="danger" @click="handleDeleteKey(key.id)">删除</button>
          </div>
        </div>
        <div v-if="configStore.apiKeys.length === 0" class="empty-hint">
          暂无配置的 API Key
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.apikey-setting {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.apikey-setting h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--color-text, #1a1a1a);
}

.subsection {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin-bottom: 32px;
}

.subsection h4 {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: var(--color-text, #1a1a1a);
}

.api-keys-list {
  margin-bottom: 16px;
}

.api-key-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  margin-bottom: 8px;
  background: var(--color-bg-surface, #fff);
  transition: all 0.2s;
}

.api-key-item:hover {
  border-color: var(--color-border-hover, #c0c0c0);
}

.api-key-item.active {
  border-color: var(--color-primary, #4f46e5);
  background: rgba(79, 70, 229, 0.05);
}

.key-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.provider-badge {
  font-size: 20px;
}

.key-detail strong {
  font-weight: 500;
  color: var(--color-text, #1a1a1a);
}

.key-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.active-badge {
  color: var(--color-primary, #4f46e5);
  font-size: 12px;
  font-weight: 500;
  padding: 4px 8px;
  background: rgba(79, 70, 229, 0.1);
  border-radius: 4px;
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

.form-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.full-width {
  flex: 1;
  min-width: 200px;
}

.custom-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  background: var(--color-bg-surface, #fff);
  cursor: pointer;
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}

.custom-toggle input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.test-result {
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
}

.test-result.success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
}

.test-result.error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
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
select {
  padding: 10px 12px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  background: var(--color-bg-surface, #fff);
  color: var(--color-text, #1a1a1a);
  font-size: 14px;
}

input:focus,
select:focus {
  outline: none;
  border-color: var(--color-primary, #4f46e5);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

select {
  cursor: pointer;
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
