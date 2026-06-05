# Step 1: electron-vite 骨架

> 版本: v0.2.0 MVP
> 日期: 2026-05-26
> 目标：Electron 能启动，窗口能打开，前端能渲染
> 架构: electron-vite 单项目，electron/ 目录 + src/ 目录
> 关键: electron-vite 统一管理 main/preload/renderer 三个入口

---

## 1. 项目目录结构

```
easy-agent/
├── electron/                      # 主进程 TypeScript 源码
│   ├── main.ts                  # Electron 入口
│   ├── preload.ts               # Context Bridge（编译为 CJS）
│   └── core/
│       └── index.ts             # 核心占位符
│
├── src/                          # 渲染进程 Vue 源码
│   ├── main.ts
│   ├── App.vue
│   ├── style.css
│   ├── components/Sidebar.vue
│   └── views/
│       ├── ChatView.vue
│       ├── FlowView.vue
│       ├── PluginView.vue
│       ├── SettingsView.vue
│       └── HistoryView.vue
│
├── index.html
├── electron.vite.config.ts        # electron-vite 配置
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
└── package.json
```

---

## 2. 初始化项目

### 2.1 创建 package.json（根目录）

```json
{
  "name": "easy-agent",
  "version": "0.1.0",
  "description": "EasyAgent - AI Agent Desktop Application",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "start": "electron ."
  },
  "dependencies": {
    "vue": "^3.5.13",
    "vue-router": "^4.5.1",
    "pinia": "^3.0.2"
  },
  "devDependencies": {
    "@types/node": "^22.15.18",
    "@vitejs/plugin-vue": "^5.2.4",
    "electron": "^33.4.4",
    "electron-builder": "^26.0.0",
    "electron-vite": "^3.0.0",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vue-tsc": "^2.2.12"
  }
}
```

### 2.2 安装依赖

```bash
npm install
```

---

## 3. TypeScript 配置

### tsconfig.json（项目引用）

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

### tsconfig.node.json（主进程/preload）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["electron.vite.config.ts", "electron/**/*.ts"]
}
```

### tsconfig.web.json（渲染进程）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue"]
}
```

---

## 4. electron.vite.config.ts

```typescript
import { defineConfig } from 'electron-vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'electron/main.ts'),
          preload: resolve(__dirname, 'electron/preload.ts'),
        },
        output: {
          entryFileNames: '[name]/[name].js',
        },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload.ts'),
        output: {
          entryFileNames: 'preload/index.js',
        },
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
        },
      },
    },
    plugins: [vue()],
    resolve: {
      alias: { '@': resolve(__dirname, 'src') },
    },
  },
});
```

> **关键点**：`entryFileNames: '[name]/[name].js'` 保证 main 编译到 `dist/main/main.js`，preload 编译到 `dist/preload/index.js`。

---

## 5. 创建 electron/main.ts

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { EasyAgentCore } from './core/index.js';
import { SQLiteAdapter } from './core/adapters/storage/sqlite.adapter.js';
import { registerChatHandlers } from './ipc/chat.handler.js';
import { registerConfigHandlers } from './ipc/config.handler.js';

let mainWindow: BrowserWindow | null = null;
let core: EasyAgentCore | null = null;

function getDbPath(): string {
  return join(app.getPath('userData'), 'data', 'easy-agent.db');
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  if (core) {
    registerChatHandlers(ipcMain, core, mainWindow);
    registerConfigHandlers(ipcMain, core.getStorage());
  }
}

app.whenReady().then(async () => {
  const storage = new SQLiteAdapter(getDbPath(), 'easy-agent-master-key');
  core = new EasyAgentCore(storage);
  await createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
```

---

## 6. 创建 electron/preload.ts

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => 'pong',
  getConfig: () => ipcRenderer.invoke('config:get'),
  sendMessage: (conversationId: string, message: string) =>
    ipcRenderer.invoke('chat:send', conversationId, message),
  onToken: (callback: (token: string) => void) =>
    ipcRenderer.on('agent:token', (_, token) => callback(token)),
  onDone: (callback: () => void) =>
    ipcRenderer.on('agent:done', () => callback()),
  onError: (callback: (error: string) => void) =>
    ipcRenderer.on('agent:error', (_, error) => callback(error)),
});
```

---

## 7. 创建 electron/core/index.ts

```typescript
// 初始占位版本
export class EasyAgentCore {
  constructor() {
    console.log('EasyAgentCore initialized (placeholder)');
  }
}
```

---

## 8. 创建 index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EasyAgent</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

---

## 9. 验证

```bash
npm run dev
```

### 预期结果

- Electron 窗口打开（1200x800）
- Vue 前端渲染在窗口内
- DevTools 能打开（F12）

### 打开 DevTools 测试

```javascript
// 在 DevTools 控制台输入
window.electronAPI.ping()
// 预期输出：'pong'
```

---

## 常见问题

### 问题：报错 `Cannot find module 'electron-vite'`

确保在根目录运行 `npm install`。

### 问题：窗口白屏

检查：
1. Vite Dev Server 是否在 `http://localhost:5173` 启动
2. `electron.vite.config.ts` 中 `renderer.root` 是否指向正确目录

### 问题：Electron 版本不兼容

electron-vite 3.x 需要 Electron 28+。

---

## 完成后检查清单

```
✅ package.json 已创建（根目录）
✅ electron.vite.config.ts 已配置
✅ tsconfig.json/tsconfig.node.json/tsconfig.web.json 已配置
✅ electron/main.ts 已创建
✅ electron/preload.ts 已创建
✅ electron/core/index.ts 已创建
✅ index.html 已创建
✅ npm run dev 能启动
✅ window.electronAPI.ping() 返回 'pong'
```

---

*文档版本: v0.2.0 | 最后更新: 2026-05-26*
