<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useConfigStore } from '@/stores/config';

const route = useRoute();
const configStore = useConfigStore();

// 当前选中的菜单
const activeMenu = ref<'apikey' | 'prompt' | 'appearance' | 'general' | 'about'>('apikey');

// API Key 表单
const newKeyForm = ref({ provider: 'openai', key: '', model: 'gpt-4o', baseURL: '', useCustomModel: false });
const newPromptForm = ref({ name: '', description: '', systemPrompt: '' });
const testingKey = ref<string | null>(null);
const testResult = ref<{ success: boolean; message: string } | null>(null);

// 计算属性
const currentModels = computed(() => {
  const provider = configStore.providers.find((p) => p.id === newKeyForm.value.provider);
  return provider?.models || [];
});

const showBaseURL = computed(() => {
  return newKeyForm.value.provider === 'qwen';
});

const showModelSelect = computed(() => {
  return !newKeyForm.value.useCustomModel;
});

// 外观设置
const theme = ref<'light' | 'dark' | 'system'>('system');
const fontSize = ref(14);

// 生命周期
onMounted(async () => {
  await configStore.loadConfig();
  await configStore.loadLLMConfig();

  // 支持 URL 参数高亮菜单
  const tab = route.query.tab as string;
  if (tab && ['apikey', 'prompt', 'appearance', 'general', 'about'].includes(tab)) {
    activeMenu.value = tab as typeof activeMenu.value;
  }

  if (configStore.providers.length > 0) {
    newKeyForm.value.provider = configStore.providers[0].id;
    newKeyForm.value.model = configStore.providers[0].models[0];
  }
});

// API Key 操作
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

// Prompt 操作
async function handleAddPrompt() {
  if (!newPromptForm.value.name.trim() || !newPromptForm.value.systemPrompt.trim()) return;
  // 转换为普通对象，避免 Vue 响应式对象无法被 IPC 序列化
  const data = { ...newPromptForm.value };
  await configStore.createPrompt(data);
  newPromptForm.value = { name: '', description: '', systemPrompt: '' };
}

