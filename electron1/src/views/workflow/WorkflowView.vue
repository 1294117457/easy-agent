<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useWorkflowStore } from '@/stores/workflow';
import type { WorkflowNode, StandardSchema } from '@/stores/workflow';

const workflowStore = useWorkflowStore();

// 工作流列表
const workflows = computed(() => workflowStore.workflows);
const currentWorkflow = computed(() => workflowStore.currentWorkflow);
const currentNodes = computed(() => workflowStore.currentWorkflowNodes);
const nodes = computed(() => workflowStore.nodes);
const plugins = computed(() => workflowStore.plugins);

// 创建工作流表单
const showWorkflowForm = ref(false);
const workflowForm = ref({
  name: '',
  description: '',
});

function openWorkflowForm() {
  workflowForm.value = { name: '', description: '' };
  showWorkflowForm.value = true;
}

function closeWorkflowForm() {
  showWorkflowForm.value = false;
}

async function createWorkflow() {
  if (!workflowForm.value.name.trim()) {
    alert('请输入工作流名称');
    return;
  }
  await workflowStore.createWorkflow(workflowForm.value.name, workflowForm.value.description);
  closeWorkflowForm();
}

// 创建节点表单
const showNodeForm = ref(false);
const nodeForm = ref({
  name: '',
  description: '',
  pluginId: '',
  toolName: '',
  inputSchema: {} as StandardSchema,
  outputSchema: {} as StandardSchema,
  inputMapping: {} as Record<string, string>,
  outputMapping: {} as Record<string, string>,
});

function openNodeForm() {
  nodeForm.value = {
    name: '',
    description: '',
    pluginId: plugins.value[0]?.id || '',
    toolName: '',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    inputMapping: {},
    outputMapping: {},
  };
  showNodeForm.value = true;
}

function closeNodeForm() {
  showNodeForm.value = false;
}

function addInputField() {
  const key = prompt('输入字段名:');
  if (key) {
    nodeForm.value.inputSchema.properties = {
      ...nodeForm.value.inputSchema.properties,
      [key]: { type: 'string' }
    };
  }
}

function addOutputField() {
  const key = prompt('输出字段名:');
  if (key) {
    nodeForm.value.outputSchema.properties = {
      ...nodeForm.value.outputSchema.properties,
      [key]: { type: 'string' }
    };
  }
}

function addInputMapping() {
  const from = prompt('规范输入字段 (例如: repo):');
  const to = prompt('Plugin 输入字段 (例如: owner/repo):');
  if (from && to) {
    nodeForm.value.inputMapping[from] = to;
  }
}

function addOutputMapping() {
  const from = prompt('Plugin 输出字段 (例如: title):');
  const to = prompt('规范输出字段 (例如: title):');
  if (from && to) {
    nodeForm.value.outputMapping[from] = to;
  }
}

async function saveNode() {
  if (!nodeForm.value.name || !nodeForm.value.pluginId || !nodeForm.value.toolName) {
    alert('请填写完整信息');
    return;
  }

  const result = await workflowStore.createNode({
    name: nodeForm.value.name,
    description: nodeForm.value.description,
    pluginId: nodeForm.value.pluginId,
    toolName: nodeForm.value.toolName,
    inputSchema: nodeForm.value.inputSchema,
    outputSchema: nodeForm.value.outputSchema,
    inputMapping: nodeForm.value.inputMapping,
    outputMapping: nodeForm.value.outputMapping,
  });

  if (result.success) {
    closeNodeForm();
  } else {
    alert(`创建失败: ${result.error}`);
  }
}

// 工作流操作
async function selectWorkflow(id: string) {
  await workflowStore.selectWorkflow(id);
}

async function handleDeleteWorkflow(id: string) {
  if (confirm('确定要删除这个工作流吗？')) {
    await workflowStore.deleteWorkflow(id);
  }
}

async function addNodeToWorkflow(nodeId: string) {
  if (!currentWorkflow.value) {
    alert('请先选择一个工作流');
    return;
  }
  await workflowStore.addNodeToWorkflow(currentWorkflow.value.id, nodeId);
}

async function removeNodeFromWorkflow(nodeId: string) {
  if (!currentWorkflow.value) return;
  await workflowStore.removeNodeFromWorkflow(currentWorkflow.value.id, nodeId);
}

async function deleteNode(id: string) {
  if (confirm('确定要删除这个节点吗？')) {
    await workflowStore.deleteNode(id);
  }
}

async function handleValidate() {
  if (!currentWorkflow.value) return;
  const result = await workflowStore.validateWorkflow(currentWorkflow.value.id);
  if (result.valid) {
    alert('工作流验证通过！');
  } else {
    alert(`验证失败: ${result.errors.join(', ')}`);
  }
}

