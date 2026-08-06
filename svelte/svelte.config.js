import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  // Lets <script lang="ts"> in .svelte files go through Vite's TS transform.
  preprocess: vitePreprocess(),
};