function handleDeletePrompt(id: string) {
  if (confirm('确定要删除这个 Prompt 模板吗？')) {
    configStore.deletePrompt(id);
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

// 外观设置
function applyTheme() {
  const root = document.documentElement;
  if (theme.value === 'dark') {
    root.classList.add('dark');
  } else if (theme.value === 'light') {
    root.classList.remove('dark');
  } else {
    // system
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
  document.body.style.fontSize = `${fontSize.value}px`;
}

function handleThemeChange() {
  applyTheme();
}

function handleFontSizeChange() {
  applyTheme();
}

// 通用设置
const dataDir = ref('C:\\Users\\...\\easy-agent');
const enableDebugLog = ref(false);
const autoRestoreSession = ref(true);

function handleClearData() {
  if (confirm('确定要清除所有数据吗？这将删除所有对话和配置！')) {
    // TODO: 实现清除数据
    alert('功能开发中...');
  }
}
</script>

<template>
  <div class="settings-view">
    <!-- 左侧菜单 -->
    <nav class="menu-nav">
      <h2>设置</h2>
      <ul class="menu-list">
        <li>
          <button
            :class="['menu-item', { active: activeMenu === 'apikey' }]"
            @click="activeMenu = 'apikey'"
          >
            <span class="icon">🔑</span>
            <span>API Key</span>
          </button>
        </li>
        <li>
          <button
            :class="['menu-item', { active: activeMenu === 'prompt' }]"
            @click="activeMenu = 'prompt'"
          >
            <span class="icon">📝</span>
            <span>Prompt 模板</span>
          </button>
        </li>
        <li>
          <button
            :class="['menu-item', { active: activeMenu === 'appearance' }]"
            @click="activeMenu = 'appearance'"
          >
            <span class="icon">🎨</span>
            <span>外观</span>
          </button>
        </li>
        <li>
          <button
            :class="['menu-item', { active: activeMenu === 'general' }]"
            @click="activeMenu = 'general'"
          >
            <span class="icon">⚡</span>
            <span>通用</span>
          </button>
        </li>
        <li>
          <button
            :class="['menu-item', { active: activeMenu === 'about' }]"
            @click="activeMenu = 'about'"
          >
            <span class="icon">ℹ️</span>
            <span>关于</span>
          </button>
        </li>
      </ul>
    </nav>

    <!-- 右侧内容 -->
    <main class="content">
      <!-- API Key 设置 -->
      <section v-if="activeMenu === 'apikey'" class="content-section">
        <h3>🔑 API Key 管理</h3>

        <!-- 添加表单（在上） -->
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
              <input
                v-model="newKeyForm.model"
                placeholder="输入模型名称"
                style="flex: 1; min-width: 120px"
              />
            </template>

            <label class="custom-toggle">
              <input type="checkbox" v-model="newKeyForm.useCustomModel" />
              <span>自定义</span>
            </label>
          </div>

          <div class="form-row" v-if="showBaseURL">
            <input
              v-model="newKeyForm.baseURL"
              placeholder="Base URL (可选)"
              class="full-width"
            />
          </div>

          <div class="form-row">
            <input
              v-model="newKeyForm.key"
              placeholder="输入 API Key"
              class="full-width"
            />
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

        <!-- 已配置列表（在下） -->
        <div class="subsection">
          <h4>已配置的 API Key</h4>
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
      </section>

      <!-- Prompt 模板设置 -->
      <section v-if="activeMenu === 'prompt'" class="content-section">
        <h3>📝 Prompt 模板</h3>

        <!-- 添加表单（在上） -->
        <div class="add-form">
          <h5>添加新的 Prompt</h5>
          <div class="form-column">
            <input
              v-model="newPromptForm.name"
              placeholder="模板名称（必填）"
            />
            <input
              v-model="newPromptForm.description"
              placeholder="描述（可选）"
            />
            <textarea
              v-model="newPromptForm.systemPrompt"
              placeholder="System Prompt 内容..."
              rows="5"
            ></textarea>
            <button @click="handleAddPrompt" :disabled="!newPromptForm.name || !newPromptForm.systemPrompt">
              保存
            </button>
          </div>
        </div>

        <!-- 已配置列表（在下） -->
        <div class="subsection">
          <h4>已配置的 Prompt</h4>
          <div class="prompt-list">
            <div
              v-for="p in configStore.prompts"
              :key="p.id"
              :class="['prompt-item', { active: p.isActive }]"
            >
              <div class="prompt-info">
                <div class="prompt-header">
                  <span class="prompt-name">{{ p.name }}</span>
                  <span v-if="p.isActive" class="active-badge">使用中</span>
                  <span v-if="p.isBuiltin" class="builtin-badge">内置</span>
                </div>
                <p v-if="p.description" class="prompt-desc">{{ p.description }}</p>
                <p class="prompt-preview">{{ (p.systemPrompt || '').substring(0, 60) }}{{ (p.systemPrompt || '').length > 60 ? '...' : '' }}</p>
              </div>
              <div class="prompt-actions">
                <button v-if="!p.isActive && !p.isBuiltin" @click="configStore.setActivePrompt(p.id)">
                  设为默认
                </button>
                <button class="danger" @click="handleDeletePrompt(p.id)" :disabled="p.isBuiltin">
                  删除
                </button>
              </div>
            </div>

            <div v-if="configStore.prompts.length === 0" class="empty-hint">
              暂无 Prompt 模板
            </div>
          </div>
        </div>
      </section>

      <!-- 外观设置 -->
      <section v-if="activeMenu === 'appearance'" class="content-section">
        <h3>🎨 外观设置</h3>

        <div class="setting-item">
          <label>主题</label>
          <div class="theme-buttons">
            <button
              :class="['theme-btn', { active: theme === 'light' }]"
              @click="theme = 'light'; handleThemeChange()"
            >
              ☀️ 浅色
            </button>
            <button
              :class="['theme-btn', { active: theme === 'dark' }]"
              @click="theme = 'dark'; handleThemeChange()"
            >
              🌙 深色
            </button>
            <button
              :class="['theme-btn', { active: theme === 'system' }]"
              @click="theme = 'system'; handleThemeChange()"
            >
              💻 跟随系统
            </button>
          </div>
        </div>

        <div class="setting-item">
          <label>字体大小</label>
          <select v-model="fontSize" @change="handleFontSizeChange">
            <option :value="12">12px</option>
            <option :value="14">14px</option>
            <option :value="16">16px</option>
            <option :value="18">18px</option>
          </select>
        </div>
      </section>

      <!-- 通用设置 -->
      <section v-if="activeMenu === 'general'" class="content-section">
        <h3>⚡ 通用设置</h3>

        <div class="setting-item">
          <label>数据目录</label>
          <div class="path-display">
            <span class="path-text">{{ dataDir }}</span>
            <button>浏览</button>
          </div>
        </div>

        <div class="setting-item">
          <label class="checkbox-label">
            <input type="checkbox" v-model="autoRestoreSession" />
            <span>启动时自动打开上次的对话</span>
          </label>
        </div>

        <div class="setting-item">
          <label class="checkbox-label">
            <input type="checkbox" v-model="enableDebugLog" />
            <span>启用调试日志</span>
          </label>
        </div>

        <div class="setting-item danger-zone">
          <label>危险区域</label>
          <button class="danger" @click="handleClearData">清除所有数据</button>
        </div>
      </section>

      <!-- 关于 -->
      <section v-if="activeMenu === 'about'" class="content-section">
        <h3>ℹ️ 关于 EasyAgent</h3>

        <div class="about-info">
          <div class="app-icon">🤖</div>
          <h4>EasyAgent</h4>
          <p class="version">版本 0.1.0</p>
          <p class="desc">一个简单易用的 AI Agent 桌面应用</p>

          <div class="tech-stack">
            <span class="tech-tag">Electron</span>
            <span class="tech-tag">Vue 3</span>
            <span class="tech-tag">TypeScript</span>
            <span class="tech-tag">Pinia</span>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.settings-view {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* 左侧菜单 */
.menu-nav {
  width: 200px;
  background: var(--color-bg-elevated, #f5f5f5);
  border-right: 1px solid var(--color-border, #e0e0e0);
  padding: 20px 0;
  flex-shrink: 0;
}

.menu-nav h2 {
  padding: 0 20px 20px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-primary, #4f46e5);
}

.menu-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 20px;
  background: transparent;
  border: none;
  color: var(--color-text-secondary, #666);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.menu-item:hover {
  background: var(--color-bg-surface, #fff);
  color: var(--color-text, #1a1a1a);
}

.menu-item.active {
  background: var(--color-primary, #4f46e5);
  color: white;
}

.menu-item .icon {
  font-size: 16px;
}

/* 右侧内容 */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}

.content-section h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--color-text, #1a1a1a);
}

.subsection {
  margin-bottom: 32px;
}

.subsection h4 {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: var(--color-text, #1a1a1a);
}

/* API Key 列表 */
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

/* Prompt 列表样式 */
.prompt-list {
  margin-bottom: 16px;
}

.prompt-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 16px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  margin-bottom: 8px;
  background: var(--color-bg-surface, #fff);
  transition: all 0.2s;
}

.prompt-item:hover {
  border-color: var(--color-border-hover, #c0c0c0);
}

.prompt-item.active {
  border-color: var(--color-primary, #4f46e5);
  background: rgba(79, 70, 229, 0.05);
}

.prompt-info {
  flex: 1;
  min-width: 0;
}

.prompt-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.prompt-name {
  font-weight: 500;
  color: var(--color-text, #1a1a1a);
}

.prompt-item.active .prompt-name {
  color: var(--color-primary, #4f46e5);
}

.builtin-badge {
  font-size: 11px;
  padding: 2px 6px;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 4px;
}

.prompt-desc {
  font-size: 13px;
  color: var(--color-text-secondary, #666);
  margin: 4px 0;
}

.prompt-preview {
  font-size: 12px;
  color: #999;
  margin: 4px 0 0;
  font-family: monospace;
  background: #f9f9f9;
  padding: 4px 8px;
  border-radius: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 16px;
}

.prompt-actions button {
  padding: 6px 12px;
  font-size: 13px;
}

/* 添加表单 */
.add-form {
  padding: 20px;
  background: var(--color-bg-surface, #f9f9f9);
  border-radius: 12px;
  border: 1px solid var(--color-border, #e0e0e0);
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

.form-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
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

/* 设置项 */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.setting-item > label:first-child {
  font-size: 14px;
  color: var(--color-text, #1a1a1a);
}

.theme-buttons {
  display: flex;
  gap: 8px;
}

.theme-btn {
  padding: 8px 16px;
  background: var(--color-bg-elevated, #f5f5f5);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.theme-btn:hover {
  border-color: var(--color-primary, #4f46e5);
}

.theme-btn.active {
  background: var(--color-primary, #4f46e5);
  color: white;
  border-color: var(--color-primary, #4f46e5);
}

.path-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.path-text {
  padding: 8px 12px;
  background: var(--color-bg-elevated, #f5f5f5);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text-secondary, #666);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
}

.danger-zone {
  border-bottom: none;
  padding-top: 24px;
}

.danger-zone > label {
  color: #dc2626;
}

/* 测试结果 */
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

/* 通用样式 */
.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.empty-hint {
  padding: 24px;
  text-align: center;
  color: #999;
  border: 1px dashed #ddd;
  border-radius: 8px;
  background: #fafafa;
}

/* 关于页面 */
.about-info {
  text-align: center;
  padding: 40px 20px;
}

.app-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.about-info h4 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
}

.version {
  color: var(--color-text-secondary, #666);
  margin-bottom: 8px;
}

.desc {
  color: var(--color-text-secondary, #666);
  margin-bottom: 24px;
}

.tech-stack {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tech-tag {
  padding: 6px 12px;
  background: var(--color-bg-elevated, #f5f5f5);
  border-radius: 16px;
  font-size: 12px;
  color: var(--color-text-secondary, #666);
}

/* 通用表单样式 */
input,
select,
textarea {
  padding: 10px 12px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  background: var(--color-bg-surface, #fff);
  color: var(--color-text, #1a1a1a);
  font-size: 14px;
}

input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--color-primary, #4f46e5);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

textarea {
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
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

select {
  cursor: pointer;
}
</style>
