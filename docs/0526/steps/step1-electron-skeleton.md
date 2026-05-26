# Step 1: Electron 骨架

> 版本: v0.1.0 MVP
> 日期: 2026-05-26
> 目标：Electron 能启动，窗口能打开，前端能渲染

---

## 1. 创建项目目录

```bash
cd easy-agent

# 创建目录结构
mkdir -p electron/core
mkdir -p electron/ipc
mkdir -p renderer
```

## 2. 初始化 electron 项目

```bash
cd electron

# 初始化 package.json
npm init -y

# 安装 Electron
npm install electron

# 安装开发工具
npm install -D typescript tsx @types/node
```

## 3. 创建 tsconfig.json

```json
// electron/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

## 4. 更新 package.json scripts

```json
// electron/package.json 添加
{
  "main": "dist/main.js",
  "type": "module",
  "scripts": {
    "dev": "tsx watch main.ts",
    "build": "tsc",
    "start": "electron ."
  }
}
```

## 5. 创建 main.ts

```typescript
// electron/main.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发模式：加载 Vite Dev Server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

## 6. 创建 preload.ts

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// 初始版本：只暴露一个测试 API
contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => 'pong',
});
```

## 7. 创建 core/index.ts（占位）

```typescript
// electron/core/index.ts

// 初始版本：导出一个占位符
export class EasyAgentCore {
  constructor() {
    console.log('EasyAgentCore initialized (placeholder)');
  }
}
```

## 8. 创建 TypeScript 类型声明（让前端知道 electronAPI 的类型）

```typescript
// electron/preload.d.ts
interface ElectronAPI {
  ping(): string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

## 9. 验证

### 启动前端（终端 1）

```bash
cd renderer
# 如果 renderer 已初始化，直接启动
npm run dev
# 或新建一个
npm create vite@latest . -- --template vue-ts
npm install
npm run dev
```

### 启动 Electron（终端 2）

```bash
cd electron
npm run dev
```

### 预期结果

```
终端 2 输出：
  Electron app starting...
  EasyAgentCore initialized (placeholder)

浏览器窗口：
  打开 http://localhost:5173
  显示 Vue 应用界面
```

### 打开 DevTools 测试

```typescript
// 在浏览器控制台输入
window.electronAPI.ping()
// 预期输出：'pong'
```

---

## 常见问题

### 问题：electron 启动报错 "import.meta.url not defined"

```json
// electron/package.json 添加
{
  "type": "module"
}
```

### 问题：preload 找不到

```typescript
// 确保 main.ts 中 preload 路径正确
preload: path.join(__dirname, 'preload.js')

// 如果用 ESM，打包后 preload.js 位置可能不同
// 可以改为
preload: path.join(__dirname, '..', 'dist', 'preload.js')
```

### 问题：窗口白屏

```typescript
// 检查 loadURL / loadFile 路径是否正确
// 开发模式用 http://localhost:5173
// 生产模式用 ../renderer/index.html
```

---

## 完成后检查清单

```
✅ electron 目录已创建
✅ tsconfig.json 已配置
✅ main.ts 能启动窗口
✅ preload.ts 已暴露 electronAPI
✅ core/index.ts 已创建（占位）
✅ 前端 Dev Server 能启动
✅ Electron 能连接到前端
✅ window.electronAPI.ping() 返回 'pong'
```

---

*文档版本: v0.1.0 | 最后更新: 2026-05-26*
