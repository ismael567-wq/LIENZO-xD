# Verificación del proyecto

> Resultados de las comprobaciones ejecutadas durante el desarrollo. Fecha: noviembre de 2026.

## 1. Entorno

```text
Windows 11 (10.0.26300)
Node.js v26.13.0
npm 11.20.0
Microsoft Edge (Chromium) headless para pruebas de navegador
Electron 45.2.1 / Chromium 142
```

## 2. Typecheck y pruebas unitarias

```bash
npm run typecheck
npm test
```

Resultado:

```text
> tsc --noEmit
(sin errores)

 ✓ tests/geometry.test.ts (7 tests)
 ✓ tests/storage.test.ts (3 tests)
 ✓ tests/templates.test.ts (4 tests)

 Test Files  3 passed (3)
      Tests  14 passed (14)
```

Cobertura funcional de las pruebas:

- conversión pantalla ↔ mundo y `fitViewport`;
- aristas de conectores y anclaje a objetos;
- hit testing de formas, conectores y marcos;
- handles y redimensionado;
- bounds y orden de marcos;
- generación de las 9 plantillas y unicidad de IDs;
- referencias válidas de conectores;
- duplicación con remapeo de IDs de conectores;
- serialización, exportación e importación de tableros.

## 3. Build

```bash
npm run build
```

Resultado:

```text
✓ built in ~500 ms
PWA v2.0.0 · generateSW
precache 25 entries (~740 KiB)
dist/sw.js
```

Artefactos principales:

```text
dist/index.html
dist/assets/index-*.js        ~400 kB (124 kB gzip)
dist/assets/index-*.css       ~53 kB (11 kB gzip)
dist/sw.js
dist/manifest.webmanifest
dist/pwa-192.png
dist/pwa-512.png
```

## 4. Prueba end-to-end (navegador real)

Script: `scripts/e2e.mjs` (Playwright + Edge headless). La salida cruda de la última ejecución está en [`e2e-output.txt`](e2e-output.txt).

Cubre:

- carga del dashboard y apertura del tablero de bienvenida;
- creación de una nota y escritura;
- deshacer dos veces y rehacer dos veces;
- creación de una forma;
- creación de un comentario;
- entrada y salida de presentación;
- apertura de Compartir y generación de QR;
- exportación PNG (descarga real);
- registro del service worker y manifest PWA;
- apertura del enlace de sala en un contexto móvil (390×844, touch);
- adición de una nota desde móvil;
- recepción de esa nota en el escritorio en tiempo real;
- presencia de 2 personas;
- comprobación del tablero autoritativo en el servidor.

Resultado:

```text
✓ tablero inicial 21 elementos
✓ nota creada y guardada
✓ deshacer
✓ rehacer
✓ forma creada
✓ comentario creado
✓ presentación
✓ enlace de sala http://192.168.1.7:8787/#/b/...
✓ PNG exportado bienvenido-a-lienzo.png 464040 bytes
✓ PWA { registration: true, manifest: '/manifest.webmanifest' }
✓ móvil abrió el tablero compartido
✓ tiempo real entre escritorio y móvil 2 personas en la sala
✓ servidor de sala con ambos cambios
ERRORS none
E2E OK
```

## 5. Escritorio (Electron)

### Desarrollo

```bash
npm run desktop
```

- Electron arranca con `scripts/desktop.mjs` (elimina `ELECTRON_RUN_AS_NODE`).
- El servidor integrado detecta que 8787 está ocupado y usa **8788**.
- La ventana carga `http://127.0.0.1:8788`.
- `window.lienzoDesktop`:

```json
{
  "isDesktop": true,
  "serverUrl": "http://127.0.0.1:8788",
  "lanUrl": "http://192.168.1.7:8788",
  "platform": "win32"
}
```

- Captura: [`screenshots/desktop-dashboard.png`](screenshots/desktop-dashboard.png), [`screenshots/desktop-board.png`](screenshots/desktop-board.png).

### Empaquetado alpha

```bash
npm run desktop:installer   # NSIS
npm run desktop:portable    # portable
npm run desktop:dist        # zip
```

Resultado:

```text
release/Lienzo-Setup-0.1.0-alpha.1.exe          121.726.362 bytes
release/Lienzo-0.1.0-alpha.1-portable.exe       110.761.893 bytes
release/win-unpacked/Lienzo.exe                 (probado)
```

Prueba del `.exe` empaquetado:

