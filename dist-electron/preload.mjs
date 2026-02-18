"use strict";
const electron = require("electron");
const validChannels = [
  "ocr-request",
  "translate-request",
  "get-settings",
  "set-setting",
  "confirm-close-action",
  "window-minimize",
  "window-maximize",
  "window-close",
  "start-capture",
  "capture-complete",
  // Send from renderer
  "cancel-capture",
  // Send from renderer
  "close-capture-window",
  "main-process-message",
  "ocr-result",
  "smart-translate",
  "show-close-confirmation",
  // Capture window events (renderer listeners)
  "start-capture",
  // Also used as listener in App.tsx? No, App.tsx listens for it? Yes.
  "capture-complete",
  "cancel-capture"
];
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(channel, listener) {
    if (validChannels.includes(channel)) {
      return electron.ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
    }
    console.warn(`Blocked unauthorized IPC channel subscription: ${channel}`);
    return this;
  },
  off(channel, ...omit) {
    if (validChannels.includes(channel)) {
      return electron.ipcRenderer.off(channel, ...omit);
    }
    return this;
  },
  send(channel, ...args) {
    if (validChannels.includes(channel)) {
      return electron.ipcRenderer.send(channel, ...args);
    }
    console.warn(`Blocked unauthorized IPC send: ${channel}`);
  },
  invoke(channel, ...args) {
    if (validChannels.includes(channel)) {
      return electron.ipcRenderer.invoke(channel, ...args);
    }
    console.warn(`Blocked unauthorized IPC invoke: ${channel}`);
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  }
});
