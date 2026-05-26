import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => 'pong',
});

// electron/preload.d.ts
interface ElectronAPI {
  ping(): string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}