use std::{fs, path::PathBuf, sync::Mutex};

use serde_json::Value;

use crate::error::{AppError, AppResult};

const MAX_ENTRIES: usize = 300;

/// Historial de ejecuciones. Vive en el directorio de datos de la app (no se versiona con Git).
pub struct History {
    path: PathBuf,
    lock: Mutex<()>,
}

fn storage<E: std::fmt::Display>(e: E) -> AppError {
    AppError::Storage(e.to_string())
}

impl History {
    pub fn new(path: PathBuf) -> Self {
        Self { path, lock: Mutex::new(()) }
    }

    fn load(&self) -> Vec<Value> {
        fs::read_to_string(&self.path).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
    }

    fn save(&self, items: &[Value]) -> AppResult<()> {
        if let Some(d) = self.path.parent() {
            fs::create_dir_all(d).map_err(storage)?;
        }
        let tmp = self.path.with_extension("tmp");
        fs::write(&tmp, serde_json::to_string(items).map_err(storage)?).map_err(storage)?;
        fs::rename(tmp, &self.path).map_err(storage)
    }

    /// Más recientes primero.
    pub fn list(&self) -> Vec<Value> {
        let _g = self.lock.lock().unwrap();
        self.load()
    }

    pub fn add(&self, entry: Value) -> AppResult<()> {
        let _g = self.lock.lock().unwrap();
        let mut items = self.load();
        items.insert(0, entry);
        items.truncate(MAX_ENTRIES);
        self.save(&items)
    }

    pub fn delete(&self, id: &str) -> AppResult<()> {
        let _g = self.lock.lock().unwrap();
        let mut items = self.load();
        items.retain(|v| v.get("id").and_then(|i| i.as_str()) != Some(id));
        self.save(&items)
    }

    pub fn clear(&self) -> AppResult<()> {
        let _g = self.lock.lock().unwrap();
        self.save(&[])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn agrega_limita_y_borra() {
        let h = History::new(std::env::temp_dir().join(format!("as-hist-{}.json", uuid::Uuid::new_v4())));
        for i in 0..(MAX_ENTRIES + 5) {
            h.add(json!({"id": i.to_string()})).unwrap();
        }
        let l = h.list();
        assert_eq!(l.len(), MAX_ENTRIES);
        assert_eq!(l[0]["id"], (MAX_ENTRIES + 4).to_string());
        h.delete(&(MAX_ENTRIES + 4).to_string()).unwrap();
        assert_eq!(h.list().len(), MAX_ENTRIES - 1);
        h.clear().unwrap();
        assert!(h.list().is_empty());
    }
}
