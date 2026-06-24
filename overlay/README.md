# EXO Calc Overlay (desktop)

A small always-on-top desktop app that reads the enemy team straight from your
device and shows the matchup over the game. It is built with Tauri and **reuses the
web app's calc + recognition core** (`../src`) through the `@core` Vite alias, so the
maths is never forked.

How it captures: the user plays the phone version on PC via scrcpy, so the overlay
asks the phone for its screen directly with `adb exec-out screencap -p` (native
resolution, the cleanest frame), then runs the same on-device recognizer the website
uses. No screen/window grabbing needed.

## Requirements

- Rust + the MSVC C++ build tools (Tauri prerequisites)
- `adb` on your PATH, with a device connected (the same one scrcpy mirrors)
- Node 20+

## Run it (dev)

```bash
cd overlay
npm install
npm run tauri dev
```

The window opens always-on-top with the full calculator. On the enemy team box use
**Capture** (one click, reads the device via adb) or the global hotkey below.

## Global hotkeys

These work even while the game is focused:

- **Ctrl+Shift+X** - show / hide the overlay
- **Ctrl+Shift+C** - capture the enemy team (adb) and open the review
- **Ctrl+Shift+A** - toggle click-through (play *through* the overlay; press again to interact)

## Launch it (built app)

For everyday use, build it once and launch the standalone app (instant, no compile):

```bash
cd overlay
npm run tauri build
```

That produces:
- a directly runnable exe at `src-tauri/target/release/app.exe`,
- an installer under `src-tauri/target/release/bundle/` (Start Menu shortcut).

Convenience scripts in this folder:
- **launch-overlay.bat** - double-click to start the built app (right-click -> Send to -> Desktop to make a shortcut),
- **dev-overlay.bat** - start in dev mode instead.

Note: the app needs `adb` on PATH at runtime for Capture.

## Notes

It is the same web app loaded in a transparent Tauri window. All the desktop-only
bits (adb capture, window controls, opacity slider, hotkeys) are gated behind the
Tauri runtime, so importing the shared `../src` never affects the website build.
