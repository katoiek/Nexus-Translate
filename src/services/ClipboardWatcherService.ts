import { Command, Child } from '@tauri-apps/plugin-shell';
import { message } from '@tauri-apps/plugin-dialog';
import { logger } from '../lib/logger';

// Simple event emitter or just integration with window events
class ClipboardWatcherService {
    private child: Child | null = null;
    private isRunning: boolean = false;

    async start() {
        if (this.isRunning) return;

        try {
            logger.log('[ClipboardWatcher] Starting native watcher...');
            const command = Command.sidecar('NexusNative', ['watch-clipboard']);

            command.stdout.on('data', (line) => {
                const textLine = typeof line === 'string' ? line : new TextDecoder().decode(line as any);
                const lines = textLine.split('\n');
                for (const l of lines) {
                    if (!l.trim()) continue;
                    try {
                        const msg = JSON.parse(l);
                        this.handleMessage(msg);
                    } catch (e) {
                        // ignore partial/invalid json
                    }
                }
            });

            command.stderr.on('data', (line) => {
                logger.error(`[ClipboardWatcher Error]: ${line}`);
                // alert(`Clipboard Watcher Error: ${line}`); // Optional, might be noisy
            });

            command.on('close', (data) => {
                logger.log(`[ClipboardWatcher] Process exited with code ${data.code}`);
                this.isRunning = false;
                this.child = null;
                if (data.code !== 0) {
                    // message(`Clipboard Watcher Exited with code ${data.code}`, { title: 'App Error', kind: 'error' });
                }
            });

            this.child = await command.spawn();
            this.isRunning = true;
            logger.log('[ClipboardWatcher] Started.');

        } catch (error: any) {
            logger.error('[ClipboardWatcher] Failed to start:', error);
            // message(`Clipboard Watcher Failed to Start:\n${error}\n${JSON.stringify(error, Object.getOwnPropertyNames(error))}`, { title: 'App Error', kind: 'error' });
        }
    }

    private handleMessage(msg: any) {
        if (msg.type === 'change') {
            // Logic from Electron implementation
            // Just specific to "smart translate" trigger?
            // Electron implementation had logic for "rapid change" (Ctrl+C+C)
            // But the native sidecar 'watch-clipboard' command might handle some logic or just emit changes?
            // Electron's ClipboardWatcher.ts handled the logic.
            // "Detection: Purely time-based now to avoid false positives... A 'rapid' change is a second copy within 500ms."

            // Wait, does Native sidecar emit sequence numbers?
            // Yes, Electron code: `msg.type === 'change'`, `msg.sequence`.

            this.detectRapidChange(msg);
        }
    }

    private lastChangeTime: number = 0;
    private lastSequence: number = 0;

    private detectRapidChange(msg: any) {
        const currentSequence = msg.sequence;
        if (currentSequence === this.lastSequence) return;

        const now = Date.now();
        const timeDiff = now - this.lastChangeTime;
        const isRapid = timeDiff > 10 && timeDiff < 500;

        if (isRapid) {
            logger.log('[ClipboardWatcher] Rapid change detected! Triggering Smart Translate.');
            // Read clipboard text
            // We need to read clipboard. 
            // navigator.clipboard.readText() works in focused window.
            // But if window is hidden/minimized, we might need Tauri API.
            // Tauri plugin-clipboard-manager is deprecated/moved?
            // "tauri-plugin-clipboard-manager" is available in v2.
            // But standard web API might fail if not focused.
            // Let's try dispatching event first, and let the listener handle reading.

            // Dispatch a custom event to the window so React components can listen
            const event = new CustomEvent('smart-translate-trigger');
            window.dispatchEvent(event);
        }

        this.lastSequence = currentSequence;
        this.lastChangeTime = now;
    }

    async stop() {
        if (this.child) {
            await this.child.kill();
            this.child = null;
            this.isRunning = false;
        }
    }
}

export const clipboardWatcherService = new ClipboardWatcherService();
