import { app, BrowserWindow, ipcMain, nativeTheme, safeStorage, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
// Removed unused imports (os, crypto, fs) after persistence refactor
// Conversations now handled in renderer (localStorage / IndexedDB). Main process is stateless regarding history.

const isDev = !!process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let inMemoryApiKey: string | null = null; // decrypted cache
let encryptedKey: Buffer | null = null;   // encrypted representation (memory or disk)
const KEY_FILENAME = 'api_key.enc';
// Active stream controllers for cancellation
const activeStreams = new Map<string, AbortController>();

async function persistApiKey(key: string) {
  inMemoryApiKey = key;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      encryptedKey = safeStorage.encryptString(key);
    } else {
      encryptedKey = Buffer.from(key, 'utf-8');
    }
    if (encryptedKey) {
      const filePath = path.join(app.getPath('userData'), KEY_FILENAME);
      await fs.writeFile(filePath, encryptedKey, { mode: 0o600 });
    }
  } catch {
    encryptedKey = null; // fallback to memory only
  }
}

function getApiKey(): string | null {
  if (inMemoryApiKey) return inMemoryApiKey;
  if (encryptedKey) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        inMemoryApiKey = safeStorage.decryptString(encryptedKey);
      } else {
        inMemoryApiKey = encryptedKey.toString('utf-8');
      }
    } catch {
      return null;
    }
  }
  return inMemoryApiKey;
}

async function loadEncryptedKeyFromDisk() {
  try {
    const filePath = path.join(app.getPath('userData'), KEY_FILENAME);
    const data = await fs.readFile(filePath);
    if (data && data.length) {
      encryptedKey = data;
    }
  } catch {
    // ignore missing file
  }
}

ipcMain.handle('openrouter:clearKey', async () => {
  inMemoryApiKey = null;
  encryptedKey = null;
  try {
    const filePath = path.join(app.getPath('userData'), KEY_FILENAME);
    await fs.unlink(filePath);
  } catch {}
  return true;
});
// Secure key IPC
ipcMain.handle('openrouter:setKey', async (_evt, apiKey: string) => {
  if (typeof apiKey !== 'string' || !apiKey.startsWith('sk-')) {
    throw new Error('Invalid API key format');
  }
  await persistApiKey(apiKey);
  return true;
});

ipcMain.handle('openrouter:getKey', () => getApiKey());

// Generic file save (export)
ipcMain.handle('app:saveFile', async (_evt, { defaultPath, content }: { defaultPath: string; content: string }) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { saved: false };
  await fs.writeFile(filePath, content, 'utf-8');
  return { saved: true, filePath };
});

// Generic file open (import)
ipcMain.handle('app:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePaths.length) return { opened: false };
  const filePath = filePaths[0];
  const content = await fs.readFile(filePath, 'utf-8');
  return { opened: true, content, filePath };
});

