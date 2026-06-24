use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Whether click-through (ignore cursor events) is currently on. Toggled by a hotkey.
struct ClickThrough(Mutex<bool>);

/// Capture the connected device's screen as PNG bytes via adb.
///
/// Uses `adb exec-out screencap -p` (exec-out, not `shell`, so the binary PNG is
/// returned without the newline translation that corrupts the classic
/// `adb shell screencap`). The frontend wraps the bytes in a Blob and runs the
/// same on-device recognizer the web app uses. Returned as a raw ipc::Response so
/// the ~1-2 MB image crosses to JS as an ArrayBuffer, not a giant JSON array.
#[tauri::command]
fn capture_device_screen() -> Result<tauri::ipc::Response, String> {
  let output = std::process::Command::new("adb")
    .args(["exec-out", "screencap", "-p"])
    .output()
    .map_err(|e| format!("Could not run adb ({e}). Is adb on your PATH and scrcpy/your device connected?"))?;

  if !output.status.success() {
    let err = String::from_utf8_lossy(&output.stderr);
    return Err(format!("adb screencap failed: {}", err.trim()));
  }
  if output.stdout.is_empty() {
    return Err("adb returned no image. Is a device connected? (try `adb devices`)".into());
  }
  Ok(tauri::ipc::Response::new(output.stdout))
}

/// The modifier combo for every overlay hotkey: Ctrl+Shift.
fn mods() -> Modifiers {
  Modifiers::CONTROL | Modifiers::SHIFT
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(ClickThrough(Mutex::new(false)))
    .plugin(
      tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
          // Only act on the key-down edge.
          if event.state() != ShortcutState::Pressed {
            return;
          }
          // The hotkey fires on the OS shortcut thread, but window / webview calls
          // must happen on the main thread or the app crashes intermittently.
          // Marshal the whole action onto the main thread.
          let handle = app.clone();
          let sc = shortcut.clone();
          let _ = app.run_on_main_thread(move || {
            let Some(win) = handle.get_webview_window("main") else {
              return;
            };
            let m = mods();
            if sc.matches(m, Code::KeyX) {
              // Ctrl+Shift+X: show / hide the overlay.
              if win.is_visible().unwrap_or(true) {
                let _ = win.hide();
              } else {
                let _ = win.show();
                let _ = win.set_focus();
              }
            } else if sc.matches(m, Code::KeyC) {
              // Ctrl+Shift+C: capture the enemy team. The frontend listens and runs
              // the same flow as the on-screen "Capture" button.
              let _ = win.show();
              let _ = handle.emit("overlay-capture-enemy", ());
            } else if sc.matches(m, Code::KeyA) {
              // Ctrl+Shift+A: toggle click-through (play the game through the overlay).
              if let Ok(mut on) = handle.state::<ClickThrough>().0.lock() {
                *on = !*on;
                let _ = win.set_ignore_cursor_events(*on);
                let _ = handle.emit("overlay-clickthrough", *on);
              }
            }
          });
        })
        .build(),
    )
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // Register the global hotkeys. Failures are ignored (another app may already
      // hold a combo); that only means that one shortcut won't fire.
      let gs = app.global_shortcut();
      let _ = gs.register(Shortcut::new(Some(mods()), Code::KeyX));
      let _ = gs.register(Shortcut::new(Some(mods()), Code::KeyC));
      let _ = gs.register(Shortcut::new(Some(mods()), Code::KeyA));
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![capture_device_screen])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
