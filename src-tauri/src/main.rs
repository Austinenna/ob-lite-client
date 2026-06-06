// Prevents an extra console window on Windows in release. Harmless on macOS.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ob_lite_client_lib::run();
}
