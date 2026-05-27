# Prompt 模板功能优化文档

> 创建日期：2026-05-27
> 状态：待开发
> 优先级：高

---

## 一、问题分析

### 1.1 当前问题

**错误信息**：
```
Error: An object could not be cloned.
    at Object.createPrompt (config.ts:8:24)
```

**根因**：Electron IPC 通信要求数据可序列化，传递 Vue 响应式对象会失败。

### 1.2 当前设计缺陷

1. **无多 Prompt 支持**：只能保存一个 Prompt，切换不便
2. **无激活状态**：所有 Prompt 平等，无法设置「当前使用」
3. **无选择机制**：对话时无法选择使用哪个 Prompt

---

## 二、优化方案设计

### 2.1 目标设计（参考 API Key 模式）

```
设置 → 模型 → Prompt 模板
├── Prompt 列表（可多份）
│   ├── [ ] 默认助手 - "你是一个有帮助的AI助手..."
│   ├── [✓] 代码助手 - "你是一个专业的程序员..."
│   └── [ ] 翻译助手 - "你是一个专业翻译..."
│
└── 添加新 Prompt
    ├── 名称：_______________
    ├── 描述：_______________
    └── System Prompt：
        ┌─────────────────────────────────┐
        │ 你是一个专业的...               │
        │                                  │
        └─────────────────────────────────┘
```

### 2.2 数据结构

```typescript
// Prompt 接口
interface Prompt {
  id: string;
  name: string;                    // 友好名称
  description?: string;            // 描述
  systemPrompt: string;            // System Prompt 内容
  isBuiltin: boolean;              // 是否内置（不可删除）
  isActive: boolean;               // 是否当前激活
  createdAt: string;
  updatedAt: string;
}
```

### 2.3 与 API Key 的类比

| API Key | Prompt |
|---------|--------|
| 多个 Key 管理 | 多个 Prompt 管理 |
| 设为默认（当前使用） | 设为默认（当前使用） |
| 选择不同 Provider/Model | 选择不同 Prompt 场景 |
| 测试连接 | 预览效果 |

---

## 三、界面设计

### 3.1 Prompt 列表区域

```
┌─ Prompt 模板 ──────────────────────────────────────────┐
│                                                    [全部展开]│
│ ┌──────────────────────────────────────────────────┐ │
│ │ ☐  默认助手                                [删除] │ │
│ │    "你是一个有帮助的AI助手..."                  │ │
│ ├──────────────────────────────────────────────────┤ │
│ │ ☑  代码助手（使用中）                   [删除] │ │
│ │    "你是一个专业的程序员，擅长..."             │ │
│ │    [编辑]                                       │ │
│ ├──────────────────────────────────────────────────┤ │
│ │ ☐  翻译助手                              [删除] │ │
│ │    "你是一个专业翻译，擅长中英互译..."        │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ + 添加新 Prompt                                      │
└──────────────────────────────────────────────────────┘
```

### 3.2 添加/编辑表单

```
┌─ 添加 Prompt ──────────────────────────────────────────┐
│                                                      │
│ 名称：  [代码助手________________]                   │
│                                                      │
│ 描述：  [专业程序员助手___________]  (可选)          │
│                                                      │
│ System Prompt：                                       │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 你是一个专业的程序员，擅长：                     │ │
│ │ 1. 编写高质量代码                               │ │
│ │ 2. 代码审查和优化                               │ │
│ │ 3. 解决技术难题                                 │ │
│ │                                                    │ │
│ │ 请用简洁、专业的语言回答。                       │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ 变量支持：{{language}} {{task_type}}                │
│                                                      │
│          [取消]  [保存为默认]  [保存]               │
└──────────────────────────────────────────────────────┘
```

### 3.3 聊天界面使用

```
┌─ 对话配置 ───────────────────────────────────────────┐
│                                                    │
│ 当前 Prompt：                                        │
│ [代码助手 ▾]                                        │
│  ┌─────────────────┐                                │
│  │ ☑ 代码助手      │  ← 下拉选择                   │
│  │ ○ 默认助手      │                                │
│  │ ○ 翻译助手      │                                │
│  └─────────────────┘                                │
│                                                    │
│            [开始对话]                               │
└────────────────────────────────────────────────────┘
```

---

## 四、后端改动

### 4.1 Storage 接口变更

```typescript
// storage.port.ts
interface IStoragePort {
  // 现有
  createPrompt(data: CreatePromptDTO): Prompt;
  listPrompts(): Prompt[];
  updatePrompt(id: string, data: Partial<Prompt>): boolean;
  deletePrompt(id: string): boolean;

  // 新增
  setActivePrompt(id: string): void;           // 设置默认 Prompt
  getActivePrompt(): Prompt | null;               // 获取当前 Prompt
}
```

### 4.2 数据库变更

```sql
-- prompts 表新增字段
ALTER TABLE prompts ADD COLUMN is_active INTEGER DEFAULT 0;
```

### 4.3 AgentService 变更

```typescript
// AgentService.ts
async sendMessage(...) {
  // 改为使用当前激活的 Prompt，而非第一个
  const activePrompt = this.storagePort.getActivePrompt();
  const systemPrompt =
    activePrompt?.systemPrompt ||
    '你是 EasyAgent，一个智能助手。简洁回答问题。';
  // ...
}
```

---

