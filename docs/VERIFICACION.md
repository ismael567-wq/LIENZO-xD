# Verificación del proyecto

> Resultados de las comprobaciones ejecutadas durante la iteración `1.3.0`. Fecha: noviembre de 2026.

## 1. Entorno

```text
Windows 11 (10.0.26300)
Node.js v26.13.0
npm 11.20.0
Microsoft Edge (Chromium) headless para QA visual y E2E
Python 3 + Pillow para iconos y auditoría de contraste
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

 Test Files  6 passed (6)
      Tests  33 passed (33)
```

Cobertura funcional:

- conversión pantalla ↔ mundo y `fitViewport`;
- aristas de conectores y anclaje a objetos;
- hit testing de formas, conectores y marcos;
- handles y redimensionado;
- bounds y orden de marcos;
- generación de las 9 plantillas y unicidad de IDs;
- referencias válidas de conectores;
- duplicación con remapeo de IDs de conectores;
- serialización, exportación e importación de tableros;
- exportación e importación de espacios `.tiza`;
- escritor PDF con xref y fin de archivo correctos;
- exportación SVG que omite elementos ocultos;
- legibilidad de tintas en tema oscuro.

## 3. Contraste y accesibilidad

```bash
npm run contraste
```

Resultado:

```text
tiza · auditoría de contraste WCAG AA (48 pares)
...
48/48 pares cumplen AA · todo en orden
```

Comprobaciones adicionales:

- objetivos táctiles de 44 px con `pointer: coarse`;
- foco visible en todos los controles;
- etiquetas ARIA en búsqueda, historial, temporizador y bloqueo;
- `aria-live` en el tiempo del temporizador;
- `prefers-reduced-motion` respetado;
- el canvas no permite navegación individual por lector de pantalla; sigue siendo un límite conocido.

## 4. Build

```bash
npm run build
```

Resultado:

```text
✓ 2124 modules transformed
dist/assets/index-*.css     88.98 kB │ gzip: 18.87 kB
dist/assets/index-*.js     491.10 kB │ gzip: 150.48 kB
PWA v2.0.0 · generateSW
precache 31 entries (985.46 KiB)
dist/sw.js
dist/manifest.webmanifest
```

El build incluye las fuentes variables locales de Space Grotesk, Inter y JetBrains Mono, por lo que la app sigue funcionando offline.

## 5. QA visual en navegador real

Script de capturas con Playwright + Edge headless. Vistas comprobadas:

- dashboard noche 1440×900;
- dashboard día 1440×900;
- pizarra noche y día 1440×900;
- dashboard móvil 390×844;
- pizarra móvil 390×844;
- plantillas, presentación y compartir.

Resultado:

- sin errores de consola ni `pageerror`;
- sin desbordamiento horizontal en la pizarra móvil;
- barra superior móvil sin recortes, con título legible;
- contenido inicial de la pizarra ajustado al ancho real del móvil;
- controles táctiles principales de 44 px;
- menú «Más» con 13 acciones de 44 px, sin recorte a 390×844;
- capturas actualizadas en [`screenshots/`](screenshots/).

Capturas principales:

- [`dashboard.png`](screenshots/dashboard.png)
- [`dashboard-day.png`](screenshots/dashboard-day.png)
- [`board.png`](screenshots/board.png)
- [`board-day.png`](screenshots/board-day.png)
- [`dashboard-mobile.png`](screenshots/dashboard-mobile.png)
- [`board-mobile.png`](screenshots/board-mobile.png)
- [`templates.png`](screenshots/templates.png)
- [`share.png`](screenshots/share.png)
- [`presentation.png`](screenshots/presentation.png)

## 6. Funciones v1.3

Comprobadas en la app:

