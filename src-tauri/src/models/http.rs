use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Header {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormPart {
    pub key: String,
    pub value: String,
    /// `text` o `file` (en `file`, `value` es la ruta local).
    #[serde(default)]
    pub kind: PartKind,
}

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PartKind {
    #[default]
    Text,
    File,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum RequestBody {
    None,
    Raw { content: String, content_type: Option<String> },
    Form { fields: Vec<Header> },
    Multipart { fields: Vec<FormPart> },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestOptions {
    pub timeout_ms: Option<u64>,
    #[serde(default = "yes")]
    pub follow_redirects: bool,
    #[serde(default = "yes")]
    pub verify_tls: bool,
}

impl Default for RequestOptions {
    fn default() -> Self {
        Self { timeout_ms: None, follow_redirects: true, verify_tls: true }
    }
}

fn yes() -> bool {
    true
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequest {
    /// Identificador de la ejecución; permite cancelarla.
    pub id: String,
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: Vec<Header>,
    pub body: RequestBody,
    #[serde(default)]
    pub options: RequestOptions,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseCookie {
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
    pub path: Option<String>,
    pub expires: Option<String>,
    pub secure: bool,
    pub http_only: bool,
    pub same_site: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub http_version: String,
    pub url: String,
    pub headers: Vec<Header>,
    pub cookies: Vec<ResponseCookie>,
    /// Cuerpo como texto UTF-8 (vacío si es binario).
    pub body: String,
    pub is_binary: bool,
    pub size_bytes: u64,
    /// Tiempo total hasta recibir el cuerpo completo.
    pub time_ms: u64,
    /// Tiempo hasta recibir las cabeceras.
    pub ttfb_ms: u64,
}
