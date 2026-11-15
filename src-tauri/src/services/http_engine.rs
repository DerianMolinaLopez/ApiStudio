use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use reqwest::{
    cookie::Jar,
    header::{HeaderName, HeaderValue, CONTENT_TYPE, USER_AGENT},
    multipart, redirect, Client, Method,
};
use tokio::task::AbortHandle;

use crate::{
    error::{AppError, AppResult},
    models::http::*,
};

type ClientKey = (bool, bool); // (follow_redirects, verify_tls)

/// Motor HTTP: reutiliza clientes (pool de conexiones) y comparte un cookie jar.
pub struct HttpEngine {
    jar: Mutex<Arc<Jar>>,
    clients: Mutex<HashMap<ClientKey, Client>>,
    inflight: Mutex<HashMap<String, AbortHandle>>,
}

impl Default for HttpEngine {
    fn default() -> Self {
        Self {
            jar: Mutex::new(Arc::new(Jar::default())),
            clients: Mutex::new(HashMap::new()),
            inflight: Mutex::new(HashMap::new()),
        }
    }
}

impl HttpEngine {
    pub fn register(&self, id: String, handle: AbortHandle) {
        self.inflight.lock().unwrap().insert(id, handle);
    }

    pub fn unregister(&self, id: &str) {
        self.inflight.lock().unwrap().remove(id);
    }

    /// Cancela una solicitud en curso. Devuelve `true` si existía.
    pub fn cancel(&self, id: &str) -> bool {
        match self.inflight.lock().unwrap().remove(id) {
            Some(h) => {
                h.abort();
                true
            }
            None => false,
        }
    }

    /// Descarta todas las cookies guardadas.
    pub fn clear_cookies(&self) {
        *self.jar.lock().unwrap() = Arc::new(Jar::default());
        self.clients.lock().unwrap().clear();
    }

    fn client(&self, opts: &RequestOptions) -> AppResult<Client> {
        let key = (opts.follow_redirects, opts.verify_tls);
        let mut cache = self.clients.lock().unwrap();
        if let Some(c) = cache.get(&key) {
            return Ok(c.clone());
        }
        let policy = if opts.follow_redirects {
            redirect::Policy::limited(10)
        } else {
            redirect::Policy::none()
        };
        let client = Client::builder()
            .cookie_provider(self.jar.lock().unwrap().clone())
            .redirect(policy)
            .danger_accept_invalid_certs(!opts.verify_tls)
            .tcp_nodelay(true)
            .pool_idle_timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| AppError::Network(e.to_string()))?;
        cache.insert(key, client.clone());
        Ok(client)
    }

    pub async fn execute(&self, req: HttpRequest) -> AppResult<HttpResponse> {
        let method = Method::from_bytes(req.method.trim().to_uppercase().as_bytes())
            .map_err(|_| AppError::InvalidRequest(format!("Método HTTP inválido: {}", req.method)))?;
        let url = normalize_url(&req.url)?;
        let client = self.client(&req.options)?;

        let mut builder = client.request(method, url);
        let mut has_ua = false;
        let mut has_ct = false;
        for h in &req.headers {
            let key = h.key.trim();
            if key.is_empty() {
                continue;
            }
            let name = HeaderName::from_bytes(key.as_bytes())
                .map_err(|_| AppError::InvalidRequest(format!("Nombre de cabecera inválido: {key}")))?;
            let value = HeaderValue::from_str(h.value.trim())
                .map_err(|_| AppError::InvalidRequest(format!("Valor inválido en la cabecera {key}")))?;
            has_ua |= name == USER_AGENT;
            has_ct |= name == CONTENT_TYPE;
            builder = builder.header(name, value);
        }
        if !has_ua {
            builder = builder.header(USER_AGENT, concat!("ApiStudio/", env!("CARGO_PKG_VERSION")));
        }

        builder = match req.body {
            RequestBody::None => builder,
            RequestBody::Raw { content, content_type } => {
                if let (false, Some(ct)) = (has_ct, content_type.filter(|c| !c.is_empty())) {
                    builder = builder.header(CONTENT_TYPE, ct);
                }
                builder.body(content)
            }
            RequestBody::Form { fields } => {
                let pairs: Vec<(String, String)> = fields.into_iter().map(|f| (f.key, f.value)).collect();
                builder.form(&pairs)
            }
            RequestBody::Multipart { fields } => builder.multipart(build_multipart(fields).await?),
        };

        if let Some(ms) = req.options.timeout_ms.filter(|m| *m > 0) {
            builder = builder.timeout(Duration::from_millis(ms));
        }

        let started = Instant::now();
        let resp = builder.send().await.map_err(map_err)?;
        let ttfb = started.elapsed();

        let status = resp.status();
        let http_version = format!("{:?}", resp.version());
        let final_url = resp.url().to_string();
        let headers: Vec<Header> = resp
            .headers()
            .iter()
            .map(|(k, v)| Header { key: k.to_string(), value: String::from_utf8_lossy(v.as_bytes()).into_owned() })
            .collect();
        let cookies = headers
            .iter()
            .filter(|h| h.key.eq_ignore_ascii_case("set-cookie"))
            .filter_map(|h| parse_cookie(&h.value))
            .collect();

        let bytes = resp.bytes().await.map_err(map_err)?;
        let time_ms = started.elapsed().as_millis() as u64;
        let (body, is_binary) = match std::str::from_utf8(&bytes) {
            Ok(s) => (s.to_owned(), false),
            Err(_) => (String::new(), true),
        };

        Ok(HttpResponse {
            status: status.as_u16(),
            status_text: status.canonical_reason().unwrap_or("").to_owned(),
            http_version,
            url: final_url,
            headers,
            cookies,
            body,
            is_binary,
            size_bytes: bytes.len() as u64,
            time_ms,
            ttfb_ms: ttfb.as_millis() as u64,
        })
    }
}

