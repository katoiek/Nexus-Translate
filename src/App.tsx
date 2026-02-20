import { useState, useEffect } from 'react'
import { TranslationView } from './components/TranslationView'
import { SettingsView } from './components/SettingsView'
import { ScreenshotView } from './components/ScreenshotView'
import { CloseConfirmationDialog } from './components/CloseConfirmationDialog'
import { clipboardWatcherService } from './services/ClipboardWatcherService'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { exit } from '@tauri-apps/plugin-process'
import { message } from '@tauri-apps/plugin-dialog'

import { nativeService } from './services/NativeService'

function App() {
  const [currentView, setCurrentView] = useState<'translation' | 'settings' | 'screenshot'>('translation');
  const [showCloseDialog, setShowCloseDialog] = useState(false);

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
      await getCurrentWindow().setFullscreen(true);
      setCurrentView('screenshot');
    } catch (e: any) {
      console.error(e);
      message(`Screenshot Request Failed: ${e}`, { title: 'App Error', kind: 'error' });
    }
  };

  const handleCapture = async (rect: { x: number, y: number, width: number, height: number }) => {
    await getCurrentWindow().setFullscreen(false);
    setCurrentView('translation');

    try {
      const result = await nativeService.performCaptureAndOCR(Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height));

      if (result && result.text) {
        const event = new CustomEvent('ocr-captured-text', { detail: result.text });
        window.dispatchEvent(event);
      }
    } catch (e: any) {
      console.error("OCR Failed", e);
      message(`OCR Failed: ${e}`, { title: 'App Error', kind: 'error' });
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
          onClose={async () => {
            await getCurrentWindow().setFullscreen(false);
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
