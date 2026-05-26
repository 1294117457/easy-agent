import type { IpcMain } from 'electron';
import type { IStoragePort } from '../core/index.js';

export function registerConfigHandlers(
  ipcMain: IpcMain,
  storage: IStoragePort
) {
  ipcMain.handle('config:get', () => {
    return {
      apiKeys: storage.listApiKeys(),
      prompts: storage.listPrompts(),
    };
  });

  ipcMain.handle(
    'config:apiKey:create',
    (_, data: { provider: string; key: string; model: string }) => {
      return storage.createApiKey(data);
    }
  );

  ipcMain.handle('config:apiKey:delete', (_, id: string) => {
    return storage.deleteApiKey(id);
  });

  ipcMain.handle(
    'config:prompt:create',
    (_, data: { name: string; description?: string; systemPrompt: string }) => {
      return storage.createPrompt(data);
    }
  );

  ipcMain.handle('config:prompt:delete', (_, id: string) => {
    return storage.deletePrompt(id);
  });
}
