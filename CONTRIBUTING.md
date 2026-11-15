# Contribuir a ApiStudio

¡Gracias por querer ayudar! Cualquier aporte suma: código, documentación, ideas o reportes de errores.

## Antes de empezar

1. Revisa los [issues abiertos](https://github.com/DerianMolinaLopez/ApiStudio/issues) por si ya existe lo que quieres hacer.
2. Para cambios grandes, abre primero un issue para acordar el enfoque.

## Preparar el entorno

Requisitos: Node 20+, Rust estable y las dependencias de Tauri 2
([guía oficial](https://v2.tauri.app/start/prerequisites/)).

```bash
git clone https://github.com/DerianMolinaLopez/ApiStudio.git
cd ApiStudio
npm install
npm run tauri dev
```

## Flujo de ramas

- `main`: versión estable. `develop`: integración.
- Crea tu rama desde `develop`: `feature/<tema>` para funciones, `task/<tema>` para tareas pequeñas, `fix/<tema>` para correcciones.
- Abre el Pull Request hacia `develop`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), un commit por cambio lógico:

```
feat(colecciones): agrega orden manual de carpetas
fix(respuesta): corrige el tamaño mostrado en respuestas con gzip
docs(readme): aclara la ruta del workspace
```

Tipos: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`.

## Antes de abrir el Pull Request

```bash
npm test                                          # tests del frontend
npm run check                                     # tipos Svelte/TS
cargo test --manifest-path src-tauri/Cargo.toml   # tests de Rust
cargo clippy --manifest-path src-tauri/Cargo.toml # sin avisos
```

## Criterios del proyecto

- **Local primero:** sin cuentas, sin nube, sin telemetría. No agregues llamadas de red que no inicie el usuario.
- **Secretos:** nada de credenciales reales en código, tests ni capturas. Mira [SECURITY.md](SECURITY.md).
- **Rust para lo pesado** (red, archivos); el frontend solo presenta.
- **Estilos:** usa los tokens de `src/styles/tokens.css`; no pongas colores sueltos en componentes. Respeta tema claro y oscuro.
- Añade tests a la lógica nueva (`src/lib/*.test.ts`, `#[cfg(test)]` en Rust).

Al contribuir aceptas que tu aporte se publique bajo la licencia [MIT](LICENSE).
