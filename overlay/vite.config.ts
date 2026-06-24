import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Vite config for the desktop overlay. It reuses the web app's calc + recognition
// core (../src) through the `@core` alias, so there is a single source of truth and
// the overlay never forks the maths.
export default defineConfig({
  plugins: [react()],
  // Serve the web app's static assets (the bundled Champions-original Mega
  // sprites live in ../public/sprites/champions), so spriteUrl's local paths work.
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  // Tauri wraps this dev server; keep its output and a fixed port stable.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Allow importing the shared core that lives one level up (repo root /src).
    fs: { allow: ['..'] },
  },
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('../src', import.meta.url)),
    },
    // The shared core (../src) and this app both import react; without deduping,
    // the production build bundles two React copies and hooks crash
    // ("Cannot read properties of null (reading 'useState')"). Force a single copy.
    dedupe: ['react', 'react-dom'],
  },
});
