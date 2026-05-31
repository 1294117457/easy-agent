<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useWorkflowStore } from '@/stores/workflow';
import { workflowApi } from '@/api/workflow';
import type { McpServer, McpTool, McpConfig, McpConfigInput } from '@/stores/workflow';

const workflowStore = useWorkflowStore();

// ========== 状态 ==========

const servers = computed(() => workflowStore.mcpServers);
const connectedServers = computed(() => workflowStore.connectedServers);
const serverToolsMap = computed(() => workflowStore.serverTools);
const plugins = computed(() => workflowStore.plugins);

// 用于本地跟踪连接的服务器（避免修改 computed）
const localConnectedServers = ref<Set<string>>(new Set());

const availableServers = computed(() => {
  // 合并 store 和本地的连接状态
  const allConnected = new Set(workflowStore.connectedServers);
  localConnectedServers.value.forEach(id => allConnected.add(id));
  return servers.value.filter(s => allConnected.has(s.id));
});

// ========== 简化配置模式 ==========

const configText = ref('');        // 用户粘贴的配置 JSON
const inputValues = ref<Record<string, string>>({});  // 输入值
const requiredInputs = ref<McpConfigInput[]>([]);    // 需要的输入
const parsedConfig = ref<McpConfig | null>(null);    // 解析后的配置
const parsingError = ref<string | null>(null);
const connecting = ref(false);

async function parseConfig() {
  if (!configText.value.trim()) {
    parsingError.value = '请输入 MCP Server 配置';
    return;
  }

  parsingError.value = null;
  try {
    const result = await workflowStore.parseMcpConfig(configText.value);
    if (result.success) {
      parsedConfig.value = result.config;
      requiredInputs.value = result.config.inputs || [];

      // 初始化输入值
      inputValues.value = {};
      requiredInputs.value.forEach(input => {
        inputValues.value[input.id] = '';
      });
    } else {
      parsingError.value = result.error || '解析失败';
    }
  } catch (error) {
    parsingError.value = (error as Error).message;
  }
}

async function connectWithConfig() {
  console.log('[Frontend] connectWithConfig called');
  console.log('[Frontend] configText:', configText.value);
  if (!configText.value.trim()) {
    parsingError.value = '请输入 MCP Server 配置';
    return;
  }

  connecting.value = true;
  parsingError.value = null;

  try {
    console.log('[Frontend] Calling workflowApi.mcpConnectWithConfig...');
    // 直接调用 API，使用普通对象确保可序列化
    const result = await workflowApi.mcpConnectWithConfig(
      configText.value,
      { ...inputValues.value }
    );
    console.log('[Frontend] Result received:', JSON.stringify(result, null, 2));
    if (result.success) {
      // 将新连接的服务器添加到本地状态
      for (const serverResult of result.results || []) {
        if (serverResult.success) {
          // 添加到连接列表
          localConnectedServers.value.add(serverResult.id);

          // 添加到服务器列表 - 使用 workflowStore 的方法
          const newServer = {
            id: serverResult.id,
            name: serverResult.name,
            type: 'http' as const,
            enabled: true,
          };
          await workflowStore.addMcpServer(newServer);

          // 刷新工具列表
          await workflowStore.refreshServerTools(serverResult.id);
        } else {
          parsingError.value = `连接 ${serverResult.name} 失败: ${serverResult.error}`;
        }
      }

      // 清空表单
      configText.value = '';
      parsedConfig.value = null;
      requiredInputs.value = [];
      inputValues.value = {};
    } else {
      parsingError.value = result.error || '连接失败';
    }
  } catch (error) {
    console.error('[Frontend] Error caught:', error);
    parsingError.value = (error as Error).message;
  } finally {
    connecting.value = false;
  }
}

function clearConfig() {
  configText.value = '';
  parsedConfig.value = null;
  requiredInputs.value = [];
  inputValues.value = {};
  parsingError.value = null;
}

