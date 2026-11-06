# REA: instalación y verificación

## 1. Qué es REA

**REA (Reverse Engineer Anything)** es una herramienta de ingeniería inversa local que conecta agentes y terminales con motores de análisis de binarios, aplicaciones JavaScript/Electron, ensamblados .NET, APKs, firmware, páginas web, capturas de red y artefactos. Se distribuye como servidor MCP + CLI y está pensada para trabajar sobre **software que posees o estás autorizado a analizar**.

- Repositorio original: <https://github.com/morluto/rea>
- Web oficial: <https://rea.tools/>
- Paquete npm: `rea-agents`
- Licencia: MIT
- Versión instalada: **6.8.0**

## 2. Instalación realizada

Entorno:

```text
Windows 11 (10.0.26300)
Node.js v26.13.0
npm 11.20.0
Git 2.56.0
```

El repositorio se clonó en `rea/` dentro del workspace del proyecto:

```powershell
git -c http.sslBackend=openssl clone --depth 1 --single-branch `
  https://github.com/morluto/rea.git rea
```

> En este entorno, Git con el backend TLS `schannel` no podía acceder a GitHub; se usó el backend OpenSSL (`http.sslBackend=openssl`) para completar el clon. No es un requisito de REA.

Dependencias y compilación:

```powershell
cd rea
npm ci --ignore-scripts
npm run compile
```

Resultado:

- 729 paquetes instalados.
- `dist/` generado correctamente.
- Compilación TypeScript completada (solo avisos de imports dinámicos inefectivos, sin errores).

## 3. Verificación del CLI

```powershell
node scripts/rea.mjs --version
# 6.8.0

node scripts/rea.mjs --help
```

La ayuda del CLI arranca correctamente y expone, entre otros:

```text
rea <command>

analyze
analyze-javascript-application
analyze-web-bundle
capture-browser-scenario
capture-electron-scenario
decompile
decompile-all
compare-application-versions
inspect-wasm-artifact
...
```

Comprobaciones:

| Elemento | Estado |
|---|---|
| Repositorio original clonado | ✅ `rea/` |
| Dependencias instaladas | ✅ 729 paquetes |
| Runtime compilado | ✅ `rea/dist/` |
| CLI ejecutable | ✅ `rea --version` → 6.8.0 |
| Commit | `aa48d49` (2026-11-01) |
| Licencia | MIT |

## 4. Cómo se usaría para investigar una app como Miro

REA está diseñado para analizar **artefactos locales** o **sesiones de navegador controladas**:

- `analyze-javascript-application` sobre una app Electron o un directorio/ASAR local.
- `analyze-web-bundle` contra un navegador Chromium con CDP, para reconstruir módulos y rutas de una web.
- `capture-browser-scenario` para observar interacciones y capturas.
- `decompile` / `analyze` para binarios nativos (Hopper, Ghidra, IDA o Kuna).
- `inspect-wasm-artifact`, `inspect_apk_signature`, etc.

Miro es un **SaaS cerrado**: su núcleo no está publicado y el análisis de su web pública no equivale a su motor de colaboración. Por eso, el análisis de producto de este proyecto se hizo con fuentes públicas (web, precios, documentación, GitHub y prensa), y REA queda instalado como herramienta de apoyo para analizar artefactos locales propios o capturas de navegador autorizadas.

## 5. Uso responsable

REA incluye un aviso explícito: debe usarse para investigación lawful, educación, interoperabilidad, preservación de software y análisis de software propio o autorizado. Las herramientas comerciales (IDA, Hopper, JEB) requieren licencia propia. No se autoriza el uso de copias crackeadas, claves robadas ni la elusión de restricciones.

Este proyecto no decompiló ni extrajo código propietario de Miro. El análisis es de producto y de ecosistema público.

## 6. Comandos de referencia

```powershell
# Ver la versión
node rea/scripts/rea.mjs --version

# Ver todos los comandos
node rea/scripts/rea.mjs --help

# Ayuda de un comando
node rea/scripts/rea.mjs analyze-javascript-application --help

# Analizar una app local (ejemplo)
node rea/scripts/rea.mjs analyze-javascript-application C:\ruta\a\la\app --json
```

## 7. Nota sobre el repositorio

El repositorio se clonó con `--depth 1` para conservar el código y la documentación sin descargar todo el historial. Los submódulos de terceros no se inicializaron; no son necesarios para ejecutar el CLI principal. La carpeta `rea/` se mantiene separada del proyecto tiza.
