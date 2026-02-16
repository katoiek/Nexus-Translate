import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { nativeService } from './services/NativeService'
import { translationService } from './services/TranslationService'
import { screenshotService } from './services/ScreenshotService'
import { clipboardWatcher } from './services/ClipboardWatcher'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  const win = new BrowserWindow({
    title: 'Nexus Translate',
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    autoHideMenuBar: true, // Hide menu bar (File, Edit, etc.)
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Assign to global var
  // win = win; // Already assigned

  // Initialize ScreenshotService
  screenshotService.init(win);

  // Initialize ClipboardWatcher (Smart Shortcut Ctrl+C+C)
  clipboardWatcher.init(win);

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ... (existing app events)

// IPC Handlers
ipcMain.handle('ocr-request', async (_event, imagePath) => {
  try {
    const result = await nativeService.performOCR(imagePath)
    return result
  } catch (error: any) {
    console.error('OCR Error:', error)
    return { text: `Error: ${error.message}`, confidence: 0 }
  }
})

ipcMain.handle('translate-request', async (_event, text, options) => {
  try {
    const result = await translationService.translate(text, options)
    return result
  } catch (error: any) {
    console.error('Translation Error:', error)
    return { text: `Error: ${error.message}`, engine: options.engine }
  }
})

// Window Control IPC
ipcMain.on('window-minimize', () => {
  const win = BrowserWindow.getFocusedWindow();
  win?.minimize();
});

ipcMain.on('window-maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

ipcMain.on('window-close', () => {
  const win = BrowserWindow.getFocusedWindow();
  win?.close();
});

app.whenReady().then(() => {
  createWindow()

  // Register global shortcut
  globalShortcut.register('Alt+Space', () => {
    screenshotService.startCapture();
  });
})
