# Prompt & API Key 设置优化文档

> 创建日期：2026-05-27
> 状态：待开发
> 优先级：高

---

## 一、问题分析

### 1.1 Prompt 失效问题

**问题描述**：在设置页面配置好 Prompt，切换到对话页面后，Prompt 配置丢失。

**可能原因**：
1. `loadConfig()` 未被调用或调用时机不对
2. ConfigStore 状态未持久化
3. 页面切换时状态重置

**检查点**：
- `SettingsView.vue` 的 `onMounted` 是否调用 `loadConfig()`
- `ChatView.vue` 的 `onMounted` 是否需要加载 Prompt 配置
- ConfigStore 的 prompts 状态是否响应式正确更新

---

## 二、UI 重新设计

### 2.1 设置页面布局

**当前布局**：
```
设置 → 模型
├── Prompt 模板
│   ├── 已配置列表（在上）
│   └── 添加表单（在下）  ← 需要调整顺序
└── API Key 管理
    ├── 已配置列表（在上）
    └── 添加表单（在下）  ← 需要调整顺序
```

**优化后布局**：表单在上，列表在下，方便用户快速添加
```
设置
├── API Key
│   ├── 添加表单（在上）
│   │   ├── Provider: [OpenAI ▼]
│   │   ├── 模型: [gpt-4o ▼]
│   │   └── API Key: [_____________]
│   │       [测试连接] [添加]
│   │
│   └── 已配置列表（在下）
│       ├── ● OpenAI / gpt-4o  [使用中] [删除]
│       ├── ○ DeepSeek / deepseek-chat  [设为默认] [删除]
│       └── ○ Anthropic / claude-3-5-sonnet  [设为默认] [删除]
│
├── Prompt 模板
│   ├── 添加表单（在上）
│   │   ├── 名称: [_____________]
│   │   ├── 描述: [_____________]
│   │   └── System Prompt:
│   │       ┌──────────────────────────┐
│   │       │ 你是一个专业的...        │
│   │       │                          │
│   │       └──────────────────────────┘
│   │       [保存]
│   │
│   └── 已配置列表（在下）
│       ├── ● 代码助手  [使用中] [删除]
│       ├── ○ 翻译助手  [设为默认] [删除]
│       └── ○ 默认助手  [设为默认] [删除]
│
├── 外观
├── 通用
└── 关于
```

### 2.2 聊天页面布局

**当前布局**：
```
┌─────────────────────────────────────┐
│ EasyAgent          [设置] [菜单]   │  ← 有设置按钮
├─────────────────────────────────────┤
│                                     │
│         消息列表区域                 │
│                                     │
├─────────────────────────────────────┤
│ [输入框]                      [发送]│
└─────────────────────────────────────┘
```

**优化后布局**：
```
┌─────────────────────────────────────┐
│ EasyAgent              [菜单]       │  ← 移除设置按钮
├─────────────────────────────────────┤
│ [模型: GPT-4o ▼] [Prompt: 代码助手 ▼] │  ← 新增选择器
├─────────────────────────────────────┤
│                                     │
│         消息列表区域                 │
│                                     │
├─────────────────────────────────────┤
│ [输入框]                      [发送]│
└─────────────────────────────────────┘
```

**点击选择器后的下拉悬浮框**：
```
┌─ 选择模型 ──────────────────────────┐
│                                     │
│ ○ GPT-4o-mini                      │
│ ● GPT-4o                      ← 当前│
│ ○ Claude 3.5 Sonnet                │
│ ○ DeepSeek Chat                    │
│                                     │
│ ─────────────────────────────────── │
│ 📝 前往设置页面管理 API Key         │  ← 跳转入口
└─────────────────────────────────────┘
```

---

## 三、数据流设计

### 3.1 状态管理

```typescript
// ConfigStore
interface ConfigStore {
  // API Key 相关
  apiKeys: Ref<ApiKey[]>;
  activeKeyId: Ref<string | null>;
  activeKey: ComputedRef<ApiKey | null>;

  // Prompt 相关
  prompts: Ref<Prompt[]>;
  activePromptId: Ref<string | null>;
  activePrompt: ComputedRef<Prompt | null>;

  // 方法
  loadConfig(): Promise<void>;
  setActiveKey(id: string): Promise<void>;
  setActivePrompt(id: string): Promise<void>;
}
```

