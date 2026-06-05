import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { configApi } from '@/api/config';

export interface ApiKey {
  id: string;
  provider: string;
  model: string;
  baseURL?: string;
  enabled: boolean;
  createdAt: string;
}

export interface Prompt {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  isBuiltin: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  models: string[];
}

export interface LLMConfig {
  keyId: string;
  provider: string;
  model: string;
}

export const useConfigStore = defineStore('config', () => {
  // 状态
  const apiKeys = ref<ApiKey[]>([]);
  const prompts = ref<Prompt[]>([]);
  const activePromptId = ref<string | null>(null);
  const activeKeyId = ref<string | null>(null);
  const llmConfig = ref<LLMConfig | null>(null);
  const providers = ref<LLMProvider[]>([]);

  // 计算属性
  const activeKey = computed(() => apiKeys.value.find(k => k.id === activeKeyId.value) || null);
  const activePrompt = computed(() => prompts.value.find(p => p.id === activePromptId.value) || null);

  // 加载所有配置
  async function loadConfig() {
    try {
      const config = await configApi.getConfig();
      apiKeys.value = config.apiKeys || [];
      prompts.value = config.prompts || [];

      // 查找激活的 API Key（优先从 llmConfig.keyId 获取）
      if (config.llmConfig?.keyId) {
        activeKeyId.value = config.llmConfig.keyId;
      } else {
        const activeKey = config.apiKeys?.find((k: any) => k.enabled);
        activeKeyId.value = activeKey?.id || null;
      }

      // 查找激活的 Prompt
      const activePrompt = config.prompts?.find((p: any) => p.isActive);
      activePromptId.value = activePrompt?.id || null;

      llmConfig.value = config.llmConfig;
    } catch (error) {
      console.error('[ConfigStore] 加载配置失败:', error);
    }
  }

  // 加载 LLM 配置
  async function loadLLMConfig() {
    try {
      const [providerList, config, activePrompt] = await Promise.all([
        configApi.listProviders(),
        configApi.getActiveLLMConfig(),
        configApi.getActivePrompt(),
      ]);
      providers.value = providerList;
      llmConfig.value = config;
      // 同步 activeKeyId
      if (config?.keyId) {
        activeKeyId.value = config.keyId;
      }
      // 同步 activePromptId
      if (activePrompt?.id) {
        activePromptId.value = activePrompt.id;
        // 同时更新 prompts 中的 isActive 标志
        prompts.value.forEach((p) => {
          p.isActive = p.id === activePrompt.id;
        });
      }
    } catch (error) {
      console.error('[ConfigStore] 加载 LLM 配置失败:', error);
    }
  }

  // 创建 API Key
  async function createApiKey(data: {
    provider: string;
    key: string;
    model: string;
    baseURL?: string;
  }) {
    const created = await configApi.createApiKey(data);
    apiKeys.value.push(created);
    return created;
  }

  // 删除 API Key
  async function deleteApiKey(id: string) {
    await configApi.deleteApiKey(id);
    apiKeys.value = apiKeys.value.filter((k) => k.id !== id);
    // 如果删除的是当前使用的，重新加载配置
    if (llmConfig.value?.keyId === id) {
      await loadLLMConfig();
    }
  }

  // 设置默认 API Key
  async function setActiveKey(keyId: string) {
    await configApi.setActiveKey(keyId);
    // 更新本地状态
    apiKeys.value.forEach((k) => {
      k.enabled = k.id === keyId;
    });
    activeKeyId.value = keyId;
    llmConfig.value = { ...llmConfig.value, keyId };
  }

  // 创建 Prompt
  async function createPrompt(data: {
    name: string;
    description?: string;
    systemPrompt: string;
  }) {
    const created = await configApi.createPrompt(data);
    prompts.value.push(created);
    return created;
  }

  // 删除 Prompt
  async function deletePrompt(id: string) {
    await configApi.deletePrompt(id);
    prompts.value = prompts.value.filter((p) => p.id !== id);
    // 如果删除的是当前激活的，自动激活第一个
    if (activePromptId.value === id) {
      const remaining = prompts.value.filter((p) => !p.isBuiltin);
      if (remaining.length > 0) {
        await setActivePrompt(remaining[0].id);
      }
    }
  }

  // 设置激活的 Prompt
  async function setActivePrompt(id: string) {
    console.log('[ConfigStore] setActivePrompt 被调用, id:', id);
    await configApi.setActivePrompt(id);
    console.log('[ConfigStore] setActivePrompt API 调用完成');
    // 更新本地状态
    prompts.value.forEach((p) => {
      p.isActive = p.id === id;
    });
    activePromptId.value = id;
    console.log('[ConfigStore] setActivePrompt 完成, activePromptId:', activePromptId.value);
  }

  // 测试连接
  async function testConnection(data: {
    provider: string;
    apiKey: string;
    model: string;
    baseURL?: string;
  }) {
    return await configApi.testConnection(data);
  }

  return {
    // 状态
    apiKeys,
    prompts,
    activeKeyId,
    activePromptId,
    llmConfig,
    providers,
    // 计算属性
    activeKey,
    activePrompt,
    // 方法
    loadConfig,
    loadLLMConfig,
    createApiKey,
    deleteApiKey,
    setActiveKey,
    createPrompt,
    deletePrompt,
    setActivePrompt,
    testConnection,
  };
});
