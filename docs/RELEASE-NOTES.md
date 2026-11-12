# tiza 2.0.0

![tiza](https://raw.githubusercontent.com/ismael567-wq/LIENZO-xD/main/docs/screenshots/portada.png)

**tiza — pizarras en vivo.** La pizarra visual local-first para Windows, web y móvil llega a la fase 2.0: datos, aula, replay, accesibilidad y automatizaciones locales. Sin cuentas, sin nube y con tus tableros en tu dispositivo.

## v2.0: laboratorio, aula y replay

- **Laboratorio v2** con 33 herramientas en un solo panel.
- **Datos**: gráficos desde CSV/TSV, conversión local de DOCX/PPTX/CSV, embeds, wireframes y galería de assets.
- **Prototipos**: Kanban vivo, agrupación de notas, filtrado de tablas, clustering, flujos, comparador y Doc ↔ pizarra.
- **Aula**: votación QR, ruleta/dado, modo examen con hojas por alumno y pizarra bloqueada.
- **Replay**: fotogramas, línea de tiempo, mapa de calor, cronología por persona, filtro por autor y exportación JSON o **WebM**.
- **Captura**: pantalla, webcam y documento; dictado al lienzo.
- **IA local**: Sidekick con Ollama o APIs OpenAI-compatible y **Make Real** que genera HTML desde el tablero.
- **Accesibilidad**: modo de texto grande, cursor magnético, foco reforzado y sonido espacial.
- **Apariencia**: texturas de tablero, letra manuscrita e i18n ES/EN con catálogos comunitarios.
- **v2.0+**: servidor **MCP** por stdio, endpoint local de operaciones y plugins JSON declarativos.

## v1.4: objetos ricos y aula en vivo

- **Código, Markdown, tablas, stickers, flashcards y Mermaid** como objetos nativos del lienzo.
- **PDF.js** con anotación sobre páginas, vídeo local o por URL y notas de voz.
- **Aula**: páginas, capas, marcos con layout, velo, proyector, regla, rejilla y reacciones.
- **Sala LAN**: roles editor/visor, chat, seguimiento, votación por puntos y traer a todos.
- **Modo estudio** para repasar flashcards y **mapa mental** con `Tab`.
- **Portales** entre objetos, marcos y tableros.
- **Importadores Excalidraw, JAM y Mermaid**; exportación Markdown y piezas reutilizables.
- **Aplanar selección**, trazos de tiza/resaltador, CSV a tabla y audio en comentarios.

## Novedades de v1.3

- **Nueva identidad tiza**: logo de sonrisa de tiza, iconos, manifest y textos de la app.
- **Rediseño v2**: tema noche como principal, tema día, selector automático, Space Grotesk + Inter + JetBrains Mono y acabado nuevo en dashboard, tablero, menús, modales y móvil.
- **Búsqueda en la pizarra** con `Ctrl/Cmd+F`.
- **Historial de versiones** con instantáneas automáticas, guardado manual y restauración.
- **Temporizador de foco** de 15, 25 o 50 minutos y temporizador de objeto en el lienzo.
- **Bloqueo de pizarra** en solo lectura.
- **Arrastrar o pegar cualquier archivo** con almacenamiento OPFS y tarjetas en el lienzo.
- **Conectores con anclas laterales, trazado ortogonal, etiquetas y terminales**.
- **Texturas de marco**: puntos, cuadrícula, líneas, pentagrama y ejes.
- **Exportación PDF y SVG**, copia al portapapeles y respaldo `.tiza` del espacio.
- **Carpetas y papelera** en el inicio.
- Exportación JSON con extensión `.tiza.json`.
- Barra superior móvil simplificada, cámara ajustada al ancho real y objetivos táctiles de 44 px.

## Accesibilidad

- 48/48 combinaciones de contraste WCAG AA verificadas.
- Foco visible, etiquetas ARIA, reducción de movimiento y controles táctiles de 44 px.
- El canvas sigue sin navegación individual completa por lector de pantalla; es un límite conocido.

## Verificación

- `npm run typecheck` sin errores.
- 33 pruebas unitarias aprobadas.
- `npm run build` correcto (2.143 módulos; PWA con 33 entradas).
- `npm run contraste` → 48/48 AA.
- QA visual y funcional en navegador real a 1440×900 y 390×844.
- MCP y endpoint local de operaciones probados contra un servidor de sala.

## Pendiente

Las familias v1.3 (13/13), v1.4 (42/42) y v2.0 (31/31) están completas. De v2.0+ se entregan MCP, plugins y Make Real; falta la asociación de archivos `.tiza` con el sistema operativo.

Límites honestos de esta entrega:

- La traducción cubre el laboratorio y parte del chrome; el resto sigue en español.
- **Make Real** es una heurística local, no un modelo de visión.
- El modo examen no aplica permisos individuales por alumno.
- El Kanban agrupa de forma puntual, sin arrastre continuo entre columnas.
- Captura y dictado dependen de permisos y APIs del navegador.
- Sin CRDT: la colaboración sigue siendo last-write-wins por objeto.

Detalle completo en [`docs/TIZA-V2.md`](TIZA-V2.md).

## Descargar

Los artefactos se generan desde el código:

```bash
npm install
npm run desktop:installer   # release/tiza-Setup-2.0.0.exe
npm run desktop:portable    # release/tiza-2.0.0-portable.exe
```

El ejecutable no está firmado. Si Windows muestra “Windows protegió tu PC”: **Más información → Ejecutar de todas formas**.

## Actualizar

1. Abre tiza.
2. Pulsa el engranaje **Opciones**.
3. Pulsa **Buscar actualizaciones**.
4. Cuando aparezca la versión nueva, pulsa **Descargar e instalar**.

Tus tableros y preferencias se conservan. Las claves internas `lienzo:*` se mantienen para no invalidar datos de versiones anteriores.

## Límites conocidos

- Sin nube ni cuentas; la IA es opcional (Ollama o API compatible) y no hay permisos enterprise.
- Colaboración **last-write-wins** por objeto; sin CRDT.
- Sala LAN sin autenticación; úsala en redes de confianza.
- Ejecutable sin firma de código.
- APK/IPA no incluidos; los proyectos nativos están en el repositorio.

## Detalles técnicos

- React 19 + TypeScript + Canvas 2D.
- Vite 8, Zustand, IndexedDB, Node.js + WebSocket, Electron, Capacitor.
- Build Windows con Electron Builder (NSIS + portable).
- Código y documentación: <https://github.com/ismael567-wq/LIENZO-xD>

Hecho para pensar en voz alta, sin pedir permiso a la nube.
