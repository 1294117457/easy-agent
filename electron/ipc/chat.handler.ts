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

  ipcMain.handle('chat:new', async (_, endCurrent: boolean = true) => {
    if (endCurrent) {
      const storage = core.getStorage();
      const conversations = storage.listConversations();
      const activeConv = conversations.find((c) => !c.endedAt);
      if (activeConv) {
        try {
          await core.endConversation(activeConv.id);
          console.log('[ChatHandler] 结束对话:', activeConv.id);
        } catch (e) {
          console.error('[ChatHandler] 结束对话失败:', e);
        }
      }
    }
    return core.getStorage().createConversation({ name: '新对话' });
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