### 3.2 页面加载时序

```
App 启动
    ↓
加载 ConfigStore（一次性）
    ↓
├── ChatView.vue 挂载
│   └── 显示 activeKey / activePrompt
│
└── SettingsView.vue 挂载
    └── 调用 loadConfig() 更新状态
```

---

## 四、组件设计

### 4.1 新增组件：ModelPromptSelector.vue

**位置**：`src/components/chat/ModelPromptSelector.vue`

**功能**：
- 显示当前选中的模型和 Prompt
- 点击弹出下拉选择框
- 最下方有跳转到设置页面的入口

**Props**：
```typescript
interface Props {
  // 无需 props，从 store 获取
}
```

**Emits**：
```typescript
interface Emits {
  (e: 'openSettings', tab: 'apikey' | 'prompt'): void;
}
```

### 4.2 组件结构

```vue
<template>
  <div class="model-prompt-selector">
    <!-- 模型选择器 -->
    <div class="selector-item" @click="toggleModelDropdown">
      <span class="label">模型:</span>
      <span class="value">{{ activeKey?.model || '未选择' }}</span>
      <span class="arrow">▼</span>
    </div>

    <!-- Prompt 选择器 -->
    <div class="selector-item" @click="togglePromptDropdown">
      <span class="label">Prompt:</span>
      <span class="value">{{ activePrompt?.name || '默认' }}</span>
      <span class="arrow">▼</span>
    </div>

    <!-- 下拉悬浮框 -->
    <Teleport to="body">
      <div v-if="showDropdown" class="dropdown-overlay" @click="closeDropdown">
        <div class="dropdown-panel" :style="dropdownStyle">
          <!-- 模型列表 -->
          <div class="dropdown-section">
            <div class="section-title">选择模型</div>
            <div
              v-for="key in apiKeys"
              :key="key.id"
              :class="['dropdown-item', { active: key.id === activeKeyId }]"
              @click="selectKey(key.id)"
            >
              <span class="radio">{{ key.id === activeKeyId ? '●' : '○' }}</span>
              <span class="name">{{ key.model }}</span>
              <span class="provider">{{ getProviderName(key.provider) }}</span>
            </div>
            <div v-if="apiKeys.length === 0" class="empty-hint">
              暂未配置 API Key
            </div>
          </div>

          <!-- Prompt 列表 -->
          <div class="dropdown-section">
            <div class="section-title">选择 Prompt</div>
            <div
              v-for="p in prompts"
              :key="p.id"
              :class="['dropdown-item', { active: p.id === activePromptId }]"
              @click="selectPrompt(p.id)"
            >
              <span class="radio">{{ p.id === activePromptId ? '●' : '○' }}</span>
              <span class="name">{{ p.name }}</span>
            </div>
            <div v-if="prompts.length === 0" class="empty-hint">
              暂未配置 Prompt
            </div>
          </div>

          <!-- 设置入口 -->
          <div class="dropdown-footer">
            <div class="footer-item" @click="goToSettings('apikey')">
              🔑 前往设置页面管理 API Key
            </div>
            <div class="footer-item" @click="goToSettings('prompt')">
              📝 前往设置页面管理 Prompt
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
```

---

## 五、文件变更清单

### 5.1 新增文件

| 文件 | 描述 |
|------|------|
| `src/components/chat/ModelPromptSelector.vue` | 模型和 Prompt 选择器组件 |

### 5.2 修改文件

| 文件 | 变更内容 |
|------|----------|
| `src/stores/config.ts` | 添加 `activeKey` 计算属性；确保 `loadConfig` 加载 API Key 激活状态 |
| `src/views/SettingsView.vue` | 重构菜单结构，分为 API Key 和 Prompt 两个独立菜单 |
| `src/views/ChatView.vue` | 移除设置按钮；添加 ModelPromptSelector 组件 |
| `src/router/index.ts` | 路由配置（如有需要） |

---

