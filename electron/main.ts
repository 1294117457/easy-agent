import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { EasyAgentCore } from './core/index.js';
import { SQLiteAdapter } from './core/adapters/storage/sqlite.adapter.js';
import { registerConfigHandlers } from './ipc/config.handler.js';
import {
  registerMcpHandlers,
  registerPluginHandlers,
  registerWorkflowNodeHandlers,
  registerWorkflowHandlers,
} from './ipc/workflow.handler.js';

let mainWindow: BrowserWindow | null = null;
let core: EasyAgentCore | null = null;

function getDbPath(): string {
  const dataDir = join(app.getPath('userData'), 'data');
  mkdirSync(dataDir, { recursive: true });
  return join(dataDir, 'easy-agent.db');
}

function registerChatHandlers(
  ipcMain: typeof ipcMain,
  core: EasyAgentCore,
  mainWindow: BrowserWindow
) {
  console.log('[Main] 注册 Chat Handlers');

  ipcMain.handle(
    'chat:send',
    async (_, conversationId: string, message: string) => {
      console.log('[Main] chat:send 被调用, conversationId:', conversationId);

      if (!conversationId) {
        console.error('[Main] 错误: conversationId 不能为空');
        throw new Error('conversationId 不能为空');
      }

      return new Promise<void>((resolve, reject) => {
        try {
          core.sendMessage(conversationId, message, {
            onToken: (token) => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('agent:token', { conversationId, token });
              }
            },
            onDone: () => {
              console.log('[Main] onDone 被调用');
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('agent:done', { conversationId });
              }
              resolve();
            },
            onError: (error: string) => {
              console.error('[Main] onError 被调用:', error);
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('agent:error', { conversationId, error });
              }
              reject(new Error(error));
            },
          });
        } catch (err) {
          console.error('[Main] sendMessage 异常:', err);
          reject(err);
        }
      });
    }
  );

  ipcMain.handle('chat:history', (_, conversationId: string) => {
    return core.getStorage().getMessages(conversationId);
  });

  ipcMain.handle('chat:conversations', () => {
    return core.getStorage().listConversations();
  });

  ipcMain.handle('chat:new', async () => {
    // 创建新对话记录
    const conv = core.getStorage().createConversation({ name: '新对话' });
    console.log('[Main] 创建新对话:', conv.id);
    return conv;
  });

  ipcMain.handle('chat:delete', (_, conversationId: string) => {
    return core.getStorage().deleteConversation(conversationId);
  });

  ipcMain.handle('chat:compress', async (_, conversationId: string) => {
    return core.compressConversation(conversationId);
  });

  ipcMain.handle('chat:end', async (_, conversationId: string) => {
    return core.endConversation(conversationId);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
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
    registerConfigHandlers(ipcMain, core.getStorage(), core);

    // 注册 MCP/Plugin/Workflow handlers
    registerMcpHandlers(core.getMcpManager(), core.getPluginService());
    registerPluginHandlers(core.getPluginService());
    registerWorkflowNodeHandlers(core.getNodeService());
    registerWorkflowHandlers(core.getWorkflowService(), core.getNodeService());
  }
}

app.whenReady().then(async () => {
  const storage = new SQLiteAdapter(getDbPath(), 'easy-agent-master-key');
  core = new EasyAgentCore(storage);

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
