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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![capture_device_screen])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
