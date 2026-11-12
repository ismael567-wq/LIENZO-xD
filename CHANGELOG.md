# Changelog

Todas las versiones relevantes de tiza.

## [2.0.0] – 2026-11-10

Tercera tanda: laboratorio de datos, aula avanzada, replay de sesión, accesibilidad y automatizaciones locales. Se mantienen las claves internas (`useLienzo`, `lienzo:*`) y el modelo de objetos de v1.4.

### Añadido

- **Laboratorio v2**: panel único con 33 herramientas agrupadas en datos, aula, sesión y apariencia.
- **Gráficos desde datos**: CSV/TSV pegados o importados se convierten en barras, línea o tarta dibujadas en el lienzo.
- **Office local**: `.docx` se convierte en marcos con párrafos, `.pptx` en marcos por diapositiva y `.csv/.tsv` en tablas editables, todo con `fflate` y sin subir archivos.
- **Embeds permitidos**: YouTube, Vimeo, Figma, Google Maps, Spotify, Google Docs, Excalidraw, CodePen y SoundCloud como tarjetas nativas.
- **Plugins JSON declarativos**: instalar, listar, insertar y eliminar plantillas de notas, textos, formas, marcos y stickers sin ejecutar código.
- **Wireframes**: kits de navegador, móvil, landing y panel insertados como objetos nativos.
- **Kanban vivo**: columnas y tarjetas, agrupación de notas existentes por estado y filtrado de filas de una tabla.
- **Clustering local**: agrupa notas por similitud de palabras en columnas con marcos.
- **Flujos**: ordena y conecta la selección; **duelo de zonas** para comparar dos áreas.
- **Galería de assets**: stickers y símbolos insertables con un clic.
- **Make Real local**: genera una página HTML autocontenida a partir de wireframes y textos del tablero.
- **Comparador**: dos tableros lado a lado con render real.
- **Doc ↔ pizarra**: editor Markdown bidireccional que vuelve a crear textos nativos.
- **Aula**: votación por QR y resultados en vivo, ruleta y dado, modo examen con una hoja por alumno, bloqueo y presentación.
- **Replay de sesión**: grabación por fotogramas, línea de tiempo, mapa de calor, cronología por persona, filtro por autor, exportación JSON y **vídeo WebM**.
- **Captura**: pantalla, cámara web y cámara de documento; dictado al lienzo con Web Speech.
- **Accesibilidad**: modo de texto grande, cursor magnético suavizado para manos con temblor, foco reforzado y sonido espacial de la sala.
- **Ambiente de sala**: ruido blanco generado con Web Audio.
- **Apariencia**: texturas de tablero (papel, lienzo, pizarra) y letra manuscrita aplicable a textos.
- **i18n ES/EN**: catálogos base, variables tipo ICU y catálogos comunitarios importables/exportables.
- **Sidekick local / IA BYOK**: compatible con Ollama y APIs OpenAI-compatible desde el navegador.
- **MCP**: servidor stdio `server/mcp.mjs` con herramientas para listar, leer y dibujar en tableros, más un endpoint local `POST /api/boards/:id/ops` limitado a loopback.

### Cambiado

- La versión del proyecto pasa a `2.0.0`; las claves de almacenamiento no cambian.
- El dock de aula incorpora **Lab** y el panel se oculta al presentar.
- Los catálogos comunitarios fuerzan un re-render al instalarse.
- El servidor acepta `POST` en CORS y valida que las operaciones MCP vengan de `127.0.0.1`/`::1`.

### Verificación

`npm run typecheck`, `npm test` (6 archivos / 33 pruebas), `npm run contraste` (48/48 AA) y `npm run build` pasan. QA de navegador: 33 herramientas del laboratorio visibles, conversión CSV/DOCX/PPTX, plugins instalar/insertar, idioma ES/EN y catálogo comunitario, votación QR, modo examen, editor de documento, replay con vídeo WebM, texturas, ambiente, comparador y cursor magnético. MCP y el endpoint de operaciones probados contra un servidor local.

### Límites conocidos

- La traducción cubre el laboratorio y parte del chrome; el resto de la app sigue en español.
- **Make Real** usa una heurística local, no un modelo de visión.
- El modo examen bloquea la pizarra y genera hojas, pero no aplica permisos distintos por alumno en el servidor.
- El Kanban agrupa de forma puntual; no hay arrastre entre columnas.
- Captura de pantalla, webcam y dictado dependen de permisos y APIs del navegador.
- La asociación de archivos `.tiza` con el sistema operativo sigue sin implementarse.

## [1.4.0] — 2026-11-09

Segunda tanda de producto: objetos ricos, aula en vivo, estudio, sala y migración desde otras pizarras. Se mantienen las claves internas de almacenamiento para no romper datos existentes.

### Añadido

