# Changelog

Todas las versiones relevantes de tiza.

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