| Función | Prueba |
|---|---|
| Búsqueda | `Ctrl+F`, consulta «Bien», resultado «Bienvenido a tiza» y salto al elemento |
| Historial | Instantánea automática visible, guardado manual y restauración |
| Temporizador | Apertura desde la paleta, preset de 15 min, pausa y reinicio |
| Bloqueo | Solo lectura, aviso superior y desbloqueo |
| Tema | `auto`, día y noche; persistencia en `tiza:theme-mode` |
| Archivos | Arrastrar CSV, PDF y TXT → tarjetas; descarga OPFS byte a byte idéntica |
| Conectores | Creación, anclas laterales, etiqueta y terminal `crowfoot-many` |
| Marcos | Textura pentagrama aplicada y conservada al exportar |
| Exportación | PDF de 3 páginas con `%PDF-1.4`/EOF, SVG y copia `.tiza` |
| Espacio `.tiza` | Exportación de 3 tableros e importación con recuento correcto |
| Carpetas | Crear, mover tablero, filtrar, renombrar y eliminar sin borrar tableros |
| Papelera | Mover, restaurar y eliminar definitivamente |

## 7. Prueba end-to-end

Script: `scripts/e2e.mjs` (Playwright + Edge headless) contra el build servido en `127.0.0.1:8787`.

Cubre:

- carga del dashboard y apertura de la pizarra de bienvenida;
- creación de una nota y escritura;
- deshacer dos veces y rehacer dos veces;
- creación de una forma;
- creación de un comentario;
- entrada y salida de presentación;
- apertura de Compartir y generación de QR;
- exportación PNG real;
- registro del service worker y manifest PWA;
- apertura del enlace de sala en un contexto móvil (390×844, touch);
- adición de una nota desde móvil;
- recepción de esa nota en el escritorio en tiempo real;
- presencia de 2 personas;
- comprobación de la pizarra autoritativa en el servidor.

Resultado de la última ejecución:

```text
✓ tablero inicial 21 elementos
✓ nota creada y guardada
✓ deshacer
✓ rehacer
✓ forma creada
✓ comentario creado
✓ presentación
✓ enlace de sala http://192.168.1.7:8787/#/b/...
✓ PNG exportado bienvenido-a-tiza.png 455411 bytes
✓ PWA { registration: true, manifest: '/manifest.webmanifest' }
✓ móvil abrió el tablero compartido
✓ tiempo real entre escritorio y móvil 2 personas en la sala
✓ servidor de sala con ambos cambios
ERRORS none
E2E OK
```

## 8. Iconos y PWA

```bash
python scripts/make-icons.py
python scripts/make-electron-icon.py
```

Se regeneraron a partir de la sonrisa de tiza:

- `public/pwa-192.png`
- `public/pwa-512.png`
- `public/apple-touch-icon.png`
- `public/favicon-64.png`
- `public/icon.png`
- `build/icon.png` e `build/icon.ico`

El manifest usa `#1E1C19` como color de tema y de fondo.

## 9. Escritorio (Electron)

La app de escritorio sigue usando el mismo build web y el servidor embebido. En esta iteración se verificó el build de producción y la app web servida en `8787`; **no se regeneraron los instaladores 1.3.0** en esta sesión.

Para generarlos:

```bash
npm run desktop:installer   # release/tiza-Setup-1.3.0.exe
npm run desktop:portable    # release/tiza-1.3.0-portable.exe
```

Los instaladores no están firmados; SmartScreen puede pedir confirmación. Los datos de versiones anteriores se conservan porque las claves internas (`lienzo:*`) no cambian.

## 10. Móvil

- PWA probada a 390×844 con `hasTouch: true`.
- Manifest y service worker válidos.
- Cámara inicial ajustada al ancho del lienzo.
- Barra superior compacta: inicio, título, compartir y menú.
- Tema y concentración accesibles desde el menú «Más».
- Proyectos Capacitor presentes; APK/IPA no compilados por falta de toolchain nativo.

## 11. Límites de esta verificación

- No se ejecutó una prueba física en Android/iOS; se usó emulación de viewport y touch.
- No se regeneraron los artefactos NSIS/portable de escritorio.
- No se hizo auditoría completa con lector de pantalla sobre el canvas.
- La asociación de archivos `.tiza` con el sistema operativo no está registrada; la importación funciona desde el menú y el selector de archivos.
- Las 77 ideas restantes de los informes (v1.4, v2.0 y v2.0+) no están implementadas ni verificadas; el alcance está en [`TIZA-V2.md`](TIZA-V2.md).
