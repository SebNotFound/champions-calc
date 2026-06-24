# EXO Calc — Android overlay

A small native Android app that floats the EXO damage calculator **over any other
app** (the game), like a GAMINIK-style bubble. It is the same calculator as the
website and the desktop overlay: the web build is bundled into the APK and shown
in a system-overlay WebView, so it runs fully **offline**.

## How it works

- `MainActivity` — a tiny launcher that grants the "draw over other apps"
  permission and starts/stops the overlay service.
- `OverlayService` — a foreground service that owns two always-on-top windows:
  - a draggable **EXO bubble**, and
  - a **panel** (a `WebView`) the bubble toggles, loading the bundled calc.
- The calc is served from `app/src/main/assets/` via `WebViewAssetLoader` over a
  virtual `https://appassets.androidplatform.net` origin (so absolute paths and
  `localStorage` work exactly as on the website).
- Transparency reuses the site's existing `tauri-overlay` CSS class (added on
  page load): it drops the page background so the game shows through the gaps.

### Roadmap

- **Phase A (this):** floating bubble + offline calc panel, transparent.
- **Phase B:** capture the enemy team from the screen (`MediaProjection`) and run
  the existing on-device recognizer (the same flow as the desktop "Capture").
- **Phase C:** compact layout, opacity slider, resize, signed release APK, icon.

## Build

Prerequisites (already set up on this machine): JDK 17, the Android SDK
(`ANDROID_HOME`), and the Gradle 8.14 wrapper this folder ships.

```bat
:: From the android\ folder — builds the web calc, copies it into assets,
:: and produces a debug APK:
build-apk.bat
```

The APK lands at `app\build\outputs\apk\debug\app-debug.apk`. Install it on a
connected phone with:

```bat
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

Then open **EXO Calc**, tap *Activer l'overlay*, grant the overlay permission,
and the bubble appears over whatever you're running.
