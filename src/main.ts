import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './style.css';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/chat' },
    { path: '/chat', component: () => import('./views/chat/ChatView.vue') },
    { path: '/flow', component: () => import('./views/flow/FlowView.vue') },
    { path: '/plugins', component: () => import('./views/plugin/PluginView.vue') },
    { path: '/settings', component: () => import('./views/settings/SettingsView.vue') },
  ],
});

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.use(router);
app.mount('#app');
