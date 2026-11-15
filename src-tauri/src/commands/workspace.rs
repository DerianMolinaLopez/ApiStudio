use std::sync::Arc;

use serde_json::Value;
use tauri::State;

use crate::{error::AppResult, models::workspace::TreeNode, services::workspace::Workspace};

type Ws<'a> = State<'a, Arc<Workspace>>;

#[tauri::command]
pub async fn workspace_path(ws: Ws<'_>) -> AppResult<String> {
    Ok(ws.root().to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn list_tree(ws: Ws<'_>) -> AppResult<Vec<TreeNode>> {
    ws.list_tree()
}

#[tauri::command]
pub async fn create_folder(ws: Ws<'_>, parent: String, name: String) -> AppResult<String> {
    ws.create_folder(&parent, &name)
}

#[tauri::command]
pub async fn read_request(ws: Ws<'_>, path: String) -> AppResult<Value> {
    ws.read_request(&path)
}

#[tauri::command]
pub async fn write_request(ws: Ws<'_>, path: String, request: Value) -> AppResult<()> {
    ws.write_request(&path, &request)
}

#[tauri::command]
pub async fn create_request(ws: Ws<'_>, parent: String, name: String, request: Value) -> AppResult<String> {
    ws.create_request(&parent, &name, &request)
}

#[tauri::command]
pub async fn rename_node(ws: Ws<'_>, path: String, name: String) -> AppResult<String> {
    ws.rename(&path, &name)
}

#[tauri::command]
pub async fn delete_node(ws: Ws<'_>, path: String) -> AppResult<()> {
    ws.delete(&path)
}

#[tauri::command]
pub async fn move_node(ws: Ws<'_>, path: String, parent: String) -> AppResult<String> {
    ws.move_node(&path, &parent)
}

#[tauri::command]
pub async fn list_environments(ws: Ws<'_>) -> AppResult<Vec<Value>> {
    ws.list_environments()
}

#[tauri::command]
pub async fn write_environment(ws: Ws<'_>, environment: Value) -> AppResult<()> {
    ws.write_environment(&environment)
}

#[tauri::command]
pub async fn delete_environment(ws: Ws<'_>, id: String) -> AppResult<()> {
    ws.delete_environment(&id)
}
