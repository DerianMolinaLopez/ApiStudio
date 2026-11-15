mod commands;
mod error;
mod models;
mod services;

use std::sync::Arc;

use services::http_engine::HttpEngine;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(HttpEngine::default()))
        .invoke_handler(tauri::generate_handler![
            commands::http::send_request,
            commands::http::cancel_request,
            commands::http::clear_cookies,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar API Studio");
}
