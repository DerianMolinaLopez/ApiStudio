//! Persistencia del workspace en disco, pensada para Git:
//!
//! ```text
//! <workspace>/collections/<colección>/<carpeta>/<solicitud>.json
//! <workspace>/environments/<entorno>.json
//! ```
//! Cada solicitud y cada entorno es un JSON indentado en su propio archivo.

use std::{
    fs,
    path::{Component, Path, PathBuf},
};

use serde_json::Value;

use crate::{
    error::{AppError, AppResult},
    models::workspace::TreeNode,
};

const EXT: &str = "json";

pub struct Workspace {
    root: PathBuf,
}

fn storage<E: std::fmt::Display>(e: E) -> AppError {
    AppError::Storage(e.to_string())
}

/// Quita caracteres no válidos en nombres de archivo y recorta espacios/puntos.
pub fn sanitize(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || c.is_control() { '-' } else { c })
        .collect();
    let t = cleaned.trim().trim_matches('.').trim();
    if t.is_empty() {
        "Sin nombre".into()
    } else if is_reserved_windows_name(t) {
        format!("{t}_")
    } else {
        t.to_owned()
    }
}

/// Nombres de dispositivo que Windows no permite como archivo, con o sin extensión (CON, NUL, COM1…).
fn is_reserved_windows_name(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or(name).to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ["COM", "LPT"].iter().any(|p| {
            stem.strip_prefix(p).is_some_and(|n| n.len() == 1 && matches!(n.as_bytes()[0], b'1'..=b'9'))
        })
}

fn write_atomic(path: &Path, content: &str) -> AppResult<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(storage)?;
    }
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, content).map_err(storage)?;
    fs::rename(&tmp, path).map_err(storage)
}

fn pretty(v: &Value) -> AppResult<String> {
    let mut s = serde_json::to_string_pretty(v).map_err(storage)?;
    s.push('\n');
    Ok(s)
}

impl Workspace {
    pub fn new(root: PathBuf) -> AppResult<Self> {
        for d in ["collections", "environments"] {
            fs::create_dir_all(root.join(d)).map_err(storage)?;
        }
        Ok(Self { root })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    fn collections(&self) -> PathBuf {
        self.root.join("collections")
    }

    /// Resuelve una ruta relativa dentro de `base` rechazando `..`, rutas absolutas y similares.
    fn resolve(base: &Path, rel: &str) -> AppResult<PathBuf> {
        let mut out = base.to_path_buf();
        for c in Path::new(rel).components() {
            match c {
                Component::Normal(p) => out.push(p),
                Component::CurDir => {}
                _ => return Err(AppError::InvalidRequest(format!("Ruta no permitida: {rel}"))),
            }
        }
        Ok(out)
    }

    fn rel(&self, p: &Path) -> String {
        p.strip_prefix(self.collections())
            .unwrap_or(p)
            .components()
            .map(|c| c.as_os_str().to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join("/")
    }

    fn unique(dir: &Path, stem: &str, ext: Option<&str>) -> PathBuf {
        let file = |s: &str| match ext {
            Some(e) => dir.join(format!("{s}.{e}")),
            None => dir.join(s),
        };
        let mut p = file(stem);
        let mut n = 2;
        while p.exists() {
            p = file(&format!("{stem} ({n})"));
            n += 1;
        }
        p
    }

    // ── Colecciones ─────────────────────────────────────────────────────
    pub fn list_tree(&self) -> AppResult<Vec<TreeNode>> {
        self.read_dir(&self.collections())
    }

    fn read_dir(&self, dir: &Path) -> AppResult<Vec<TreeNode>> {
        let mut folders = vec![];
        let mut requests = vec![];
        for entry in fs::read_dir(dir).map_err(storage)?.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                continue;
            }
            if path.is_dir() {
                folders.push(TreeNode::Folder { name, path: self.rel(&path), children: self.read_dir(&path)? });
            } else if path.extension().is_some_and(|e| e == EXT) {
                let method = fs::read_to_string(&path)
                    .ok()
                    .and_then(|s| serde_json::from_str::<Value>(&s).ok())
                    .and_then(|v| v.get("method").and_then(|m| m.as_str().map(str::to_owned)))
                    .unwrap_or_else(|| "GET".into());
                let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
                requests.push(TreeNode::Request { name: stem, path: self.rel(&path), method });
            }
        }
        let key = |n: &TreeNode| match n {
            TreeNode::Folder { name, .. } | TreeNode::Request { name, .. } => name.to_lowercase(),
        };
        folders.sort_by_key(key);
        requests.sort_by_key(key);
        folders.extend(requests);
        Ok(folders)
    }

