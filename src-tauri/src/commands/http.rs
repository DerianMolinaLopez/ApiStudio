use std::sync::Arc;

use tauri::State;

use crate::{
    error::{AppError, AppResult},
    models::http::{HttpRequest, HttpResponse},
    services::http_engine::HttpEngine,
};

#[tauri::command]
pub async fn send_request(engine: State<'_, Arc<HttpEngine>>, request: HttpRequest) -> AppResult<HttpResponse> {
    let id = request.id.clone();
    let eng = Arc::clone(&engine);
    let task = tokio::spawn(async move { eng.execute(request).await });
    engine.register(id.clone(), task.abort_handle());
    let joined = task.await;
    engine.unregister(&id);
    match joined {
        Ok(result) => result,
        Err(e) if e.is_cancelled() => Err(AppError::Cancelled),
        Err(e) => Err(AppError::Network(format!("Fallo interno del motor: {e}"))),
    }
}

#[tauri::command]
pub fn cancel_request(engine: State<'_, Arc<HttpEngine>>, id: String) -> bool {
    engine.cancel(&id)
}

#[tauri::command]
pub fn clear_cookies(engine: State<'_, Arc<HttpEngine>>) {
    engine.clear_cookies();
}
