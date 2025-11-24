// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::time::Duration;
use tauri::{Manager, AppHandle};
use sysinfo::{PidExt, ProcessExt, System, SystemExt};

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_system_info() -> serde_json::Value {
    serde_json::json!({
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    })
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            start_memory_watchdog(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, get_system_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn start_memory_watchdog(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let pid = sysinfo::get_current_pid().unwrap_or_default();
        let mut sys = System::new();
        let mut triggered = false;
        loop {
            sys.refresh_process(pid);
            if let Some(proc) = sys.process(pid) {
                // memory() returns in KB
                if proc.memory() > 130 * 1024 && !triggered {
                    triggered = true;
                    let _ = app.emit("system:memory-warning", proc.memory());
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.eval("window.location.reload()");
                    }
                }
                if proc.memory() < 120 * 1024 {
                    triggered = false;
                }
            }
            tauri::async_runtime::sleep(Duration::from_secs(15)).await;
        }
    });
}