    /// Crea una carpeta (o una colección si `parent` está vacío). Devuelve su ruta.
    pub fn create_folder(&self, parent: &str, name: &str) -> AppResult<String> {
        let dir = Self::resolve(&self.collections(), parent)?;
        let path = Self::unique(&dir, &sanitize(name), None);
        fs::create_dir_all(&path).map_err(storage)?;
        Ok(self.rel(&path))
    }

    pub fn read_request(&self, rel: &str) -> AppResult<Value> {
        let path = Self::resolve(&self.collections(), rel)?;
        let text = fs::read_to_string(&path).map_err(storage)?;
        serde_json::from_str(&text).map_err(|e| AppError::Storage(format!("{rel}: JSON inválido ({e})")))
    }

    pub fn write_request(&self, rel: &str, value: &Value) -> AppResult<()> {
        let path = Self::resolve(&self.collections(), rel)?;
        write_atomic(&path, &pretty(value)?)
    }

    /// Crea un archivo de solicitud con nombre único dentro de `parent`.
    pub fn create_request(&self, parent: &str, name: &str, value: &Value) -> AppResult<String> {
        let dir = Self::resolve(&self.collections(), parent)?;
        if !dir.is_dir() {
            return Err(AppError::InvalidRequest("La carpeta destino no existe".into()));
        }
        let path = Self::unique(&dir, &sanitize(name), Some(EXT));
        let mut v = value.clone();
        if let Some(o) = v.as_object_mut() {
            o.insert("name".into(), Value::String(path.file_stem().unwrap().to_string_lossy().into_owned()));
        }
        write_atomic(&path, &pretty(&v)?)?;
        Ok(self.rel(&path))
    }

    pub fn rename(&self, rel: &str, new_name: &str) -> AppResult<String> {
        let from = Self::resolve(&self.collections(), rel)?;
        let parent = from.parent().ok_or_else(|| AppError::InvalidRequest("Ruta inválida".into()))?;
        let is_file = from.is_file();
        let stem = sanitize(new_name);
        let current = from.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
        if is_file && current == stem || !is_file && from.file_name().is_some_and(|n| n.to_string_lossy() == stem) {
            return Ok(rel.to_owned());
        }
        let to = Self::unique(parent, &stem, is_file.then_some(EXT));
        fs::rename(&from, &to).map_err(storage)?;
        if is_file {
            if let Ok(mut v) = self.read_request(&self.rel(&to)) {
                if let Some(o) = v.as_object_mut() {
                    o.insert("name".into(), Value::String(to.file_stem().unwrap().to_string_lossy().into_owned()));
                    write_atomic(&to, &pretty(&v)?)?;
                }
            }
        }
        Ok(self.rel(&to))
    }

    pub fn delete(&self, rel: &str) -> AppResult<()> {
        let path = Self::resolve(&self.collections(), rel)?;
        if path == self.collections() {
            return Err(AppError::InvalidRequest("No se puede borrar la raíz".into()));
        }
        if path.is_dir() { fs::remove_dir_all(path) } else { fs::remove_file(path) }.map_err(storage)
    }

    pub fn move_node(&self, rel: &str, new_parent: &str) -> AppResult<String> {
        let from = Self::resolve(&self.collections(), rel)?;
        let dest = Self::resolve(&self.collections(), new_parent)?;
        if !dest.is_dir() || dest.starts_with(&from) {
            return Err(AppError::InvalidRequest("Destino no válido".into()));
        }
        if from.parent() == Some(dest.as_path()) {
            return Ok(rel.to_owned());
        }
        let name = from.file_name().unwrap().to_string_lossy().into_owned();
        let to = if from.is_file() {
            let stem = from.file_stem().unwrap().to_string_lossy().into_owned();
            Self::unique(&dest, &stem, Some(EXT))
        } else {
            Self::unique(&dest, &name, None)
        };
        fs::rename(&from, &to).map_err(storage)?;
        Ok(self.rel(&to))
    }

    // ── Entornos ────────────────────────────────────────────────────────
    fn envs(&self) -> PathBuf {
        self.root.join("environments")
    }

    pub fn list_environments(&self) -> AppResult<Vec<Value>> {
        let mut out: Vec<Value> = fs::read_dir(self.envs())
            .map_err(storage)?
            .flatten()
            .filter(|e| e.path().extension().is_some_and(|x| x == EXT))
            .filter_map(|e| serde_json::from_str(&fs::read_to_string(e.path()).ok()?).ok())
            .collect();
        out.sort_by_key(|v| v.get("name").and_then(|n| n.as_str()).unwrap_or("").to_lowercase());
        Ok(out)
    }

