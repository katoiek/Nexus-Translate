import { useState, useEffect } from 'react'
import { TranslationView } from './components/TranslationView'
import { SettingsView } from './components/SettingsView'
import { ScreenshotView } from './components/ScreenshotView'
import { CloseConfirmationDialog } from './components/CloseConfirmationDialog'
import { clipboardWatcherService } from './services/ClipboardWatcherService'
import { getCurrentWindow, availableMonitors, currentMonitor, PhysicalSize, PhysicalPosition } from '@tauri-apps/api/window'
import { exit } from '@tauri-apps/plugin-process'
import { type as osType } from '@tauri-apps/plugin-os'
import { logger } from './lib/logger'

import { nativeService } from './services/NativeService'

function App() {
  const [currentView, setCurrentView] = useState<'translation' | 'settings' | 'screenshot'>('translation');
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [originalWindowState, setOriginalWindowState] = useState<{ size: PhysicalSize | null, position: PhysicalPosition | null, alwaysOnTop: boolean, decorations: boolean } | null>(null);
  const [captureOffset, setCaptureOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Start clipboard watcher
    clipboardWatcherService.start();

    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'screenshot') {
      setCurrentView('screenshot');
    }

    // Listen for smart translate trigger from service
    const handleSmartTranslateTrigger = () => {
      getCurrentWindow().setFocus();
      // TranslationView will handle the clipboard reading via its own listener
    };

    window.addEventListener('smart-translate-trigger', handleSmartTranslateTrigger);

    return () => {
      clipboardWatcherService.stop();
      window.removeEventListener('smart-translate-trigger', handleSmartTranslateTrigger);
    };
  }, []);

  // Update root element with current view to allow CSS to strip backgrounds during screenshot
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) {
      root.setAttribute('data-view', currentView);
    }
  }, [currentView]);

  const handleCloseRequest = async () => {
    const behavior = localStorage.getItem('closeBehavior') || 'ask';
    if (behavior === 'ask') {
      setShowCloseDialog(true);
    } else if (behavior === 'minimize') {
      await getCurrentWindow().minimize();
    } else {
      await exit(0);
    }
  };

  const handleMinimizeRequest = async () => {
    await getCurrentWindow().minimize();
  };

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
          // Bring focus back to our app after the OS screenshot UI closes
          await win.show();
          await win.setFocus();
        }
        return; // Early return for macOS, skip the custom Webview overlay
      }

      // Windows/Linux Fallback: Custom Webview Overlay
      const win = getCurrentWindow();
      const currentSize = await win.outerSize();
      const currentPos = await win.outerPosition();

      // Save the current state to restore later
      setOriginalWindowState({
        size: currentSize,
        position: currentPos,
        alwaysOnTop: true, // Assuming it's typically on top or we want to force it
        decorations: false
      });

      // Calculate Bounding Box across all monitors
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

      // Make window cover the entire virtual screen
      await win.setPosition(new PhysicalPosition(minX, minY));
      await win.setSize(new PhysicalSize(totalWidth, totalHeight));

      const monitor = await currentMonitor();
      const scaleFactor = monitor?.scaleFactor || 1;

      setCaptureOffset({ x: minX / scaleFactor, y: minY / scaleFactor });
      setCurrentView('screenshot');

      // Add a slight delay and focus so Mac registers keyboard events (ESC) on the transparent overlay
      setTimeout(async () => {
        await win.setAlwaysOnTop(true);
        await win.setFocus();
      }, 50);

    } catch (e) {
      logger.error('Screenshot request failed:', e);
    }
  };

  const handleRestoreWindow = async () => {
    if (originalWindowState) {
      const win = getCurrentWindow();
      if (originalWindowState.size) {
        await win.setSize(originalWindowState.size);
      }
      if (originalWindowState.position) {
        await win.setPosition(originalWindowState.position);
      }
      setOriginalWindowState(null);
    }
  };

  const handleCapture = async (rect: { x: number, y: number, width: number, height: number }) => {
    try {
      await handleRestoreWindow();
    } catch (err) {
      logger.error('Restore window failed:', err);
    } finally {
      // ALWAYS switch back to translation to avoid being stuck in screenshot view
      setCurrentView('translation');
    }

    try {
      const result = await nativeService.performCaptureAndOCR(Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height));

      if (result && result.text) {
        const event = new CustomEvent('ocr-captured-text', { detail: result.text });
        window.dispatchEvent(event);
      }
    } catch (e) {
      logger.error('OCR failed:', e);
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
          onMinimize={handleMinimizeRequest}
          onClose={handleCloseRequest}
          onRequestScreenshot={handleScreenshotRequest}
        />
      </div>

      {currentView === 'settings' && (
        <SettingsView
          onBack={() => setCurrentView('translation')}
          onMinimize={handleMinimizeRequest}
          onClose={handleCloseRequest}
        />
      )}

      {currentView === 'screenshot' && (
        <ScreenshotView
          offset={captureOffset}
          onClose={async () => {
            await handleRestoreWindow();
            setCurrentView('translation');
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