## 五、前端改动

### 5.1 ConfigStore 变更

```typescript
// stores/config.ts
export const useConfigStore = defineStore('config', () => {
  // 状态
  const prompts = ref<Prompt[]>([]);
  const activePromptId = ref<string | null>(null);

  // 计算属性
  const activePrompt = computed(() =>
    prompts.value.find(p => p.id === activePromptId.value)
  );

  // 方法
  async function createPrompt(data: CreatePromptDTO) {
    const created = await configApi.createPrompt(data);
    prompts.value.push(created);
    return created;
  }

  async function setActivePrompt(id: string) {
    await configApi.setActivePrompt(id);
    // 更新本地状态
    prompts.value.forEach(p => p.isActive = p.id === id);
    activePromptId.value = id;
  }

  async function deletePrompt(id: string) {
    await configApi.deletePrompt(id);
    prompts.value = prompts.value.filter(p => p.id !== id);
    // 如果删除的是当前激活的，重置
    if (activePromptId.value === id) {
      activePromptId.value = prompts.value[0]?.id || null;
    }
  }

  // ...
});
```

### 5.2 API 层变更

```typescript
// api/config.ts
export const configApi = {
  // 现有
  createPrompt: (data: CreatePromptDTO) =>
    window.electronAPI.createPrompt(data),
  deletePrompt: (id: string) =>
    window.electronAPI.deletePrompt(id),

  // 新增
  setActivePrompt: (id: string) =>
    window.electronAPI.setActivePrompt(id),
  getActivePrompt: () =>
    window.electronAPI.getActivePrompt(),
};
```

### 5.3 IPC Handler 变更

```typescript
// ipc/config.handler.ts

// 新增：设置默认 Prompt
ipcMain.handle('config:prompt:setActive', (_, id: string) => {
  // 取消所有激活状态
  const prompts = storage.listPrompts();
  for (const p of prompts) {
    storage.updatePrompt(p.id, { isActive: false });
  }
  // 设置目标为激活
  storage.updatePrompt(id, { isActive: true });
  return true;
});

// 新增：获取当前激活 Prompt
ipcMain.handle('config:prompt:getActive', () => {
  const prompts = storage.listPrompts();
  return prompts.find(p => p.isActive) || null;
});
```

---

## 六、变量支持（高级功能）

### 6.1 概念

在 Prompt 中使用变量，运行时替换：

```
你是一个{{language}}程序员，擅长{{task_type}}。
当前时间：{{current_time}}
```

### 6.2 实现

```typescript
interface PromptVariable {
  name: string;
  description: string;
  defaultValue?: string;
}

// Prompt 接口扩展
interface Prompt {
  // ...
  variables?: PromptVariable[];
  temperature?: number;
  maxTokens?: number;
}

// 渲染变量
function renderPrompt(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    context[key] || `{{${key}}}`
  );
}
```

---

## 七、文件变更清单

### 7.1 新增文件

```
- 无新增文件
```

### 7.2 修改文件

| 文件 | 变更 |
|------|------|
| `electron/core/adapters/storage/sqlite.adapter.ts` | 添加 `is_active` 字段处理 |
| `electron/core/ports/storage.port.ts` | 添加 `setActivePrompt` 接口 |
| `electron/core/application/AgentService.ts` | 使用 `getActivePrompt()` |
| `electron/ipc/config.handler.ts` | 添加 `prompt:setActive`, `prompt:getActive` |
| `electron/preload.ts` | 暴露新 API |
| `src/types/electron.d.ts` | 添加类型定义 |
| `src/api/config.ts` | 添加 `setActivePrompt`, `getActivePrompt` |
| `src/stores/config.ts` | 重构 Prompt 管理逻辑 |
| `src/views/SettingsView.vue` | 重新设计 Prompt UI |

---

## 八、实施步骤

### Step 1: 后端基础（优先级：高）
1. 修改 SQLite 表结构，添加 `is_active` 字段
2. 实现 `setActivePrompt` 和 `getActivePrompt` 方法
3. 修改 `AgentService` 使用激活的 Prompt

### Step 2: IPC 层（优先级：高）
1. 注册新的 IPC handlers
2. 在 preload 中暴露新 API
3. 更新 TypeScript 类型定义

### Step 3: 前端 Store（优先级：高）
1. 重构 `useConfigStore` 中的 Prompt 逻辑
2. 添加 `setActivePrompt` 方法
3. 添加 `activePrompt` 计算属性

### Step 4: 前端 UI（优先级：中）
1. 重新设计 Prompt 列表界面
2. 添加「设为默认」按钮
3. 添加「使用中」状态显示

---

## 九、测试计划

### 9.1 功能测试
- [ ] 添加多个 Prompt
- [ ] 设置默认 Prompt
- [ ] 删除默认 Prompt（自动切换到下一个）
- [ ] 对话使用正确的 Prompt

### 9.2 边界测试
- [ ] 所有 Prompt 都删除后
- [ ] 只剩一个 Prompt 时设为默认
- [ ] 刷新页面后状态保持

---

## 十、注意事项

1. **数据迁移**：现有数据需要设置 `is_active = false`，第一个 Prompt 自动设为激活
2. **向后兼容**：如果没有任何 Prompt，使用默认系统提示词
3. **安全性**：内置 Prompt 不可删除，只能修改 `is_active`