    /// Guarda un entorno en `<nombre>.json`; si se renombró, elimina el archivo anterior (mismo `id`).
    pub fn write_environment(&self, value: &Value) -> AppResult<()> {
        let id = value.get("id").and_then(|v| v.as_str()).ok_or_else(|| AppError::InvalidRequest("El entorno no tiene id".into()))?;
        let name = value.get("name").and_then(|v| v.as_str()).unwrap_or("Entorno");
        let target = self.envs().join(format!("{}.{EXT}", sanitize(name)));
        for e in fs::read_dir(self.envs()).map_err(storage)?.flatten() {
            let p = e.path();
            if p != target && self.env_id(&p).as_deref() == Some(id) {
                fs::remove_file(p).map_err(storage)?;
            }
        }
        write_atomic(&target, &pretty(value)?)
    }

    pub fn delete_environment(&self, id: &str) -> AppResult<()> {
        for e in fs::read_dir(self.envs()).map_err(storage)?.flatten() {
            if self.env_id(&e.path()).as_deref() == Some(id) {
                fs::remove_file(e.path()).map_err(storage)?;
            }
        }
        Ok(())
    }

    fn env_id(&self, p: &Path) -> Option<String> {
        let v: Value = serde_json::from_str(&fs::read_to_string(p).ok()?).ok()?;
        v.get("id")?.as_str().map(str::to_owned)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn ws() -> Workspace {
        let dir = std::env::temp_dir().join(format!("api-studio-test-{}", uuid::Uuid::new_v4()));
        Workspace::new(dir).unwrap()
    }

    #[test]
    fn crea_lista_y_ordena_el_arbol() {
        let w = ws();
        let c = w.create_folder("", "Mi API").unwrap();
        let f = w.create_folder(&c, "Usuarios").unwrap();
        w.create_request(&c, "Health", &json!({"method": "GET"})).unwrap();
        let r = w.create_request(&f, "Crear", &json!({"method": "POST"})).unwrap();
        assert_eq!(r, "Mi API/Usuarios/Crear.json");
        let tree = serde_json::to_value(w.list_tree().unwrap()).unwrap();
        assert_eq!(tree[0]["children"][0]["name"], "Usuarios"); // carpetas primero
        assert_eq!(tree[0]["children"][0]["children"][0]["method"], "POST");
        assert_eq!(tree[0]["children"][1]["name"], "Health");
    }

    #[test]
    fn nombres_repetidos_reciben_sufijo() {
        let w = ws();
        let c = w.create_folder("", "C").unwrap();
        let a = w.create_request(&c, "Req", &json!({})).unwrap();
        let b = w.create_request(&c, "Req", &json!({})).unwrap();
        assert_eq!((a.as_str(), b.as_str()), ("C/Req.json", "C/Req (2).json"));
        assert_eq!(w.read_request(&b).unwrap()["name"], "Req (2)");
    }

    #[test]
    fn renombra_mueve_y_borra() {
        let w = ws();
        let a = w.create_folder("", "A").unwrap();
        let b = w.create_folder("", "B").unwrap();
        let r = w.create_request(&a, "Uno", &json!({"method": "PUT"})).unwrap();
        let r = w.rename(&r, "Dos").unwrap();
        assert_eq!(w.read_request(&r).unwrap()["name"], "Dos");
        let r = w.move_node(&r, &b).unwrap();
        assert_eq!(r, "B/Dos.json");
        assert!(w.move_node(&b, &format!("{b}/sub")).is_err());
        w.delete(&b).unwrap();
        assert!(w.read_request(&r).is_err());
    }

    #[test]
    fn rechaza_rutas_fuera_del_workspace() {
        let w = ws();
        assert!(w.read_request("../../etc/passwd").is_err());
        assert!(w.delete("/tmp").is_err());
        assert_eq!(sanitize("a/b:c"), "a-b-c");
        assert_eq!(sanitize("  .. "), "Sin nombre");
        // nombres reservados de Windows
        assert_eq!(sanitize("CON"), "CON_");
        assert_eq!(sanitize("com1"), "com1_");
        assert_eq!(sanitize("nul.txt"), "nul.txt_");
        assert_eq!(sanitize("COM10"), "COM10");
        assert_eq!(sanitize("Console"), "Console");
    }

    #[test]
    fn entorno_renombrado_no_deja_archivo_viejo() {
        let w = ws();
        w.write_environment(&json!({"id": "1", "name": "Dev", "variables": []})).unwrap();
        w.write_environment(&json!({"id": "1", "name": "Staging", "variables": []})).unwrap();
        let list = w.list_environments().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0]["name"], "Staging");
        w.delete_environment("1").unwrap();
        assert!(w.list_environments().unwrap().is_empty());
    }
}
