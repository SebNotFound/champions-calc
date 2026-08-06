import { mount } from 'svelte';
// The exact same stylesheets the React app uses. The design system is plain CSS,
// so both UIs are pixel-identical without duplicating a single rule.
import '@styles/index.css';
import '@styles/App.css';
import App from './App.svelte';

export default mount(App, { target: document.getElementById('root')! });
