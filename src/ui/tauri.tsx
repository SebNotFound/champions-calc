/**
 * Tiny bridge to the Tauri desktop shell (the overlay app).
 *
 * Everything here works through the global `window.__TAURI__` that the shell
 * injects (withGlobalTauri). That means the WEBSITE never imports any Tauri
 * package: on the web `isTauri()` is false and all of this is inert, so the
 * normal build and bundle are completely unaffected. Only the overlay, which runs
 * inside Tauri, lights these up.
 */
import { useEffect, useState } from 'react';

interface TauriWindow {
  close: () => Promise<void>;
  minimize: () => Promise<void>;
}
interface TauriGlobal {
  core: { invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T> };
  window: { getCurrentWindow: () => TauriWindow };
}

function tauri(): TauriGlobal | undefined {
  return (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;
}

/** True when running inside the desktop overlay (not the website). */
export function isTauri(): boolean {
  return !!tauri();
}

/** Call a Rust command. Throws if not in the desktop app. */
export async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const t = tauri();
  if (!t) throw new Error('This action only works in the desktop app.');
  return t.core.invoke<T>(cmd, args);
}

/**
 * The frameless window's close/minimize buttons. Renders nothing on the website.
 * The header carries `data-tauri-drag-region` so the whole bar drags the window.
 */
export function TauriWindowControls() {
  // See-through level for the whole overlay (1 = solid). Persisted, and applied as
  // a CSS variable the overlay stylesheet reads. On the website this is inert.
  const [opacity, setOpacity] = useState(() => {
    const v = Number(localStorage.getItem('champions-calc/overlay-opacity'));
    return v >= 0.2 && v <= 1 ? v : 1;
  });
  useEffect(() => {
    if (!isTauri()) return;
    document.documentElement.style.setProperty('--overlay-opacity', String(opacity));
    localStorage.setItem('champions-calc/overlay-opacity', String(opacity));
  }, [opacity]);

  if (!isTauri()) return null;
  const win = () => tauri()!.window.getCurrentWindow();
  return (
    <div className="tauri-winctl">
      <input
        className="tauri-opacity"
        type="range"
        min="0.2"
        max="1"
        step="0.05"
        value={opacity}
        title="See-through (overlay opacity)"
        aria-label="Overlay opacity"
        onChange={(e) => setOpacity(Number(e.target.value))}
      />
      <button className="tauri-wbtn" title="Minimize" aria-label="Minimize" onClick={() => win().minimize()}>–</button>
      <button className="tauri-wbtn tauri-wbtn--close" title="Close" aria-label="Close" onClick={() => win().close()}>×</button>
    </div>
  );
}

/**
 * In the overlay, mark the document so the page background goes transparent (the
 * panels stay opaque), letting the game show through. No-op on the website.
 */
export function useTauriOverlayChrome() {
  useEffect(() => {
    if (isTauri()) {
      document.documentElement.classList.add('tauri-overlay');
      return () => document.documentElement.classList.remove('tauri-overlay');
    }
  }, []);
}
