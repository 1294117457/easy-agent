<script setup lang="ts">
import { computed } from 'vue';
import { useConfigStore } from '@/stores/config';
import { useRouter } from 'vue-router';
import DropdownSelector from '@/components/common/DropdownSelector.vue';

const configStore = useConfigStore();
const router = useRouter();

const options = computed(() =>
  configStore.apiKeys.map((k) => ({
    id: k.id,
    label: k.model,
    subLabel: providerNames[k.provider] ?? k.provider,
  }))
);

const providerNames: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  qwen: '通义千问',
  deepseek: 'DeepSeek',
  gemini: 'Google Gemini',
};

async function handleSelect(id: string) {
  await configStore.setActiveKey(id);
}

function handleFooterClick() {
  router.push('/settings?tab=apikey');
}
</script>

<template>
  <DropdownSelector
    label="模型"
    value="未选择"
    :options="options"
    :active-id="configStore.activeKeyId"
    footer-text="🔑 前往设置页面管理 API Key"
    empty-text="暂未配置 API Key"
    @select="handleSelect"
    @footer-click="handleFooterClick"
  />
</template>