- **Objetos ricos**: bloques de código con resaltado, Markdown renderizado, tablas editables, stickers, flashcards con volteo y diagramas Mermaid. Se insertan desde el menú **Insertar** y se editan en línea o desde el inspector.
- **PDF.js real**: visor paginado dentro del tablero con anotaciones de tinta sobre cada página, miniaturas y navegación.
- **Vídeo y audio**: reproducción de vídeo local o por URL (YouTube/Vimeo) y notas de voz grabadas con MediaRecorder, guardadas en OPFS/IndexedDB.
- **Audio en comentarios**: cualquier comentario anclado puede llevar una nota de voz y reproducirse desde el inspector.
- **Aula y presentación**: barra de páginas, capas con visibilidad y bloqueo, marcos con layout de presentación, velo para ocultar zonas, proyector, reacciones flotantes, rejilla de notas y regla con ejes.
- **Sala LAN**: roles editor/visor aplicados en cliente y servidor, seguimiento de personas, traer a todos, chat, reacciones, votación por puntos y viewport compartido.
- **Modo estudio**: repaso de flashcards a pantalla completa con avance y volteo.
- **Mapa mental en vivo**: con una nota seleccionada, `Tab` crea una nota hija conectada y lista para escribir.
- **Portales**: enlaza objetos con marcos o tableros; doble clic viaja al destino y `Ctrl+K` lista portales.
- **Búsqueda difusa** en el tablero y en la paleta de comandos.
- **Importadores**: Excalidraw, respaldos JAM/Jamboard y texto Mermaid convertidos a objetos nativos.
- **Exportación Markdown** con la estructura de marcos, notas, tablas, código, comentarios y archivos.
- **Piezas reutilizables**: guarda una selección como pieza, insértala en cualquier tablero y elimínala cuando ya no la necesites.
- **Aplanar selección**: convierte una selección en una sola imagen no editable.
- **Tiza y resaltador**: trazos con textura de tiza, motas de polvo y paleta propia.
- **Importación rápida de CSV** como tabla nativa y pegado de archivos del portapapeles.
- **Soporte sin conexión**: aviso de estado y caché de la aplicación.

### Cambiado

- El editor en línea reconoce código, Markdown, tablas, flashcards y títulos de marco.
- El inspector muestra propiedades específicas por tipo, portal, votos y acciones de archivo.
- Los conectores y portales respetan las páginas y capas activas.
- La exportación PDF/SVG y el render del lienzo incluyen los nuevos tipos.

### Verificación

`npm run typecheck`, `npm test` (6 archivos / 33 pruebas), `npm run contraste` (48/48 AA) y `npm run build` pasan sin errores.

## [1.3.0] — 2026-11-05

Rediseño visual v2 y primera tanda de funciones de producto de los informes.

### Añadido

- Nueva identidad **tiza / pizarras en vivo**: logo de sonrisa de tiza, favicon, iconos PWA y de escritorio, manifest y textos de la app.
- Sistema visual dual **noche / día** con `#1E1C19` como pizarra principal, superficies cálidas, lima de acción y tokens semánticos.
- Selector de tema **auto / día / noche**; `auto` sigue `prefers-color-scheme` y el tema se resuelve antes del primer pintado.
- Tipografía Space Grotesk + Inter + JetBrains Mono, escala tipográfica y nuevos componentes de barra superior, dashboard, tarjetas, toolbar, inspector, menús, modales y toasts.
- **Búsqueda dentro de la pizarra** con `Ctrl/Cmd+F`, navegación por resultados y salto al elemento.
- **Historial de versiones** local con instantáneas automáticas, guardado manual, restauración y hasta 24 versiones por pizarra.
- **Temporizador de foco** flotante con presets de 15, 25 y 50 minutos, pausa, reinicio y progreso accesible.
- **Bloqueo de pizarra** en solo lectura, con aviso desbloqueable y entradas en menú y paleta de comandos.
- **Arrastrar y pegar cualquier archivo** (PDF, CSV, TXT, ZIP, audio…), no solo imágenes, con almacenamiento OPFS por trozos, respaldo en IndexedDB y subida a la sala LAN. Las tarjetas de archivo se abren o descargan desde el inspector.
- **Pegar texto** desde el portapapeles crea una nota o un texto en la posición del cursor.
- **Conectores mejorados**: anclas laterales magnéticas, trazado ortogonal con esquinas redondeadas, etiquetas editables y terminales `arrow`, `dot`, `crowfoot` y `crowfoot-many`.
- **Temporizador en el lienzo**: objeto temporizador con anillo de progreso, doble clic para iniciar o pausar, campana y finalización automática. Además del temporizador flotante de concentración.
- **Texturas de marco**: liso, puntos, cuadrícula, líneas, pentagrama y ejes, disponibles en lienzo, inspector y exportación SVG.
- **Exportación PDF y SVG**, una página por marco, además de copiar al portapapeles desde el menú superior.
- **Copia de seguridad `.tiza`** del espacio completo (todos los tableros) con importación desde el dashboard.
- **Carpetas y papelera en el inicio**: crear, renombrar y eliminar carpetas, mover tableros, borrado reversible, restauración, purga individual y vaciado de papelera.
- Exportación JSON renombrada a archivo `.tiza.json`.
- Script `npm run contraste` con auditoría de 48 combinaciones WCAG AA.
- Documento [`docs/TIZA-V2.md`](docs/TIZA-V2.md) con el alcance aplicado y el roadmap pendiente.

