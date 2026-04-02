import { useState, useEffect } from 'react'
import { TranslationView } from './components/TranslationView'
import { SettingsView } from './components/SettingsView'
import { ScreenshotView } from './components/ScreenshotView'
import { CloseConfirmationDialog } from './components/CloseConfirmationDialog'
import { clipboardWatcherService } from './services/ClipboardWatcherService'
import { getCurrentWindow, availableMonitors, PhysicalSize, PhysicalPosition } from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { emit, listen } from '@tauri-apps/api/event'
import { exit } from '@tauri-apps/plugin-process'
import { type as osType } from '@tauri-apps/plugin-os'
import { logger } from './lib/logger'

import { nativeService } from './services/NativeService'

function App() {
  const [currentView, setCurrentView] = useState<'translation' | 'settings' | 'screenshot'>('translation');
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [captureOffset, setCaptureOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Start clipboard watcher
    clipboardWatcherService.start();

    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'screenshot') {
      setCurrentView('screenshot');
      const savedOffset = localStorage.getItem('screenshot_offset');
      if (savedOffset) {
        setCaptureOffset(JSON.parse(savedOffset));
      }
    }

    // Listen for smart translate trigger from service
    const handleSmartTranslateTrigger = () => {
      getCurrentWindow().setFocus();
      // TranslationView will handle the clipboard reading via its own listener
    };

    window.addEventListener('smart-translate-trigger', handleSmartTranslateTrigger);

    // Listen for OCR results from the screenshot window
    const unlisten = listen('ocr-captured-text', (event) => {
      const customEvent = new CustomEvent('ocr-captured-text', { detail: event.payload });
      window.dispatchEvent(customEvent);
      getCurrentWindow().setFocus();
    });

    return () => {
      clipboardWatcherService.stop();
      window.removeEventListener('smart-translate-trigger', handleSmartTranslateTrigger);
      unlisten.then(u => u());
    };
  }, []);

  // Update root element with current view to allow CSS to strip backgrounds during screenshot
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) {
      root.setAttribute('data-view', currentView);
    }
  }, [currentView]);


  const handleScreenshotRequest = async () => {
    try {
      const osName = await osType();

      if (osName === 'macos') {
        const win = getCurrentWindow();
        try {
          const result = await nativeService.performMacInteractiveCapture();
          if (result && result.text) {
            const event = new CustomEvent('ocr-captured-text', { detail: result.text });
            window.dispatchEvent(event);
          }
        } catch (e) {
          logger.error('Mac native capture failed:', e);
        } finally {
          await win.show();
          await win.setFocus();
        }
        return;
      }

      // Windows/Linux: Use the dedicated screenshot window
      const monitors = await availableMonitors();
      let minX = 0, minY = 0, maxX = 0, maxY = 0;

      if (monitors.length > 0) {
        minX = monitors[0].position.x;
        minY = monitors[0].position.y;
        maxX = monitors[0].position.x + monitors[0].size.width;
        maxY = monitors[0].position.y + monitors[0].size.height;

        for (const m of monitors) {
          minX = Math.min(minX, m.position.x);
          minY = Math.min(minY, m.position.y);
          maxX = Math.max(maxX, m.position.x + m.size.width);
          maxY = Math.max(maxY, m.position.y + m.size.height);
        }
      }

      const totalWidth = maxX - minX;
      const totalHeight = maxY - minY;

      // Store offset in localStorage for the screenshot window to pick up
      // 物理ピクセルのまま保存する（ScreenshotView.tsx 側も物理ピクセルで加算するため）
      localStorage.setItem('screenshot_offset', JSON.stringify({ x: minX, y: minY }));

      // Find or create the screenshot window
      let swin = await WebviewWindow.getByLabel('screenshot');
      if (swin) {
        // Hide main window to allow capturing what's behind it
        const mainWin = await WebviewWindow.getByLabel('main');
        if (mainWin) {
          await mainWin.hide();
          // Small delay to ensure OS has hidden the window before we show the overlay
          await new Promise(r => setTimeout(r, 100));
        }
        
        await swin.setPosition(new PhysicalPosition(minX, minY));
        await swin.setSize(new PhysicalSize(totalWidth, totalHeight));
        await swin.show();
        await swin.setFocus();
      }

    } catch (e) {
      logger.error('Screenshot request failed:', e);
    }
  };


  const handleCapture = async (rect: { x: number, y: number, width: number, height: number }) => {
    const win = getCurrentWindow();
    const label = win.label;

    if (label === 'screenshot') {
      try {
        const result = await nativeService.performCaptureAndOCR(Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height));
        if (result && result.text) {
          // Emit to all windows (main will catch it)
          await emit('ocr-captured-text', result.text);
        }
      } catch (e) {
        logger.error('OCR failed:', e);
      } finally {
        await win.hide();
        // Show the main window again
        const mainWin = await WebviewWindow.getByLabel('main');
        if (mainWin) {
          await mainWin.show();
          await mainWin.setFocus();
        }
      }
    }
  };


  const handleCloseConfirm = async (action: 'quit' | 'minimize', remember: boolean) => {
    setShowCloseDialog(false);

    if (remember) {
      localStorage.setItem('closeBehavior', action);
    }

    if (action === 'quit') {
      await exit(0);
    } else {
      await getCurrentWindow().minimize();
    }
  };

  return (
    <>
      <div style={{ display: currentView === 'translation' ? 'block' : 'none' }}>
        <TranslationView
          onNavigateToSettings={() => setCurrentView('settings')}
          onRequestScreenshot={handleScreenshotRequest}
        />
      </div>

      {currentView === 'settings' && (
        <SettingsView
          onBack={() => setCurrentView('translation')}
        />
      )}

      {currentView === 'screenshot' && (
        <ScreenshotView
          offset={captureOffset}
          onClose={async () => {
             const win = getCurrentWindow();
             await win.hide();
             // Show the main window again
             const mainWin = await WebviewWindow.getByLabel('main');
             if (mainWin) {
               await mainWin.show();
               await mainWin.setFocus();
             }
          }}
          onCapture={handleCapture}
        />
      )}

      {showCloseDialog && (
        <CloseConfirmationDialog
          onClose={() => setShowCloseDialog(false)}
          onConfirm={handleCloseConfirm}
        />
      )}
    </>
  )
}

export default App