// ========== MCP Server 操作 ==========

async function handleConnect(server: McpServer) {
  const result = await workflowStore.connectMcpServer(server);
  if (!result.success) {
    alert(`连接失败: ${result.error}`);
  }
}

async function handleDisconnect(serverId: string) {
  await workflowStore.disconnectMcpServer(serverId);
}

async function handleDeleteServer(serverId: string) {
  if (confirm('确定要删除这个 MCP Server 吗？')) {
    await workflowStore.removeMcpServer(serverId);
  }
}

function isConnected(serverId: string): boolean {
  // 检查 store 和本地连接状态
  if (workflowStore.connectedServers.has(serverId)) return true;
  return localConnectedServers.value.has(serverId);
}

// ========== Plugin 操作 ==========

const showPluginForm = ref(false);
const pluginForm = ref({
  name: '',
  description: '',
  serverId: '',
  toolNames: [] as string[],
});

const selectedServerTools = computed(() => {
  if (!pluginForm.value.serverId) return [];
  return serverToolsMap.value.get(pluginForm.value.serverId) || [];
});

function openPluginForm() {
  pluginForm.value = {
    name: '',
    description: '',
    serverId: availableServers.value[0]?.id || '',
    toolNames: [],
  };
  showPluginForm.value = true;
}

function closePluginForm() {
  showPluginForm.value = false;
}

function toggleTool(toolName: string) {
  const index = pluginForm.value.toolNames.indexOf(toolName);
  if (index === -1) {
    pluginForm.value.toolNames.push(toolName);
  } else {
    pluginForm.value.toolNames.splice(index, 1);
  }
}

async function savePlugin() {
  if (!pluginForm.value.name || pluginForm.value.toolNames.length === 0) {
    alert('请填写名称并选择至少一个工具');
    return;
  }

  const result = await workflowStore.createPlugin({
    name: pluginForm.value.name,
    description: pluginForm.value.description,
    serverId: pluginForm.value.serverId,
    toolNames: pluginForm.value.toolNames,
  });

  if (result.success) {
    closePluginForm();
  } else {
    alert(`创建失败: ${result.error}`);
  }
}

async function handleDeletePlugin(pluginId: string) {
  if (confirm('确定要删除这个 Plugin 吗？')) {
    await workflowStore.deletePlugin(pluginId);
  }
}

// 初始化
onMounted(async () => {
  await workflowStore.loadMcpServers();
  await workflowStore.loadPlugins();
});
</script>

<template>
  <div class="plugin-view">
    <h3>MCP Server & Plugin 管理</h3>

    <!-- 简化配置区域 -->
    <div class="config-section">
      <h4>快速添加 MCP Server</h4>
      <p class="hint">
        粘贴 Server 提供的配置（支持 .mcp.json 格式），或只粘贴 servers 部分
      </p>

      <div class="config-input">
        <textarea
          v-model="configText"
          placeholder='粘贴配置，例如：
{
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp/",
  "headers": {
    "Authorization": "Bearer ${github_mcp_pat}"
  }
}

