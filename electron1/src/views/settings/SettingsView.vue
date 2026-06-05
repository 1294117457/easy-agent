<script setup lang="ts">
import { ref, onMounted, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import { useConfigStore } from '@/stores/config';
import SideTabList from '@/components/common/SideTabList.vue';
import type { TabItem } from '@/components/common/SideTabList.vue';
import { provideSidebarCollapse } from '@/composables/useSidebarCollapse';
import ApiKeySetting from './ApiKeySetting.vue';
import PromptSetting from './PromptSetting.vue';
import AppearanceSetting from './AppearanceSetting.vue';
import GeneralSetting from './GeneralSetting.vue';
import AboutSetting from './AboutSetting.vue';

provideSidebarCollapse();

type MenuKey = 'apikey' | 'prompt' | 'appearance' | 'general' | 'about';

interface SettingMenuItem extends TabItem {
  component: typeof ApiKeySetting;
}

const route = useRoute();
const configStore = useConfigStore();

const activeMenu = ref<MenuKey>('apikey');

const menuItems: SettingMenuItem[] = [
  { key: 'apikey', label: 'API Key', icon: '🔑', component: ApiKeySetting },
  { key: 'prompt', label: 'Prompt 模板', icon: '📝', component: PromptSetting },
  { key: 'appearance', label: '外观', icon: '🎨', component: AppearanceSetting },
  { key: 'general', label: '通用', icon: '⚡', component: GeneralSetting },
  { key: 'about', label: '关于', icon: 'ℹ️', component: AboutSetting },
];

const activeComponent = shallowRef(menuItems[0].component);

onMounted(async () => {
  await configStore.loadConfig();
  await configStore.loadLLMConfig();

  const tab = route.query.tab as string;
  if (tab) {
    const target = menuItems.find((m) => m.key === tab);
    if (target) {
      activeMenu.value = target.key;
      activeComponent.value = target.component;
    }
  }
});

function selectMenu(key: string) {
  const target = menuItems.find((m) => m.key === key);
  if (target) {
    activeMenu.value = target.key as MenuKey;
    activeComponent.value = target.component;
  }
}
</script>

<template>
  <div class="settings-view">
    <SideTabList
      title="设置"
      :items="menuItems"
      :active-key="activeMenu"
      @select="selectMenu"
    />

    <main class="content">
      <component :is="activeComponent" />
    </main>
  </div>
</template>

<style scoped>
.settings-view {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}
</style>
