import type { IpcMain, BrowserWindow } from 'electron';
import type { EasyAgentCore } from '../core/index.js';

export function registerChatHandlers(
  ipcMain: IpcMain,
  core: EasyAgentCore,
  mainWindow: BrowserWindow
) {
  ipcMain.handle(
    'chat:send',
    async (_, conversationId: string, message: string) => {
      return new Promise<void>((resolve, reject) => {
        core.sendMessage(conversationId, message, {
          onToken: (token) => {
            mainWindow.webContents.send('agent:token', token);
          },
          onDone: () => {
            mainWindow.webContents.send('agent:done', null);
            resolve();
          },
          onError: (error: string) => {
            mainWindow.webContents.send('agent:error', error);
            reject(new Error(error));
          },
        });
      });
    }
  );

  ipcMain.handle('chat:history', (_, conversationId: string) => {
    return core.getStorage().getMessages(conversationId);
  });

  ipcMain.handle('chat:conversations', () => {
    return core.getStorage().listConversations();
  });

  ipcMain.handle('chat:new', () => {
    return core.getStorage().createConversation({ name: '新对话' });
  });

  ipcMain.handle('chat:delete', (_, conversationId: string) => {
    return core.getStorage().deleteConversation(conversationId);
  });
}
