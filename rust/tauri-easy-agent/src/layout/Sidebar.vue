<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SideTabList from '@/components/common/SideTabList.vue';
import type { TabItem } from '@/components/common/SideTabList.vue';
import { provideSidebarCollapse } from '@/composables/useSidebarCollapse';

provideSidebarCollapse();

const route = useRoute();
const router = useRouter();

const items: TabItem[] = [
  { key: '/chat', label: '对话', icon: '💬' },
  { key: '/plugins', label: '插件', icon: '🔌' },
  { key: '/workflow', label: '工作流', icon: '🔀' },
  { key: '/settings', label: '设置', icon: '⚙️' },
];

const activeKey = ref(route.path);

function handleSelect(key: string) {
  activeKey.value = key;
  router.push(key);
}
</script>

<template>
  <SideTabList
    title="EasyAgent"
    :items="items"
    :active-key="activeKey"
    @select="handleSelect"
  />
</template>
