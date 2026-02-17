import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
import { nativeService } from './services/NativeService'
import { translationService } from './services/TranslationService'
import { screenshotService } from './services/ScreenshotService'
import { clipboardWatcher } from './services/ClipboardWatcher'
import { settingsStore } from './store'

// The built directory structure
process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let tray: Tray | null = null

function createTray() {
  if (tray) return;

  try {
    // Try to load icon.png first, fallback to svg or generated
    const iconName = 'icon.png';
    const iconPath = path.join(process.env.VITE_PUBLIC, iconName);

    let icon = nativeImage.createFromPath(iconPath);

    if (icon.isEmpty()) {
      console.warn(`Icon ${iconName} is empty or missing. Using fallback.`);
      // Fallback to a simple generated icon (Blue 16x16) to prevent crash
      icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAB5JREFUOE9jZGBg+M+AAxjhP4phNAPQaBj1AAqDMAQA711W5dMc3tMAAAAASUVORK5CYII=');
    }

    tray = new Tray(icon);
    tray.setToolTip('Nexus Translate');

    const updateContextMenu = () => {
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show App',
          click: () => {
            if (win) {
              win.show();
              win.focus();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            // @ts-ignore
            app.isQuitting = true;
            app.quit();
          }
        }
      ]);
      tray?.setContextMenu(contextMenu);
    };

    updateContextMenu();

    tray.on('click', () => {
      if (win) {
        if (win.isVisible()) {
          if (win.isMinimized()) win.restore();
          win.focus();
        } else {
          win.show();
          win.focus();
        }
      }
    });
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
}

function createWindow() {
  // Try to use icon.png for window as well
  const iconPath = path.join(process.env.VITE_PUBLIC, 'icon.png');

  win = new BrowserWindow({
    title: 'Nexus Translate',
    width: 1000,
    height: 700,
    icon: iconPath,
    autoHideMenuBar: true, // Hide menu bar (File, Edit, etc.)
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Initialize Services
  screenshotService.init(win);
  clipboardWatcher.init(win);

  // Close Event Handling
  win.on('close', (event) => {
    // If app is quitting (Cmd+Q or Tray Quit), allow close
    // @ts-ignore
    if (app.isQuitting) {
      return;
    }

    const closeBehavior = settingsStore.get('closeBehavior', 'ask'); // default 'ask'

    if (closeBehavior === 'quit') {
      // Default behavior, do nothing (allow close)
    } else if (closeBehavior === 'minimize') {
      event.preventDefault();
      win?.hide();
      return;
    } else if (closeBehavior === 'ask') {
      event.preventDefault();
      win?.webContents.send('show-close-confirmation');
      win?.show();
      win?.focus();
      return;
    }
  });

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Global flag to track if we are really quitting
// @ts-ignore
app.isQuitting = false;

app.on('before-quit', () => {
  // @ts-ignore
  app.isQuitting = true;
});


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

app.whenReady().then(() => {
  // Apply Auto Launch Setting
  const launchAtLogin = settingsStore.get('launchAtLogin', false);
  app.setLoginItemSettings({
    openAtLogin: launchAtLogin,
    path: app.getPath('exe')
  });

  createTray();
  createWindow();

  // Explicitly set Dock icon on macOS
  if (process.platform === 'darwin') {
    const iconPath = path.join(process.env.VITE_PUBLIC, 'icon.png');
    const image = nativeImage.createFromPath(iconPath);
    app.dock.setIcon(image);
  }

  // Register global shortcut
  globalShortcut.register('Alt+Space', () => {
    screenshotService.startCapture();
  });
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

// Settings IPC
ipcMain.handle('get-settings', () => {
  return settingsStore.getAll();
});

ipcMain.handle('set-setting', (_event, key, value) => {
  settingsStore.set(key, value);

  if (key === 'launchAtLogin') {
    app.setLoginItemSettings({
      openAtLogin: value,
      path: app.getPath('exe')
    });
  }
});

// Close Confirmation Action
ipcMain.on('confirm-close-action', (_event, action) => {
  // action: 'quit' | 'minimize'
  const win = BrowserWindow.getFocusedWindow();
  if (action === 'quit') {
    // @ts-ignore
    app.isQuitting = true;
    app.quit();
  } else {
    win?.hide();
  }
});


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
