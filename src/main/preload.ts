import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  toggleTheme: () => ipcRenderer.invoke('theme:toggle'),
  currentTheme: () => ipcRenderer.invoke('theme:current'),
  // Placeholder for OpenRouter functions (to be added later)
  callOpenRouter: (payload: { apiKey: string; body: any }) => ipcRenderer.invoke('openrouter:call', payload),
  setApiKey: (apiKey: string) => ipcRenderer.invoke('openrouter:setKey', apiKey),
  getApiKey: () => ipcRenderer.invoke('openrouter:getKey'),
  clearApiKey: () => ipcRenderer.invoke('openrouter:clearKey'),
  fetchModels: (apiKey?: string) => ipcRenderer.invoke('openrouter:listModels', apiKey),
  startStream: (payload: { requestId: string; apiKey?: string; body: any }) => ipcRenderer.invoke('openrouter:stream', payload),
  onStreamEvent: (handler: (evt: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: any) => handler(data);
    ipcRenderer.on('openrouter:stream:event', listener);
    return () => ipcRenderer.removeListener('openrouter:stream:event', listener);
  },
  cancelStream: (requestId: string) => ipcRenderer.invoke('openrouter:stream:cancel', requestId),
  generateImage: (payload: { apiKey?: string; model: string; prompt: string; size?: string; n?: number }) => ipcRenderer.invoke('openrouter:image', payload),
  saveFile: (opts: { defaultPath: string; content: string }) => ipcRenderer.invoke('app:saveFile', opts),
  openFile: () => ipcRenderer.invoke('app:openFile'),
});

declare global {
  interface Window {
    electronAPI: {
      toggleTheme: () => Promise<boolean>;
      currentTheme: () => Promise<boolean>;
      callOpenRouter: (payload: { apiKey: string; body: any }) => Promise<any>;
      setApiKey: (apiKey: string) => Promise<void>;
  getApiKey: () => Promise<string | null>;
  clearApiKey: () => Promise<boolean>;
      fetchModels: (apiKey?: string) => Promise<any[]>;
      startStream: (payload: { requestId: string; apiKey?: string; body: any }) => Promise<void>;
      onStreamEvent: (handler: (data: any) => void) => () => void;
  cancelStream: (requestId: string) => Promise<boolean>;
      generateImage: (payload: { apiKey?: string; model: string; prompt: string; size?: string; n?: number }) => Promise<any>;
      saveFile: (opts: { defaultPath: string; content: string }) => Promise<{ saved: boolean; filePath?: string }>;
      openFile: () => Promise<{ opened: boolean; content?: string; filePath?: string }>;
    }
  }
}