- El ejecutable interno `win-unpacked/Lienzo.exe` arranca y carga la app desde el `app.asar`.
- Carga `http://127.0.0.1:8788/#/` y sirve los assets.
- `preload` expone correctamente `window.lienzoDesktop`.
- Captura: [`screenshots/desktop-packaged.png`](screenshots/desktop-packaged.png).

> **Nota de verificación:** el instalador NSIS y el portable se generaron correctamente. La ejecución **silenciosa automatizada** del instalador en esta sesión quedó esperando la confirmación de Windows/UAC; debe probarse con doble clic y aceptar el aviso de SmartScreen, como cualquier ejecutable alpha sin firma. El interior empaquetado (`win-unpacked/Lienzo.exe`) sí está verificado.

## 6. Móvil

### PWA

- Manifest válido en `/manifest.webmanifest`.
- Service worker registrado (`navigator.serviceWorker.getRegistration()` → truthy).
- Instalable desde el navegador (Chrome/Edge; en iOS se añade a la pantalla de inicio).
- Breakpoint móvil probado a 390×844 con `hasTouch: true`.
- Capturas: [`screenshots/dashboard-mobile.png`](screenshots/dashboard-mobile.png), [`screenshots/board-mobile.png`](screenshots/board-mobile.png), [`screenshots/board-mobile-tools.png`](screenshots/board-mobile-tools.png).

### Capacitor

```bash
npx cap sync
```

Resultado:

```text
✓ Copying web assets from dist to android/app/src/main/assets/public
✓ Copying web assets from dist to ios/App/App/public
✓ Sync finished
```

Los proyectos `android/` e `ios/` están generados y sincronizados con el build actual.

**No se compiló APK/IPA** en este entorno porque no hay JDK, Android SDK ni Xcode instalados. La app móvil se validó como PWA en un viewport real y la sala LAN se probó desde un contexto móvil. Para compilar:

```bash
cd android
gradlew.bat assembleDebug      # Windows
# ./gradlew assembleDebug      # macOS/Linux
```

## 7. Sala LAN

- Servidor Node en 8787; Electron en 8788 cuando 8787 está ocupado.
- `/api/health` y `/api/info` responden con IPs LAN.
- QR generado a partir de `http://192.168.1.7:8787/#/b/<id>`.
- Un segundo cliente (móvil) abre el enlace, descarga el tablero desde `/api/boards/<id>` y se une por WebSocket.
- Ambas notas aparecen en el servidor y en el otro cliente.
- Presencia verificada: “2 personas en la sala”.
- Captura: [`screenshots/collaboration.png`](screenshots/collaboration.png).

## 8. REA

Ver [`REA-INSTALACION.md`](REA-INSTALACION.md).

```text
Repo: morluto/rea
Commit: aa48d49
Versión: 6.8.0
npm ci: 729 paquetes
Compilación: OK
CLI: OK
```

## 9. Capturas incluidas

| Archivo | Contenido |
|---|---|
| `dashboard.png` | Dashboard de escritorio con hero y tarjetas. |
| `dashboard-mobile.png` | Dashboard responsive. |
| `board.png` | Tablero de bienvenida con inspector. |
| `board-edit.png` | Tablero con nota creada. |
| `share.png` | Diálogo de compartir con QR y enlace LAN. |
| `templates.png` | Galería de plantillas. |
| `presentation.png` | Modo presentación con recorte del marco. |
| `board-mobile.png` | Tablero en móvil tras colaborar. |
| `board-mobile-tools.png` | Dock móvil expandido. |
| `collaboration.png` | Dos clientes y presencia en vivo. |
| `desktop-dashboard.png` | Ventana Electron en desarrollo. |
| `desktop-board.png` | Tablero en Electron. |
| `desktop-packaged.png` | `.exe` empaquetado. |
| `offline.png` | Dashboard servido por el service worker sin red. |

## 10. Limitaciones de la verificación

- No se probó la app en un dispositivo Android/iOS físico; se probó la PWA en un contexto móvil de Chromium y se generaron los proyectos Capacitor.
- Se verificó la **recarga offline del dashboard** con el service worker y el contexto de red desactivado (`OFFLINE DASHBOARD OK`); no se probó offline en un dispositivo físico ni la reinstalación desde cero.
- La colaboración se probó en la misma máquina con dos contextos de navegador; el servidor usa la IP LAN real, pero no se probaron dos dispositivos físicos.
- El instalador NSIS `portable` no se generó; el zip sí.
- Las pruebas E2E requieren un navegador Chromium y el servidor local en marcha; no están integradas en CI.
