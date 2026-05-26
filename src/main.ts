import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './style.css';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/chat' },
    { path: '/chat', component: () => import('./views/ChatView.vue') },
    { path: '/flow', component: () => import('./views/FlowView.vue') },
    { path: '/plugins', component: () => import('./views/PluginView.vue') },
    { path: '/settings', component: () => import('./views/SettingsView.vue') },
    { path: '/history', component: () => import('./views/HistoryView.vue') },
  ],
});

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.use(router);
app.mount('#app');
