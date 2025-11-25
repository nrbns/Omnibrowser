// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{thread, time::Duration};
use tauri::Manager;
use sysinfo::{ProcessExt, System, SystemExt};

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

fn start_memory_watchdog(app: tauri::AppHandle) {
    let memory_cap = std::env::var("TAURI_MEMORY_LIMIT")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(130 * 1024 * 1024);

    thread::spawn(move || {
        let pid = std::process::id();
        let pid = sysinfo::Pid::from_u32(pid);
        let mut system = System::new();

        loop {
            thread::sleep(Duration::from_secs(10));

            system.refresh_process(pid);
            if let Some(process) = system.process(pid) {
                let memory_bytes = process.memory() as u64 * 1024;
                if memory_bytes > memory_cap {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.emit("app:memory-watchdog", memory_bytes);
                        let _ = window.eval("window.location.reload()");
                    }
                }
            }
        }
    });
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


