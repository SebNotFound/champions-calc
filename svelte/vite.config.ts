import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath, URL } from 'node:url';

/**
 * The Svelte UI is a sibling of the React app, not a fork: it imports the very
 * same framework-free core (the Champions stat model, the @smogon/calc bridge,
 * the recognizer) straight out of ../src, and the very same stylesheets. Only the
 * component layer differs.
 *
 * Bare imports inside ../src (@pkmn/dex, @smogon/calc, ...) resolve against the
 * ROOT node_modules, because that's where those files live — so this workspace
 * only needs Svelte and Vite of its own.
 */
export default defineConfig({
  plugins: [svelte()],
  // Reuse the bundled sprites (Champions-original Megas) served from the root.
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('../src/champions', import.meta.url)),
      '@recognition': fileURLToPath(new URL('../src/recognition', import.meta.url)),
      '@styles': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    // Allow serving the shared core/styles that live above this workspace.
    fs: { allow: ['..'] },
  },
});
