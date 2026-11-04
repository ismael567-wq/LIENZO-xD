# Changelog

Todas las versiones relevantes de Lienzo.

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
