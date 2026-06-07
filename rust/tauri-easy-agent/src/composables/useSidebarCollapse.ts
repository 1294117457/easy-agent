import { ref, provide, inject } from 'vue';

const COLLAPSE_KEY = Symbol('sidebarCollapse');

export function provideSidebarCollapse() {
  const collapsed = ref(false);
  provide(COLLAPSE_KEY, collapsed);
  return collapsed;
}

export function useSidebarCollapse() {
  const collapsed = inject<ReturnType<typeof provideSidebarCollapse>>(COLLAPSE_KEY);
  return collapsed ?? ref(false);
}
