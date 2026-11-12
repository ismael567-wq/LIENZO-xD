# Verificación del proyecto

> Resultados de las comprobaciones ejecutadas durante la iteración `2.0.0`. Fecha: noviembre de 2026.

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
✓ 2143 modules transformed
dist/assets/index-*.css    115.16 kB │ gzip:  23.18 kB
dist/assets/index-*.js     644.00 kB │ gzip: 196.99 kB
PWA v2.0.0 · generateSW
precache 33 entries (1483.11 KiB)
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

## 7. Funciones v1.4

Comprobadas en la app y en ejecución local:

| Función | Prueba |
|---|---|
| Objetos ricos | Insertar tabla desde el menú Insertar → editor de celdas e inspector de tabla |
| Portales | Paleta `Ctrl+K` muestra el grupo **Portales** con marcos del tablero |
| Búsqueda difusa | Consulta «bienv» devuelve notas de bienvenida en `Ctrl+F` |
| Aula | Botones Páginas, Capas, Mapa, Velo, Regla, Rejilla, Proyector, Estudio y Reacción presentes |
| Inspector nuevo | Panel de portal, votos, tabla, flashcard, código, Markdown y sticker |
| Exportación | Menú Exportar con Markdown estructurado, Excalidraw, JAM y Mermaid |
| Piezas | Guardar selección, insertar pieza y aplanar selección desde el menú Más |
| Comentarios de voz | Grabadora accesible desde el compositor de comentarios |
| Verificación automática | `typecheck`, 33 pruebas, 48/48 contraste y build correctos |

QA de navegador realizada sobre `http://127.0.0.1:5173` con el tablero de bienvenida, sin errores de consola.


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

La app de escritorio sigue usando el mismo build web y el servidor embebido. En esta iteración se verificó el build de producción y la app web servida en `8787`; **no se regeneraron los instaladores 2.0.0** en esta sesión.

Para generarlos:

```bash
npm run desktop:installer   # release/tiza-Setup-2.0.0.exe
npm run desktop:portable    # release/tiza-2.0.0-portable.exe
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
- Las funciones v2.0 dependientes de permisos (captura de pantalla, webcam y dictado) se revisaron en el navegador, pero no se probaron en todos los sistemas operativos.
- La traducción completa de la interfaz y el Make Real con visión artificial quedan fuera de esta entrega; el alcance está en [`TIZA-V2.md`](TIZA-V2.md).

## 12. Funciones v2.0

Comprobadas en `http://127.0.0.1:5173` sobre un tablero de QA, sin errores de consola:

| Función | Prueba |
|---|---|
| Laboratorio | El dock abre el panel con 33 herramientas agrupadas y el botón **Lab** |
| Office | CSV → 2 objetos (título y tabla); DOCX → 2 objetos (marco y texto); PPTX de 2 diapositivas → 4 objetos |
| Plugins | Instalar el ejemplo `retro-kit`, listar y **insertar** en el lienzo con toast de confirmación |
| i18n | Cambio ES/EN del laboratorio y cabecera; catálogo comunitario de 2 claves instalado y re-render forzado |
| Votación QR | Tres opciones crean marcos y notas votables; QR PNG generado y resultados a 0 votos |
| Modo examen | 4 hojas creadas, presentación activa y pizarra bloqueada al salir; desbloqueo y deshacer correctos |
| Doc ↔ pizarra | Prellenado Markdown desde el tablero, edición y **Aplicar al lienzo** |
| Replay | 2 fotogramas grabados, filtro por autor y exportación **WebM** de 7.585 bytes |
| Apariencia | Textura papel activa y ambience de sala; comparador con 2 lienzos |
| Accesibilidad | Cursor magnético activa `a11y-magnetic` y muestra el anillo; modo de texto grande disponible |
| MCP | `initialize`, `tools/list`, `tiza_add_sticky` y `tiza_board_text` responden por stdio |
| Endpoint ops | `POST /api/boards/qaboard123/ops` persiste la nota y `GET` la devuelve |

No se completó una prueba visual de las migas de pan de sub-tableros ni de los permisos individuales de examen; el código compila y las rutas derivadas están cubiertas por tipos.
