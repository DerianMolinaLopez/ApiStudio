use std::sync::Arc;

use serde_json::Value;
use tauri::State;

use crate::{error::AppResult, services::history::History};

#[tauri::command]
pub async fn history_list(h: State<'_, Arc<History>>) -> AppResult<Vec<Value>> {
    Ok(h.list())
}

#[tauri::command]
pub async fn history_add(h: State<'_, Arc<History>>, entry: Value) -> AppResult<()> {
    h.add(entry)
}

#[tauri::command]
pub async fn history_delete(h: State<'_, Arc<History>>, id: String) -> AppResult<()> {
    h.delete(&id)
}

#[tauri::command]
pub async fn history_clear(h: State<'_, Arc<History>>) -> AppResult<()> {
    h.clear()
}
