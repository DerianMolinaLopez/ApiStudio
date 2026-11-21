# Importar OpenAPI / Swagger (issue #1)

## Alcance
Importar un archivo **JSON** OpenAPI 3.0 / 3.1 o Swagger 2.0 como colección + entorno. YAML queda para una iteración posterior.

## Diseño
`src/lib/importers/openapi.ts` (lógica pura, sin DOM ni Tauri) expone:

- `isOpenApi(json)`: detecta por la clave `openapi` o `swagger` y la presencia de `paths`.
- `importOpenApi(json)` → `{ collection, environment, warnings, endpoints }`.

| OpenAPI | ApiStudio |
| --- | --- |
| `tags[0]` de la operación | carpeta (sin tag: raíz de la colección) |
| `summary` / `operationId` / `MÉTODO ruta` | nombre de la solicitud |
| `servers[0]` (o `host`+`basePath`) | variable `{{baseUrl}}` del entorno |
| `/users/{id}` | `{{baseUrl}}/users/{{id}}` y variable `id` en el entorno |
| parámetros `query` | tabla de Params (deshabilitados si no son `required`) |
| parámetros `header` | Headers (se ignoran `Accept`, `Content-Type`, `Authorization`, como indica la spec) |
| `requestBody` / `in: body` | Body JSON con ejemplo generado desde el esquema |
| `x-www-form-urlencoded` / `multipart` / `formData` | Body urlencoded / form-data (`format: binary` → archivo) |
| `security` (operación o global) | Auth Bearer, Basic o API Key con variables `{{token}}`, `{{apiKey}}`… |

Los ejemplos se toman de `example` / `examples` / `default` / `enum[0]`; si no hay, se sintetizan por tipo y `format`.

## Seguridad (el archivo no es de confianza)
- Solo `$ref` locales (`#/…`); los externos se ignoran con una advertencia.
- Profundidad máxima y detección de ciclos al resolver y generar ejemplos.
- Los objetos se construyen con `Object.fromEntries`, así una propiedad llamada `__proto__` no contamina el prototipo.
- Nada se ejecuta ni se descarga: solo se lee JSON.

## Casos de Swashbuckle (ASP.NET)
Sin `servers` → `baseUrl` por defecto `http://localhost` con aviso; varios content-types JSON → se usa uno; `Bearer` declarado como `apiKey` en `Authorization` → Auth API Key con esa cabecera.

## Fuera de alcance
YAML, `$ref` externos, callbacks/webhooks, exportar a OpenAPI.
