use crate::error::AppResult;

/// Lee un archivo elegido por el usuario (diálogo de importación).
#[tauri::command]
pub async fn read_text_file(path: String) -> AppResult<String> {
    Ok(tokio::fs::read_to_string(path).await?)
}

/// Escribe un archivo elegido por el usuario (diálogo de exportación).
#[tauri::command]
pub async fn write_text_file(path: String, content: String) -> AppResult<()> {
    Ok(tokio::fs::write(path, content).await?)
}
