import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// The overlay IS the web app: same design, same functions. The Tauri-only extras
// (adb capture, window controls, transparency) live inside the app itself, gated
// so they only appear when running in the desktop shell.
import '@core/index.css';
import App from '@core/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
