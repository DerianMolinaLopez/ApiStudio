# API Studio

Cliente HTTP de escritorio, rápido y local. Sin cuentas, sin nube, sin telemetría.

- **Motor HTTP en Rust** (reqwest + rustls): pool de conexiones, gzip/brotli, cookies, cancelación.
- **UI en Svelte 5** con tema *Graphite & Electric Violet* (Dark / Light / System) y 7 colores de acento.
- **Todo en archivos JSON legibles**, pensados para Git.

## Funciones

| Área | Incluye |
| --- | --- |
| Solicitudes | GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS; Params y Headers editables; Body JSON / form-data / x-www-form-urlencoded / raw; Auth Basic, Bearer y API Key |
| Respuesta | Estado con color, tiempo, tamaño; Body Pretty/Raw/Preview; Headers; Cookies; Tests |
| Organización | Pestañas múltiples, colecciones y carpetas (arrastrar para mover), historial, entornos con `{{variables}}` |
| Importar/exportar | cURL, colecciones y entornos de Postman v2.x; exportar a Postman; copiar como cURL |
| Scripts | Pre-request, post-response y tests en JavaScript, aislados en un Web Worker |

Atajos: `Ctrl+Enter` enviar · `Ctrl+S` guardar · `Ctrl+T` nueva pestaña · `Ctrl+W` cerrar pestaña.

## Dónde se guardan los datos

```
~/Documentos/API Studio/
  collections/<colección>/<carpeta>/<solicitud>.json
  environments/<entorno>.json
```

Puedes hacer `git init` en esa carpeta y versionarla. El historial vive aparte (datos de la app) y no se versiona.
Los entornos pueden contener secretos: revísalos antes de subirlos a un repositorio.

## Desarrollo

Requisitos: Node 20+, Rust estable y las dependencias de Tauri 2 (en Linux: `webkit2gtk-4.1`, `libsoup-3.0`).

```bash
npm install
npm run tauri dev      # app completa
npm test               # tests del frontend (vitest)
cargo test --manifest-path src-tauri/Cargo.toml
npm run check          # svelte-check
npm run tauri build    # empaquetado (deb, AppImage, msi, nsis)
```

### Estructura

```
src/                     Frontend (Svelte 5 + TS)
  styles/tokens.css      Tokens de diseño: nunca usar colores sueltos en componentes
  lib/                   Lógica pura (request, importers, scripting), stores y puente Tauri
  features/              request, response, sidebar, settings, import, welcome
  ui/                    Componentes base (Modal, Select, Menu, CodeEditor…)
src-tauri/src/           Backend (Rust)
  commands/              #[tauri::command] finos
  services/              http_engine, workspace, history (testeables sin Tauri)
  models/ · error.rs     Tipos serde compartidos y AppError
```

## Flujo de ramas

`master` (producción) · `develop` (integración) · `release/*` · `feature/*` · `task/*`.

## Roadmap

GraphQL, WebSocket, gRPC y SSE · OAuth 2.0 · mock servers · Collection Runner · proxy · respuestas binarias/imágenes · selector de workspace.