或完整格式：
{
  "servers": { ... },
  "inputs": [ ... ]
}'
          rows="8"
        ></textarea>
      </div>

      <!-- 需要的输入 -->
      <div v-if="requiredInputs.length > 0" class="inputs-section">
        <h5>需要填写的信息</h5>
        <div v-for="input in requiredInputs" :key="input.id" class="input-item">
          <label>{{ input.description || input.id }}</label>
          <input
            v-model="inputValues[input.id]"
            :type="input.password ? 'password' : 'text'"
            :placeholder="input.id"
          />
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="parsingError" class="error-message">
        {{ parsingError }}
      </div>

      <!-- 操作按钮 -->
      <div class="config-actions">
        <button @click="parseConfig" class="secondary">解析配置</button>
        <button @click="connectWithConfig" :disabled="connecting || !configText.trim()" class="primary">
          {{ connecting ? '连接中...' : '连接' }}
        </button>
        <button @click="clearConfig" class="secondary">清空</button>
      </div>
    </div>

    <!-- MCP Server 列表 -->
    <div class="section">
      <div class="section-header">
        <h4>已连接的 MCP Servers</h4>
      </div>

      <div class="server-list">
        <div v-if="servers.length === 0" class="empty-hint">
          暂无配置的 MCP Server
        </div>

        <div v-for="server in servers" :key="server.id" class="server-item">
          <div class="server-info">
            <div class="server-header">
              <span class="server-name">{{ server.name }}</span>
              <span :class="['status-badge', isConnected(server.id) ? 'connected' : 'disconnected']">
                {{ isConnected(server.id) ? '已连接' : '未连接' }}
              </span>
            </div>
            <div class="server-detail">
              <span>类型: {{ server.type }}</span>
              <span v-if="server.url">URL: {{ server.url }}</span>
              <span v-if="server.command">命令: {{ server.command }}</span>
            </div>
            <div v-if="isConnected(server.id)" class="tool-count">
              发现 {{ serverToolsMap.get(server.id)?.length || 0 }} 个工具
            </div>
          </div>
          <div class="server-actions">
            <template v-if="isConnected(server.id)">
              <button @click="handleDisconnect(server.id)" class="disconnect-btn">断开</button>
            </template>
            <template v-else>
              <button @click="handleConnect(server)" class="connect-btn">连接</button>
            </template>
            <button @click="handleDeleteServer(server.id)" class="danger">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Plugin 列表 -->
    <div class="section">
      <div class="section-header">
        <h4>Plugins</h4>
        <button @click="openPluginForm()" :disabled="availableServers.length === 0" class="primary">
          + 创建 Plugin
        </button>
      </div>

      <div class="plugin-list">
        <div v-if="plugins.length === 0" class="empty-hint">
          暂无 Plugin，连接 MCP Server 后可创建
        </div>

        <div v-for="plugin in plugins" :key="plugin.id" class="plugin-item">
          <div class="plugin-info">
            <div class="plugin-name">{{ plugin.name }}</div>
            <div class="plugin-desc">{{ plugin.description || '无描述' }}</div>
            <div class="plugin-tools">
              工具: {{ plugin.toolNames.join(', ') }}
            </div>
          </div>
          <div class="plugin-actions">
            <button @click="handleDeletePlugin(plugin.id)" class="danger">删除</button>
          </div>
        </div>
      </div>

      <div v-if="availableServers.length === 0" class="hint">
        请先连接一个 MCP Server 才能创建 Plugin
      </div>
    </div>

    <!-- Plugin 创建表单弹窗 -->
    <div v-if="showPluginForm" class="modal-overlay" @click.self="closePluginForm">
      <div class="modal">
        <h5>创建 Plugin</h5>

        <div class="form-group">
          <label>名称</label>
          <input v-model="pluginForm.name" placeholder="例如: GitHub Issues" />
        </div>

        <div class="form-group">
          <label>描述</label>
          <input v-model="pluginForm.description" placeholder="可选描述" />
        </div>

        <div class="form-group">
          <label>选择 MCP Server</label>
          <select v-model="pluginForm.serverId">
            <option v-for="server in availableServers" :key="server.id" :value="server.id">
              {{ server.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>选择工具</label>
          <div class="tool-list">
            <label v-for="tool in selectedServerTools" :key="tool.name" class="tool-item">
              <input
                type="checkbox"
                :checked="pluginForm.toolNames.includes(tool.name)"
                @change="toggleTool(tool.name)"
              />
              <span class="tool-name">{{ tool.name }}</span>
              <span class="tool-desc">{{ tool.description }}</span>
            </label>
            <div v-if="selectedServerTools.length === 0" class="empty-hint">
              请先连接一个 MCP Server
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="closePluginForm">取消</button>
          <button @click="savePlugin" class="primary">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plugin-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 24px;
}

.plugin-view h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--color-text, #1a1a1a);
}