### Cambiado

- La barra superior móvil prioriza casa, título, compartir y menú; tema, concentración y opciones se movieron al menú «Más».
- La cámara móvil ajusta el ancho real del lienzo en lugar de asumir una columna de 720 px.
- Los objetivos táctiles con puntero grueso pasan a 44 px como mínimo.
- Los nombres visibles del producto pasan a **tiza**; las claves internas y los datos existentes se conservan para no romper tableros.

### Corregido

- El contenido de la pizarra ya no se recorta al abrir un tablero en un móvil estrecho.
- El botón «Propiedades» conserva su texto en pantallas táctiles.
- Los menús y el temporizador respetan mejor los márgenes seguros del móvil.

## [1.2.1] — 2026-11-04

Actualización de mantenimiento centrada en las actualizaciones y en la instalación sobre versiones anteriores.

### Añadido

- Botón **Opciones** en la barra superior y en el panel lateral, con versión instalada y comprobación de actualizaciones contra GitHub.
- Aviso visual (punto coral) cuando hay una versión nueva disponible.
- Descarga del instalador desde la propia app y apertura del asistente de instalación.
- Entrada «Opciones y actualizaciones» en la paleta de comandos.
- Versión real de la app en el diálogo **Acerca de**.

### Corregido

- La actualización desde versiones anteriores ya no se bloquea cuando el desinstalador antiguo devuelve un error: el instalador limpia la carpeta anterior y continúa.
- El flujo de actualización abre el asistente interactivo en lugar de intentar una instalación silenciosa poco fiable.
- Los tableros y las preferencias se conservan al actualizar.

## [1.2.0] — 2026-11-04

Mejoras de producto y de interfaz inspiradas en Excalidraw. Ver [análisis](docs/EXCALIDRAW-ANALISIS.md).

### Añadido

- Tema oscuro completo, con paleta propia en la interfaz y en el lienzo, persistencia local y exportación con el tema activo.
- Barra de herramientas flotante inferior y dock móvil actualizado.
- Acciones rápidas junto a la selección: duplicar, copiar PNG, agrupar, orden Z, bloquear y eliminar.
- Menú contextual con clic derecho sobre el lienzo o sobre un elemento.
- Puntero láser efímero con la tecla `K`.
- Agrupación de elementos con `Ctrl/Cmd+G` y desagrupación con `Ctrl/Cmd+Shift+G`.
- Rellenos sólido, rayado, cruzado y de puntos; bordes sólidos, discontinuos y punteados; esquinas vivas o redondeadas.
- Conectores rectos, en codo y curvos, con etiqueta y hit testing sobre la ruta real.
- Tipografía mono y cursiva para textos.
- Exportación PNG de la selección, copia al portapapeles y fondo transparente.
- Arrastrar y soltar imágenes sobre el lienzo.
- Modo concentración sin paneles y salida con `Esc`.
- Tamaño de cuadrícula configurable y ajuste con `G`.
- Acciones nuevas en la paleta de comandos y en la hoja de atajos.
- Pruebas de rutas de conector y de legibilidad de tintas en tema oscuro.

### Corregido

- Orden de hooks en las acciones rápidas al cambiar la selección.
- El rastro del láser se limpia por completo al desvanecerse.
- La captura de puntero ya no puede interrumpir la interacción si el puntero se liberó antes.

## [0.1.0-alpha.1] — 2026-11-01

Primera versión alpha pública.

### Añadido

- Lienzo infinito con Canvas 2D, pan, zoom y atajos.
- Notas, formas, texto, dibujo, resaltador, imágenes, marcos y conectores.
- Selección múltiple, alineación, distribución, orden Z, bloqueo y duplicación.
- Edición de texto en línea e inspector de estilos.
- Comentarios anclados con resolución.
- 9 plantillas de tablero.
- Presentación por marcos.
- Persistencia local con IndexedDB y autosave.
- Exportación PNG/JSON e importación.
- Sala LAN con WebSocket, QR, presencia, cursores y sincronización.
- Aplicación de escritorio Electron con servidor integrado.
- PWA instalable y proyectos Capacitor Android/iOS.
- Instalador NSIS y versión portable para Windows x64.
- Documentación de producto, arquitectura, verificación y uso.

### Conocido / limitado

- Sin nube, cuentas, IA, integraciones ni permisos enterprise.
- Sincronización last-write-wins por objeto; sin CRDT.
- Sala LAN sin autenticación.
- Ejecutable sin firma de código.
- APK/IPA no compilados.
- Rendimiento no optimizado para tableros masivos.
