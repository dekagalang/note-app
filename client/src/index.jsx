/*import { scan } from "react-scan";*/
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { NotesProvider } from './contexts/NotesContext';
import { TagsProvider } from './contexts/TagsContext';
import { StarredNotesProvider } from './contexts/StarredNotesContext'; // Import StarredNotesProvider
import { UIPreferencesProvider } from './contexts/UIPreferencesContext'; // Import UIPreferencesProvider
import { AuthProvider } from './contexts/AuthContext'; // Import AuthProvider
import './utils/console'; // Import console utility to disable logs in production
import './index.css';


/*scan({
  enabled: false,
});*/

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope:', registration.scope);
        
        // Set up service worker communication
        setInterval(() => {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'PING',
              timestamp: Date.now()
            });
          }
        }, 30000);
        
        // Listen for messages from the service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'PONG') {
            console.log('Received PONG from service worker:', event.data);
          }
        });

        // Handle PWA install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
          // Prevent Chrome 67 and earlier from automatically showing the prompt
          e.preventDefault();
          // Stash the event so it can be triggered later
          window.deferredPrompt = e;
          console.log('Install prompt ready');
        });
      })
      .catch(error => {
        console.error('ServiceWorker registration failed:', error);
      });
  });
}

// Initialize theme
const initTheme = () => {
  const savedTheme = localStorage.getItem('theme');
  // Default to dark if not specified
  if (savedTheme === 'light') {
    document.documentElement.classList.add('light-theme');
  }
};

// Expose console toggle functions to window for easy access
import { enableConsoleLogs, disableConsoleLogs } from './utils/console';
window.enableLogs = enableConsoleLogs;
window.disableLogs = disableConsoleLogs;
window.toggleLogs = function() {
  if (console.log.name === 'noop') {
    console.log = window.originalConsole?.log || console.log;
    console.info = window.originalConsole?.info || console.info;
    console.warn = window.originalConsole?.warn || console.warn;
    console.debug = window.originalConsole?.debug || console.debug;
    console.log('Console logs ENABLED');
    return 'Console logs enabled';
  } else {
    // Save current console methods if not already saved
    if (!window.originalConsole) {
      window.originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        debug: console.debug
      };
    }
    console.log('Console logs DISABLED');
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    console.debug = () => {};
    return 'Console logs disabled';
  }
}

// Initialize theme
initTheme();

const root = createRoot(document.getElementById('root'));

root.render(

    <BrowserRouter>
      <AuthProvider> {/* AuthProvider wraps everything */}
        <UIPreferencesProvider> {/* UIPreferencesProvider for basic UI preferences */}
          <App />
        </UIPreferencesProvider>
      </AuthProvider>
    </BrowserRouter>

);