async function createWindow() {
  // In dev we load from dist-electron which esbuild watch produces.
  const preloadPath = isDev
    ? path.join(process.cwd(), 'dist-electron', 'preload.cjs')
    : path.join(__dirname, 'preload.cjs');

  // Window creation only (model listing handled via dedicated IPC below)
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      contextIsolation: true,
      preload: preloadPath,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// Theme IPC handlers (renderer invokes these via preload)
ipcMain.handle('theme:current', () => {
  return nativeTheme.shouldUseDarkColors;
});

ipcMain.handle('theme:toggle', () => {
  nativeTheme.themeSource = nativeTheme.shouldUseDarkColors ? 'light' : 'dark';
  return nativeTheme.shouldUseDarkColors;
});

interface OpenRouterModelInfo { id: string; pricing?: any; description?: string; free?: boolean; modalities?: string[]; }
interface OpenRouterCallPayload { apiKey?: string; body: any }

ipcMain.handle('openrouter:listModels', async (_evt, apiKey?: string) => {
  const key = apiKey || getApiKey();
  if (!key) throw new Error('API key missing');
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://github.com/your-org/your-repo',
      'X-Title': 'OpenRouter Desktop',
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Models fetch failed ${res.status}: ${text}`);
  }
  const json = await res.json();
  const models: OpenRouterModelInfo[] = json.data || [];
  return models.map(m => {
    const idLower = m.id.toLowerCase();
    const isImage = /diffusion|image|sdxl|stability/.test(idLower);
    return {
      ...m,
      free: !m.pricing || Object.values(m.pricing).every((v: any) => !v || v === '0' || v === '0.0'),
      modalities: isImage ? ['image'] : ['text']
    };
  });
});

app.whenReady().then(async () => {
  await loadEncryptedKeyFromDisk();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Streaming support: we will send incremental chunks through a webContents.send channel unique per request id
ipcMain.handle('openrouter:stream', async (evt, payload: OpenRouterCallPayload & { requestId: string }) => {
  const { requestId } = payload;
  const apiKey = payload.apiKey || getApiKey();
  if (!apiKey) throw new Error('API key missing');
  const body = { ...payload.body, stream: true };
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const wc = evt.sender; // webContents
  try {
    const controller = new AbortController();
    activeStreams.set(requestId, controller);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/your-org/your-repo',
        'X-Title': 'OpenRouter Desktop',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text();
      wc.send('openrouter:stream:event', { requestId, type: 'error', error: `HTTP ${res.status} ${text}` });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulated = '';
    wc.send('openrouter:stream:event', { requestId, type: 'start' });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      const lines = accumulated.split(/\r?\n/);
      accumulated = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('data:')) {
          const dataPart = trimmed.slice(5).trim();
          if (dataPart === '[DONE]') {
            wc.send('openrouter:stream:event', { requestId, type: 'done' });
          } else {
            try {
              const json = JSON.parse(dataPart);
              wc.send('openrouter:stream:event', { requestId, type: 'delta', data: json });
            } catch (e) {
              wc.send('openrouter:stream:event', { requestId, type: 'error', error: 'Parse error chunk' });
            }
          }
        }
      }
    }
    wc.send('openrouter:stream:event', { requestId, type: 'end' });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      wc.send('openrouter:stream:event', { requestId, type: 'aborted' });
    } else {
      wc.send('openrouter:stream:event', { requestId, type: 'error', error: e.message || 'Unknown error' });
    }
  } finally {
    activeStreams.delete(requestId);
  }
});

ipcMain.handle('openrouter:stream:cancel', (_evt, requestId: string) => {
  const ctl = activeStreams.get(requestId);
  if (ctl) {
    ctl.abort();
    return true;
  }
  return false;
});

// No conversation-specific endpoints needed anymore.

// Image generation (text -> image). Endpoint and response format may vary; adjust per OpenRouter spec if needed.
interface OpenRouterImagePayload { apiKey?: string; model: string; prompt: string; size?: string; n?: number; }
ipcMain.handle('openrouter:image', async (_evt, payload: OpenRouterImagePayload) => {
  const apiKey = payload.apiKey || getApiKey();
  if (!apiKey) throw new Error('API key missing');
  if (!payload.prompt) throw new Error('Prompt required');
  const body: any = {
    model: payload.model,
    prompt: payload.prompt,
    size: payload.size || '1024x1024',
    n: payload.n || 1,
  };
  const url = 'https://openrouter.ai/api/v1/images';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/your-org/your-repo',
      'X-Title': 'OpenRouter Desktop',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image generation failed ${res.status}: ${text}`);
  }
  const contentType = res.headers.get('content-type') || '';
  let text: string | null = null;
  if (contentType.includes('application/json')) {
    try {
      const json = await res.json();
      return { format: 'json', ...json };
    } catch (e) {
      // fallback to treat as text
      text = await res.text();
    }
  } else {
    text = await res.text();
  }
  if (text == null) text = await res.text();
  // Crude extraction of <img src="..."> or data URIs
  const imgRegex = /<img[^>]+src=["']([^"'>]+)["']/gi;
  const sources: string[] = [];
  let match;
  while ((match = imgRegex.exec(text)) !== null) {
    sources.push(match[1]);
  }
  return { format: 'html', html: text, images: sources };
});
