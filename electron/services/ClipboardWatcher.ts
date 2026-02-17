import { clipboard, BrowserWindow, app } from 'electron';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';

export class ClipboardWatcher {
    private mainWindow: BrowserWindow | null = null;
    private watcherProcess: ChildProcessWithoutNullStreams | null = null;
    private lastChangeTime: number = 0;
    private lastSequence: number = 0;

    constructor() { }

    init(window: BrowserWindow) {
        console.log('ClipboardWatcher: Initializing Native Approach...');
        this.mainWindow = window;
        this.startNativeWatcher();
    }

    private getNativePath(): string {
        const isPackaged = app.isPackaged;

        if (process.platform === 'darwin') {
            if (isPackaged) {
                return path.join(process.resourcesPath, 'native/mac/main');
            } else {
                return path.join(process.cwd(), 'native/mac/main');
            }
        }

        if (process.platform === 'win32') {
            if (isPackaged) {
                return path.join(process.resourcesPath, 'native/win/NexusNative.exe');
            } else {
                // Dev path
                return path.join(process.cwd(), 'native/win/bin/Release/net8.0-windows10.0.19041.0/win-x64/publish/NexusNative.exe');
            }
        }

        return '';
    }

    private startNativeWatcher() {
        const nativePath = this.getNativePath();
        if (!nativePath) {
            console.error(`ClipboardWatcher: Native path not found for platform ${process.platform}`);
            return;
        }

        console.log(`ClipboardWatcher: Spawning ${nativePath} watch-clipboard`);

        try {
            this.watcherProcess = spawn(nativePath, ['watch-clipboard']);

            this.watcherProcess.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const msg = JSON.parse(line);
                        this.handleNativeMessage(msg);
                    } catch (e) {
                        // Partial line or invalid json, ignore
                        // console.error('JSON Parse Error:', e);
                    }
                }
            });

            this.watcherProcess.stderr.on('data', (data) => {
                console.error(`ClipboardWatcher Native Error: ${data}`);
            });

            this.watcherProcess.on('close', (code) => {
                console.log(`ClipboardWatcher process exited with code ${code}`);
                this.watcherProcess = null;
            });

        } catch (e) {
            console.error('ClipboardWatcher: Failed to spawn native process', e);
        }
    }

    private handleNativeMessage(msg: any) {
        if (msg.type === 'init') {
            this.lastSequence = msg.sequence;
            console.log(`ClipboardWatcher: Native Init Sequence ${this.lastSequence}`);
        } else if (msg.type === 'change') {
            const currentSequence = msg.sequence;
            const now = Date.now();
            const timeDiff = now - this.lastChangeTime;

            console.log(`Clipboard Native Change: ${this.lastSequence} -> ${currentSequence}, diff: ${timeDiff}ms`);

            // Double Copy Logic
            if (timeDiff < 1000) {
                const text = clipboard.readText();
                console.log(`Double copy detected! Text length: ${text.length}`);
                if (text && text.trim().length > 0) {
                    this.triggerSmartTranslate(text);
                }
            }

            this.lastSequence = currentSequence;
            this.lastChangeTime = now;
        }
    }

    private triggerSmartTranslate(text: string) {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

        console.log('Smart Translate Triggered via Ctrl+C+C');

        // Restore window if minimized or hidden
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        if (!this.mainWindow.isVisible()) this.mainWindow.show();

        // Focus window
        this.mainWindow.focus();

        // Send text to renderer
        this.mainWindow.webContents.send('smart-translate', text);
    }

    stop() {
        if (this.watcherProcess) {
            this.watcherProcess.kill();
            this.watcherProcess = null;
        }
    }
}

export const clipboardWatcher = new ClipboardWatcher();
