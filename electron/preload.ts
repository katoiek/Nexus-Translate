import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
// Whitelisted channels
const validChannels = [
  'ocr-request',
  'translate-request',
  'get-settings',
  'set-setting',
  'confirm-close-action',
  'window-minimize',
  'window-maximize',
  'window-close',
  'start-capture',
  'capture-complete', // Send from renderer
  'cancel-capture',   // Send from renderer
  'close-capture-window',
  'main-process-message',
  'ocr-result',
  'smart-translate',
  'show-close-confirmation',
  // Capture window events (renderer listeners)
  'start-capture', // Also used as listener in App.tsx? No, App.tsx listens for it? Yes.
  'capture-complete',
  'cancel-capture'
];

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) {
    if (validChannels.includes(channel)) {
      return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
    }
    console.warn(`Blocked unauthorized IPC channel subscription: ${channel}`);
    return this;
  },
  off(channel: string, ...omit: any[]) {
    if (validChannels.includes(channel)) {
      return ipcRenderer.off(channel, ...(omit as [any]));
    }
    return this;
  },
  send(channel: string, ...args: any[]) {
    if (validChannels.includes(channel)) {
      return ipcRenderer.send(channel, ...args);
    }
    console.warn(`Blocked unauthorized IPC send: ${channel}`);
  },
  invoke(channel: string, ...args: any[]) {
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    console.warn(`Blocked unauthorized IPC invoke: ${channel}`);
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  },
})