const executeInput = ref('');
const executeResult = ref<any>(null);

async function handleExecute() {
  if (!currentWorkflow.value) return;
  let input;
  try {
    input = executeInput.value ? JSON.parse(executeInput.value) : {};
  } catch {
    input = executeInput.value ? { value: executeInput.value } : {};
  }
  executeResult.value = await workflowStore.executeWorkflow(currentWorkflow.value.id, input);
}

// 初始化
onMounted(async () => {
  await workflowStore.loadWorkflows();
  await workflowStore.loadNodes();
  await workflowStore.loadPlugins();
});
</script>

<template>
  <div class="workflow-view">
    <h3>工作流编排</h3>

    <div class="layout">
      <!-- 左侧：工作流列表 -->
      <div class="workflow-list-panel">
        <div class="section-header">
          <h4>工作流</h4>
          <button @click="openWorkflowForm" class="primary small">+ 新建</button>
        </div>

        <div class="workflow-list">
          <div v-if="workflows.length === 0" class="empty-hint">
            暂无工作流
          </div>

          <div
            v-for="wf in workflows"
            :key="wf.id"
            :class="['workflow-item', { active: currentWorkflow?.id === wf.id }]"
            @click="selectWorkflow(wf.id)"
          >
            <div class="workflow-info">
              <div class="workflow-name">{{ wf.name }}</div>
              <div class="workflow-meta">
                {{ wf.status }} | {{ new Date(wf.createdAt).toLocaleDateString() }}
              </div>
            </div>
            <button @click.stop="handleDeleteWorkflow(wf.id)" class="danger small">删除</button>
          </div>
        </div>
      </div>

      <!-- 中间：节点列表 -->
      <div class="node-list-panel">
        <div class="section-header">
          <h4>当前工作流的节点</h4>
          <button @click="openNodeForm" :disabled="!plugins.length" class="primary small">
            + 添加节点
          </button>
        </div>

        <div v-if="!currentWorkflow" class="empty-hint">
          请先选择一个工作流
        </div>

        <div v-else class="node-list">
          <div v-if="currentNodes.length === 0" class="empty-hint">
            此工作流暂无节点
          </div>

          <div v-for="node in currentNodes" :key="node.id" class="node-item">
            <div class="node-info">
              <div class="node-name">{{ node.name }}</div>
              <div class="node-meta">
                工具: {{ node.toolName }}
              </div>
            </div>
            <button @click="removeNodeFromWorkflow(node.id)" class="danger small">
              移除
            </button>
          </div>
        </div>

        <div v-if="currentWorkflow" class="workflow-actions">
          <button @click="handleValidate" class="secondary">验证</button>
        </div>
      </div>

      <!-- 右侧：所有节点管理 -->
      <div class="all-nodes-panel">
        <div class="section-header">
          <h4>所有节点</h4>
        </div>

        <div class="node-list">
          <div v-if="nodes.length === 0" class="empty-hint">
            暂无节点，点击上方按钮创建
          </div>

          <div v-for="node in nodes" :key="node.id" class="node-item">
            <div class="node-info">
              <div class="node-name">{{ node.name }}</div>
              <div class="node-meta">
                {{ node.toolName }}
              </div>
            </div>
            <div class="node-actions">
              <button
                v-if="currentWorkflow"
                @click="addNodeToWorkflow(node.id)"
                class="secondary small"
              >
                添加到工作流
              </button>
              <button @click="deleteNode(node.id)" class="danger small">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 执行面板 -->
    <div v-if="currentWorkflow" class="execute-panel">
      <h4>执行工作流: {{ currentWorkflow.name }}</h4>
      <div class="execute-form">
        <textarea
          v-model="executeInput"
          placeholder="输入 JSON 格式的输入参数，或留空"
          rows="3"
        ></textarea>
        <button @click="handleExecute" :disabled="workflowStore.executing" class="primary">
          {{ workflowStore.executing ? '执行中...' : '执行' }}
        </button>
      </div>
      <div v-if="executeResult" class="execute-result">
        <pre>{{ JSON.stringify(executeResult, null, 2) }}</pre>
      </div>
    </div>

    <!-- 创建工作流弹窗 -->
    <div v-if="showWorkflowForm" class="modal-overlay" @click.self="closeWorkflowForm">
      <div class="modal">
        <h5>创建工作流</h5>

        <div class="form-group">
          <label>名称</label>
          <input v-model="workflowForm.name" placeholder="例如: GitHub Issue 汇总" />
        </div>

        <div class="form-group">
          <label>描述</label>
          <input v-model="workflowForm.description" placeholder="可选描述" />
        </div>

        <div class="modal-actions">
          <button @click="closeWorkflowForm">取消</button>
          <button @click="createWorkflow" class="primary">创建</button>
        </div>
      </div>
    </div>

    <!-- 创建节点弹窗 -->
    <div v-if="showNodeForm" class="modal-overlay" @click.self="closeNodeForm">
      <div class="modal modal-large">
        <h5>创建节点</h5>

        <div class="form-group">
          <label>名称</label>
          <input v-model="nodeForm.name" placeholder="例如: 读取 Issue" />
        </div>

        <div class="form-group">
          <label>描述</label>
          <input v-model="nodeForm.description" placeholder="可选描述" />
        </div>

        <div class="form-row">
          <div class="form-group" style="flex: 1">
            <label>选择 Plugin</label>
            <select v-model="nodeForm.pluginId">
              <option v-for="p in plugins" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>
          </div>
          <div class="form-group" style="flex: 1">
            <label>选择工具</label>
            <input v-model="nodeForm.toolName" placeholder="例如: issue_read" />
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-header">
            <span>输入 Schema</span>
            <button @click="addInputField" class="small">+ 添加字段</button>
          </div>
          <div class="schema-preview">
            <pre>{{ JSON.stringify(nodeForm.inputSchema, null, 2) }}</pre>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-header">
            <span>输入映射</span>
            <button @click="addInputMapping" class="small">+ 添加映射</button>
          </div>
          <div class="mapping-list">
            <div v-for="(to, from) in nodeForm.inputMapping" :key="from" class="mapping-item">
              {{ from }} → {{ to }}
            </div>
            <div v-if="Object.keys(nodeForm.inputMapping).length === 0" class="empty-hint small">
              暂无映射
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-header">
            <span>输出 Schema</span>
            <button @click="addOutputField" class="small">+ 添加字段</button>
          </div>
          <div class="schema-preview">
            <pre>{{ JSON.stringify(nodeForm.outputSchema, null, 2) }}</pre>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-header">
            <span>输出映射</span>
            <button @click="addOutputMapping" class="small">+ 添加映射</button>
          </div>
          <div class="mapping-list">
            <div v-for="(to, from) in nodeForm.outputMapping" :key="from" class="mapping-item">
              {{ from }} → {{ to }}
            </div>
            <div v-if="Object.keys(nodeForm.outputMapping).length === 0" class="empty-hint small">
              暂无映射
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="closeNodeForm">取消</button>
          <button @click="saveNode" class="primary">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workflow-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 24px;
}

