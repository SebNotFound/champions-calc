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

The window opens always-on-top. Put the enemy Team Preview on your phone, click
**Capture enemy team**, and it fills in what it read.

## Build a standalone app

```bash
cd overlay
npm run tauri build
```

The installer/exe lands in `src-tauri/target/release/`.

## Status

V1 proves the capture -> recognize loop on device: it shows the enemy team it read
(confident reads, plus low-confidence best guesses to confirm). The full damage calc
is layered on next.