.config-section {
  background: var(--color-bg-surface, #fff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.config-section h4 {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--color-text, #1a1a1a);
}

.config-input textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  background: #fafafa;
  font-family: monospace;
  font-size: 13px;
  resize: vertical;
  box-sizing: border-box;
}

.config-input textarea:focus {
  outline: none;
  border-color: var(--color-primary, #4f46e5);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.inputs-section {
  margin-top: 16px;
  padding: 16px;
  background: #f0f9ff;
  border-radius: 8px;
  border: 1px solid #bae6fd;
}

.inputs-section h5 {
  font-size: 13px;
  font-weight: 500;
  color: #0369a1;
  margin-bottom: 12px;
}

.input-item {
  margin-bottom: 12px;
}

.input-item:last-child {
  margin-bottom: 0;
}

.input-item label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.input-item input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.input-item input:focus {
  outline: none;
  border-color: var(--color-primary, #4f46e5);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.error-message {
  margin-top: 12px;
  padding: 12px;
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  font-size: 13px;
}

.config-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.section {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h4 {
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text, #1a1a1a);
}

.server-list,
.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.server-item,
.plugin-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  background: var(--color-bg-surface, #fff);
}

.server-info,
.plugin-info {
  flex: 1;
}

.server-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.server-name,
.plugin-name {
  font-weight: 500;
  color: var(--color-text, #1a1a1a);
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}

.status-badge.connected {
  background: #dcfce7;
  color: #166534;
}

.status-badge.disconnected {
  background: #fee2e2;
  color: #991b1b;
}

.server-detail {
  font-size: 12px;
  color: #666;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.tool-count {
  font-size: 12px;
  color: #4f46e5;
  margin-top: 4px;
}

.plugin-desc {
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.plugin-tools {
  font-size: 12px;
  color: #888;
}

.server-actions,
.plugin-actions {
  display: flex;
  gap: 8px;
}

.empty-hint {
  padding: 24px;
  text-align: center;
  color: #999;
  border: 1px dashed #ddd;
  border-radius: 8px;
  background: #fafafa;
}

.hint {
  font-size: 12px;
  color: #666;
  margin-top: 8px;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--color-bg, #fff);
  border-radius: 12px;
  padding: 24px;
  width: 500px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
}

.modal h5 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--color-text, #1a1a1a);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  margin-bottom: 6px;
}

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
}

.tool-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
}

.tool-item:hover {
  background: #f0f0f0;
}

.tool-item input {
  margin-top: 2px;
}

.tool-name {
  font-weight: 500;
  font-size: 13px;
}

.tool-desc {
  font-size: 12px;
  color: #666;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

/* 通用按钮样式 */
button {
  padding: 8px 16px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 6px;
  background: var(--color-bg-surface, #fff);
  color: var(--color-text, #1a1a1a);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

button:hover:not(:disabled) {
  background: var(--color-bg-hover, #f5f5f5);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.primary {
  background: var(--color-primary, #4f46e5);
  color: #fff;
  border-color: var(--color-primary, #4f46e5);
}

button.primary:hover:not(:disabled) {
  background: #4338ca;
}

button.secondary {
  background: #f3f4f6;
  color: #1a1a1a;
}

button.secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

button.connect-btn {
  background: #16a34a;
  color: #fff;
  border-color: #16a34a;
}

button.connect-btn:hover:not(:disabled) {
  background: #15803d;
}

button.disconnect-btn {
  background: #ca8a04;
  color: #fff;
  border-color: #ca8a04;
}

button.disconnect-btn:hover:not(:disabled) {
  background: #a16207;
}

button.danger {
  background: #dc2626;
  color: #fff;
  border-color: #dc2626;
}

button.danger:hover:not(:disabled) {
  background: #b91c1c;
}

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
select:focus {
  outline: none;
  border-color: var(--color-primary, #4f46e5);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}
</style>