.workflow-view h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--color-text, #1a1a1a);
}

.layout {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h4 {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text, #1a1a1a);
}

.workflow-list-panel,
.node-list-panel,
.all-nodes-panel {
  background: var(--color-bg-surface, #fff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workflow-list,
.node-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workflow-item,
.node-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 6px;
  background: var(--color-bg, #fff);
  cursor: pointer;
  transition: all 0.2s;
}

.workflow-item:hover,
.node-item:hover {
  border-color: var(--color-primary, #4f46e5);
}

.workflow-item.active {
  border-color: var(--color-primary, #4f46e5);
  background: rgba(79, 70, 229, 0.05);
}

.workflow-name,
.node-name {
  font-weight: 500;
  font-size: 13px;
}

.workflow-meta,
.node-meta {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}

.workflow-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.node-actions {
  display: flex;
  gap: 4px;
}

.execute-panel {
  margin-top: 16px;
  padding: 16px;
  background: var(--color-bg-surface, #fff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
}

.execute-panel h4 {
  font-size: 14px;
  margin-bottom: 12px;
}

.execute-form {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.execute-form textarea {
  flex: 1;
}

.execute-result {
  margin-top: 12px;
  padding: 12px;
  background: #1a1a1a;
  border-radius: 8px;
  max-height: 200px;
  overflow: auto;
}

.execute-result pre {
  color: #10b981;
  font-size: 12px;
  font-family: monospace;
  margin: 0;
}

.empty-hint {
  padding: 16px;
  text-align: center;
  color: #999;
  font-size: 12px;
}

.empty-hint.small {
  padding: 8px;
  font-size: 11px;
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
  width: 400px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-large {
  width: 600px;
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

.form-row {
  display: flex;
  gap: 12px;
}

.form-section {
  margin-bottom: 16px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
}

.form-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
}

.schema-preview {
  background: #1a1a1a;
  border-radius: 6px;
  padding: 8px;
  max-height: 100px;
  overflow: auto;
}

.schema-preview pre {
  color: #10b981;
  font-size: 11px;
  font-family: monospace;
  margin: 0;
}

.mapping-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mapping-item {
  font-size: 12px;
  font-family: monospace;
  padding: 4px 8px;
  background: #fff;
  border-radius: 4px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

/* 按钮样式 */
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

button.small {
  padding: 4px 10px;
  font-size: 12px;
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
  width: 100%;
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
  font-family: monospace;
}
</style>
