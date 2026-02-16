import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { nativeService } from './services/NativeService'
import { translationService } from './services/TranslationService'
import { screenshotService } from './services/ScreenshotService'

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
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Initialize ScreenshotService
  screenshotService.init(win);

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

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

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

app.whenReady().then(() => {
  createWindow()

  // Register global shortcut
  globalShortcut.register('Alt+Space', () => {
    screenshotService.startCapture();
  });
})
