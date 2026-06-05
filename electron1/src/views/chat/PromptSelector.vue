<script setup lang="ts">
import { computed } from 'vue';
import { useConfigStore } from '@/stores/config';
import { useRouter } from 'vue-router';
import DropdownSelector from '@/components/common/DropdownSelector.vue';

const configStore = useConfigStore();
const router = useRouter();

const options = computed(() =>
  configStore.prompts.map((p: { id: string; name: string }) => ({
    id: p.id,
    label: p.name,
  }))
);

async function handleSelect(id: string) {
  await configStore.setActivePrompt(id);
}

function handleFooterClick() {
  router.push('/settings?tab=prompt');
}
</script>

<template>
  <DropdownSelector
    label="Prompt"
    value="默认"
    :options="options"
    :active-id="configStore.activePromptId"
    footer-text="📝 前往设置页面管理 Prompt"
    empty-text="暂未配置 Prompt"
    @select="handleSelect"
    @footer-click="handleFooterClick"
  />
</template>
