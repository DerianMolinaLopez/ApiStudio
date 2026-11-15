# Seguridad

## Qué guarda ApiStudio y dónde

ApiStudio es 100 % local: no tiene cuentas, no usa la nube y no envía telemetría. Lo único que sale de tu equipo son las solicitudes que tú mismo envías.

| Dato | Dónde | Cifrado |
| --- | --- | --- |
| Solicitudes (incluye Basic, Bearer y API Key si los escribes en la pestaña Authorization) | `~/Documentos/API Studio/collections/**.json` | **No**: texto plano |
| Entornos y sus variables (pueden contener tokens y claves) | `~/Documentos/API Studio/environments/*.json` | **No**: texto plano |
| Historial | Directorio de datos de la app (`history.json`) | No, pero **sin credenciales**: se redactan contraseñas, tokens, API keys y cabeceras/parámetros sensibles (`Authorization`, `Cookie`, `token`, `api_key`…) |
| Ajustes (tema, acento, fuente) | `localStorage` de la ventana | No contiene secretos |
| Cookies de las respuestas | Solo en memoria durante la sesión | — |

### Recomendaciones

- La carpeta `~/Documentos/API Studio` está pensada para versionarse con Git. **Antes de subirla a un repositorio, revisa que no contenga contraseñas ni tokens** o usa variables de entorno con valores vacíos y rellénalos solo en local (añade `environments/` a tu `.gitignore` si guardan secretos).
- Los scripts (pre-request, post-response, tests) corren en un Web Worker aislado, sin acceso a red, archivos ni a la API de la aplicación, con un límite de 5 s.
- «Verificar certificados TLS» está activado por defecto; desactívalo solo para servidores de desarrollo.

## Reportar una vulnerabilidad

No abras un issue público. Usa **Security → Report a vulnerability** en
<https://github.com/DerianMolinaLopez/ApiStudio/security/advisories/new> e incluye los pasos para reproducirla. Intento responder en pocos días.
