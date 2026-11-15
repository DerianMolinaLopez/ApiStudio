mod commands;
mod error;
mod models;
mod services;

use std::sync::Arc;

use services::{history::History, http_engine::HttpEngine, workspace::Workspace};
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(HttpEngine::default()))
        .setup(|app| {
            let paths = app.path();
            // El workspace va en Documentos para que sea fácil de versionar con Git.
            let root = paths
                .document_dir()
                .or_else(|_| paths.home_dir())?
                .join("API Studio");
            app.manage(Arc::new(Workspace::new(root)?));
            app.manage(Arc::new(History::new(paths.app_data_dir()?.join("history.json"))));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::http::send_request,
            commands::http::cancel_request,
            commands::http::clear_cookies,
            commands::workspace::workspace_path,
            commands::workspace::list_tree,
            commands::workspace::create_folder,
            commands::workspace::read_request,
            commands::workspace::write_request,
            commands::workspace::create_request,
            commands::workspace::rename_node,
            commands::workspace::delete_node,
            commands::workspace::move_node,
            commands::workspace::list_environments,
            commands::workspace::write_environment,
            commands::workspace::delete_environment,
            commands::history::history_list,
            commands::history::history_add,
            commands::history::history_delete,
            commands::history::history_clear,
            commands::files::read_text_file,
            commands::files::write_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar API Studio");
}
