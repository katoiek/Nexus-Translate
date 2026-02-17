import { BrowserWindow, ipcMain, screen, app } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs';
import { nativeService } from './NativeService';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ScreenshotService {
    private captureWindows: BrowserWindow[] = [];
    private mainWindow: BrowserWindow | null = null;

    init(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;

        ipcMain.on('start-capture', () => this.startCapture());
        ipcMain.on('capture-complete', (event, rect) => this.handleCaptureComplete(event, rect));
        ipcMain.on('cancel-capture', () => this.closeCaptureWindows());
        ipcMain.on('close-capture-window', () => this.closeCaptureWindows());
    }

    startCapture() {
        if (this.captureWindows.length > 0) return;

        const displays = screen.getAllDisplays();

        displays.forEach((display) => {
            const window = new BrowserWindow({
                x: display.bounds.x,
                y: display.bounds.y,
                width: display.bounds.width,
                height: display.bounds.height,
                transparent: true,
                frame: false,
                alwaysOnTop: true,
                skipTaskbar: true,
                resizable: false,
                movable: false,
                fullscreen: false,
                hasShadow: false,
                enableLargerThanScreen: true,
                webPreferences: {
                    preload: path.join(__dirname, 'preload.mjs'),
                    nodeIntegration: false,
                    contextIsolation: true,
                }
            });

            const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
            if (VITE_DEV_SERVER_URL) {
                window.loadURL(`${VITE_DEV_SERVER_URL}?mode=screenshot&displayId=${display.id}`);
            } else {
                const rendererDist = path.join(process.env.APP_ROOT || '', 'dist');
                window.loadFile(path.join(rendererDist, 'index.html'), { search: `mode=screenshot&displayId=${display.id}` });
            }

            window.on('closed', () => {
                this.captureWindows = this.captureWindows.filter(w => w !== window);
            });

            (window as any).displayId = display.id;

            this.captureWindows.push(window);
        });
    }

    closeCaptureWindows() {
        this.captureWindows.forEach(w => w.close());
        this.captureWindows = [];
        this.mainWindow?.show();
        this.mainWindow?.focus();
    }

    async handleCaptureComplete(event: Electron.IpcMainEvent, rect: { x: number, y: number, width: number, height: number }) {
        // Hide windows immediately
        this.captureWindows.forEach(w => w.hide());

        try {
            const senderWindow = BrowserWindow.fromWebContents(event.sender);
            const displayId = (senderWindow as any)?.displayId;

            if (!displayId) {
                throw new Error('Could not identify display for capture');
            }

            this.logDebug(`Capture rect: ${JSON.stringify(rect)}, DisplayID: ${displayId}`);

            const display = screen.getAllDisplays().find(d => d.id === displayId);
            if (!display) {
                throw new Error(`Display not found for ID: ${displayId}`);
            }

            const scaleFactor = display.scaleFactor;
            this.logDebug(`Display found: ${display.id}, Scale: ${scaleFactor}, Bounds: ${JSON.stringify(display.bounds)}`);

            const absoluteX = Math.round((display.bounds.x + rect.x) * scaleFactor);
            const absoluteY = Math.round((display.bounds.y + rect.y) * scaleFactor);
            const width = Math.round(rect.width * scaleFactor);
            const height = Math.round(rect.height * scaleFactor);

            this.logDebug(`Requesting Native Capture: x=${absoluteX}, y=${absoluteY}, w=${width}, h=${height}`);

            const ocrResult = await nativeService.performCaptureAndOCR(absoluteX, absoluteY, width, height);

            this.closeCaptureWindows();

            // Send result back to main window
            this.mainWindow?.webContents.send('ocr-result', ocrResult);
            // Ensure main window is shown and focused
            this.mainWindow?.show();
            this.mainWindow?.focus();

        } catch (error) {
            console.error('Screenshot processing failed:', error);
            this.logDebug(`ERROR: ${error}`);
            this.closeCaptureWindows();
            this.mainWindow?.webContents.send('ocr-result', { text: `Error: ${error}` });
            this.mainWindow?.show();
        }
    }

    private logDebug(message: string) {
        try {
            const logPath = path.join(app.getPath('userData'), 'screenshot_debug.log');
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
        } catch (e) {
            console.error('Failed to write log:', e);
        }
    }
}

export const screenshotService = new ScreenshotService();
