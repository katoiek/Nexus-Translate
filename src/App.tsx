import { useState, useEffect } from 'react'
import { TranslationView } from './components/TranslationView'
import { SettingsView } from './components/SettingsView'
import { ScreenshotView } from './components/ScreenshotView'
import { CloseConfirmationDialog } from './components/CloseConfirmationDialog'

function App() {
  const [currentView, setCurrentView] = useState<'translation' | 'settings' | 'screenshot'>('translation');
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  useEffect(() => {
    // Check URL params for screenshot mode
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'screenshot') {
      setCurrentView('screenshot');
    }

    const handleStartCapture = () => setCurrentView('screenshot');
    const handleEndCapture = () => {
      // If we are in the separate capture window, we should close it.
      // But if we are in main window (for dev testing), switch back.
      if (params.get('mode') === 'screenshot') {
        window.ipcRenderer?.send('close-capture-window');
      } else {
        setCurrentView('translation');
      }
    };

    const handleShowCloseConfirmation = () => {
      setShowCloseDialog(true);
    };

    window.ipcRenderer?.on('start-capture', handleStartCapture);
    window.ipcRenderer?.on('capture-complete', handleEndCapture); // Reset view after capture
    window.ipcRenderer?.on('cancel-capture', handleEndCapture);
    window.ipcRenderer?.on('show-close-confirmation', handleShowCloseConfirmation);

    return () => {
      // Cleanup listeners if possible
    };
  }, []);

  const handleCloseConfirm = (action: 'quit' | 'minimize', remember: boolean) => {
    setShowCloseDialog(false);

    if (remember && window.ipcRenderer) {
      window.ipcRenderer.invoke('set-setting', 'closeBehavior', action);
    }

    window.ipcRenderer?.send('confirm-close-action', action);
  };

  return (
    <>
      <div style={{ display: currentView === 'translation' ? 'block' : 'none' }}>
        <TranslationView onNavigateToSettings={() => setCurrentView('settings')} />
      </div>

      {currentView === 'settings' && (
        <SettingsView onBack={() => setCurrentView('translation')} />
      )}

      {currentView === 'screenshot' && (
        <ScreenshotView />
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