fn normalize_url(raw: &str) -> AppResult<url::Url> {
    let raw = raw.trim();
    if raw.is_empty() {
        return Err(AppError::InvalidRequest("La URL está vacía".into()));
    }
    let with_scheme = if raw.contains("://") { raw.to_owned() } else { format!("http://{raw}") };
    url::Url::parse(&with_scheme).map_err(|e| AppError::InvalidRequest(format!("URL inválida: {e}")))
}

async fn build_multipart(fields: Vec<FormPart>) -> AppResult<multipart::Form> {
    let mut form = multipart::Form::new();
    for f in fields {
        form = match f.kind {
            PartKind::Text => form.text(f.key, f.value),
            PartKind::File => {
                let data = tokio::fs::read(&f.value)
                    .await
                    .map_err(|e| AppError::Io(format!("No se pudo leer {}: {e}", f.value)))?;
                let name = std::path::Path::new(&f.value)
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_else(|| "file".into());
                form.part(f.key, multipart::Part::bytes(data).file_name(name))
            }
        };
    }
    Ok(form)
}

fn parse_cookie(raw: &str) -> Option<ResponseCookie> {
    let c = cookie::Cookie::parse(raw.to_owned()).ok()?;
    Some(ResponseCookie {
        name: c.name().to_owned(),
        value: c.value().to_owned(),
        domain: c.domain().map(str::to_owned),
        path: c.path().map(str::to_owned),
        expires: c.expires_datetime().map(|d| d.to_string()),
        secure: c.secure().unwrap_or(false),
        http_only: c.http_only().unwrap_or(false),
        same_site: c.same_site().map(|s| s.to_string()),
    })
}

fn map_err(e: reqwest::Error) -> AppError {
    if e.is_timeout() {
        return AppError::Timeout;
    }
    // La cadena completa de causas suele tener el motivo real (DNS, TLS, conexión rechazada…).
    let mut msg = e.to_string();
    let mut src = std::error::Error::source(&e);
    while let Some(s) = src {
        msg.push_str(": ");
        msg.push_str(&s.to_string());
        src = s.source();
    }
    AppError::Network(msg)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
    };

    /// Servidor mínimo que responde una vez con `response` y devuelve lo recibido.
    async fn mock(response: &'static str) -> (String, tokio::task::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let h = tokio::spawn(async move {
            let (mut sock, _) = listener.accept().await.unwrap();
            let mut buf = vec![0u8; 8192];
            let n = sock.read(&mut buf).await.unwrap();
            sock.write_all(response.as_bytes()).await.unwrap();
            String::from_utf8_lossy(&buf[..n]).into_owned()
        });
        (format!("http://{addr}/ping"), h)
    }

    fn req(method: &str, url: String, body: RequestBody) -> HttpRequest {
        HttpRequest {
            id: "t".into(),
            method: method.into(),
            url,
            headers: vec![Header { key: "X-Test".into(), value: "1".into() }],
            body,
            options: RequestOptions::default(),
        }
    }

    #[tokio::test]
    async fn get_devuelve_estado_cuerpo_y_cookies() {
        let (url, server) = mock(
            "HTTP/1.1 201 Created\r\nContent-Type: application/json\r\nSet-Cookie: sid=abc; Path=/; HttpOnly\r\nContent-Length: 11\r\nConnection: close\r\n\r\n{\"ok\":true}\n",
        )
        .await;
        let res = HttpEngine::default().execute(req("GET", url, RequestBody::None)).await.unwrap();
        assert_eq!(res.status, 201);
        assert_eq!(res.body.trim(), "{\"ok\":true}");
        assert_eq!(res.size_bytes, 11);
        assert_eq!(res.cookies[0].name, "sid");
        assert!(res.cookies[0].http_only);
        let seen = server.await.unwrap();
        assert!(seen.starts_with("GET /ping"));
        assert!(seen.to_lowercase().contains("x-test: 1"));
    }

    #[tokio::test]
    async fn post_raw_envia_cuerpo_y_content_type() {
        let (url, server) = mock("HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n").await;
        let body = RequestBody::Raw { content: "{\"a\":1}".into(), content_type: Some("application/json".into()) };
        let res = HttpEngine::default().execute(req("POST", url, body)).await.unwrap();
        assert_eq!(res.status, 204);
        let seen = server.await.unwrap();
        assert!(seen.to_lowercase().contains("content-type: application/json"));
        assert!(seen.ends_with("{\"a\":1}"));
    }

    #[tokio::test]
    async fn rechaza_metodo_y_url_invalidos() {
        let e = HttpEngine::default();
        assert!(matches!(e.execute(req("GE T", "http://x".into(), RequestBody::None)).await, Err(AppError::InvalidRequest(_))));
        assert!(matches!(e.execute(req("GET", "  ".into(), RequestBody::None)).await, Err(AppError::InvalidRequest(_))));
    }

    #[tokio::test]
    async fn conexion_rechazada_es_error_de_red() {
        let r = HttpEngine::default().execute(req("GET", "http://127.0.0.1:1".into(), RequestBody::None)).await;
        assert!(matches!(r, Err(AppError::Network(_))));
    }
}