## 六、实施步骤

### Step 1: 修复 Prompt 失效问题

1. 检查 `ConfigStore.loadConfig()` 是否正确加载 `apiKeys` 和 `prompts`
2. 确保 `activeKeyId` 和 `activePromptId` 正确设置
3. 在 `ChatView.vue` 中确保能访问到正确的状态

### Step 2: 重构 SettingsView 菜单

1. 将现有「模型」菜单拆分为「API Key」和「Prompt 模板」两个菜单
2. 保留原有功能，更新菜单导航

### Step 3: 调整 API Key 布局（表单在上，列表在下）

1. 定位到当前 API Key 相关代码
2. 调整 HTML 结构：表单在前，列表在后
3. 添加适当的 CSS 样式区分表单和列表区域

### Step 4: 调整 Prompt 布局（表单在上，列表在下）

1. 定位到当前 Prompt 相关代码
2. 调整 HTML 结构：表单在前，列表在后
3. 保持一致的样式风格

### Step 5: 创建 ModelPromptSelector 组件

1. 创建组件文件
2. 实现下拉选择逻辑
3. 实现设置页面跳转

### Step 6: 更新 ChatView

1. 移除 Header 中的设置按钮
2. 添加 ModelPromptSelector 组件

---

## 七、样式设计

### 7.1 选择器样式

```css
.model-prompt-selector {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  background: var(--color-bg-elevated, #f5f5f5);
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.selector-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-bg-surface, #fff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.selector-item:hover {
  border-color: var(--color-primary, #4f46e5);
}

.selector-item .label {
  color: var(--color-text-secondary, #666);
}

.selector-item .value {
  color: var(--color-text, #1a1a1a);
  font-weight: 500;
}

.selector-item .arrow {
  font-size: 10px;
  color: var(--color-text-secondary, #999);
}
```

### 7.2 下拉悬浮框样式

```css
.dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 120px;
}

.dropdown-panel {
  background: var(--color-bg-surface, #fff);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  min-width: 320px;
  max-width: 400px;
  max-height: 480px;
  overflow: hidden;
}

.dropdown-section {
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.dropdown-section:last-of-type {
  border-bottom: none;
}

.section-title {
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #666);
  text-transform: uppercase;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-item:hover {
  background: var(--color-bg-elevated, #f5f5f5);
}

.dropdown-item.active {
  background: rgba(79, 70, 229, 0.08);
}

.dropdown-item .radio {
  width: 16px;
  font-size: 12px;
}

.dropdown-item .name {
  flex: 1;
  font-size: 14px;
}

.dropdown-item .provider {
  font-size: 12px;
  color: var(--color-text-secondary, #666);
}

.dropdown-footer {
  padding: 8px 0;
  background: var(--color-bg-elevated, #f5f5f5);
}

.footer-item {
  padding: 12px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-primary, #4f46e5);
  transition: background 0.2s;
}

.footer-item:hover {
  background: rgba(79, 70, 229, 0.08);
}

.empty-hint {
  padding: 16px;
  text-align: center;
  color: var(--color-text-secondary, #999);
  font-size: 13px;
}
```

---

## 八、交互流程

### 8.1 选择模型

```
1. 用户点击「模型」选择器
2. 弹出下拉悬浮框
3. 用户点击目标模型
4. 调用 configStore.setActiveKey(id)
5. 关闭下拉框
6. 更新显示
```

### 8.2 选择 Prompt

```
1. 用户点击「Prompt」选择器
2. 弹出下拉悬浮框
3. 用户点击目标 Prompt
4. 调用 configStore.setActivePrompt(id)
5. 关闭下拉框
6. 更新显示
```

### 8.3 前往设置

```
1. 用户点击「前往设置页面管理...」
2. 关闭下拉框
3. 跳转到设置页面
4. 高亮对应菜单
```

---

## 九、注意事项

1. **状态持久化**：确保选择后下次打开应用仍然保持
2. **性能优化**：下拉框使用 `Teleport` 避免定位问题
3. **空状态处理**：当没有配置时，显示友好提示
4. **响应式**：下拉框位置需要根据选择器位置动态计算
