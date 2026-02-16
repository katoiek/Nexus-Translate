import { BrowserWindow, desktopCapturer, ipcMain, screen, app, BrowserView } from 'electron';
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
                    preload: path.join(__dirname, 'preload.mjs'), // Fixed path
                    nodeIntegration: false,
                    contextIsolation: true,
                }
            });

            // Pass the display ID to the renderer so it knows which display it is (optional, but good for debugging)
            // But main logic is here.

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

            // Store display info with the window if needed, or just rely on finding it later
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
        // Hide windows immediately to feel responsive
        this.captureWindows.forEach(w => w.hide());

        try {
            const senderWindow = BrowserWindow.fromWebContents(event.sender);
            const displayId = (senderWindow as any)?.displayId;

            if (!displayId) {
                throw new Error('Could not identify display for capture');
            }

            const display = screen.getAllDisplays().find(d => d.id === displayId);
            if (!display) {
                throw new Error('Display not found');
            }

            const scaleFactor = display.scaleFactor;

            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: {
                    width: display.size.width * scaleFactor,
                    height: display.size.height * scaleFactor
                }
            });

            // Find source matching the display
            // Electron documentation says source.display_id is available on some platforms,
            // but often we match by matching the source name or id.
            // On Windows source.id is usually "screen:0", "screen:1"...
            // But mapping that to display.id is tricky. 
            // A more robust way often involves checking which source matches the display bounds? 
            // No, desktopCapturer sources don't have bounds.

            // For now, let's try to find a source where the ID contains the display ID string 
            // OR fall back to index matching if needed.
            // Actually, sources[i] usually corresponds to displays[i] IF returned in same order, but not guaranteed.

            // Let's print sources to debug if it fails.
            // A common heuristic is `source.display_id` (string) matching `display.id.toString()`.

            const source = sources.find(s => s.display_id === display.id.toString()) ||
                sources.find(s => s.id === `screen:${display.id}`);

            // Fallback: If there's only one source and one display, use it.
            const targetSource = source || sources[0];

            if (!targetSource) throw new Error('No screen source found for display');

            const image = targetSource.thumbnail.crop({
                x: Math.round(rect.x * scaleFactor),
                y: Math.round(rect.y * scaleFactor),
                width: Math.round(rect.width * scaleFactor),
                height: Math.round(rect.height * scaleFactor)
            });

            const tempPath = path.join(app.getPath('temp'), `nexus_ocr_${Date.now()}.png`);
            fs.writeFileSync(tempPath, image.toPNG());

            // Close windows after capture is processed (or they were hidden already)
            this.closeCaptureWindows();

            const ocrResult = await nativeService.performOCR(tempPath);

            fs.unlinkSync(tempPath);

            // Send result back to main window
            this.mainWindow?.webContents.send('ocr-result', ocrResult);
            // Ensure main window is shown and focused
            this.mainWindow?.show();
            this.mainWindow?.focus();

        } catch (error) {
            console.error('Screenshot processing failed:', error);
            this.closeCaptureWindows();
            this.mainWindow?.webContents.send('ocr-result', { text: `Error: ${error}` });
            this.mainWindow?.show();
        }
    }
}

export const screenshotService = new ScreenshotService();
