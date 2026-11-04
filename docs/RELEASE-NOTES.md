# LIENZO xD 1.2.0

![LIENZO xD](https://raw.githubusercontent.com/ismael567-wq/LIENZO-xD/main/docs/screenshots/portada.png)

Actualización de producto de Lienzo, la pizarra visual **local-first** para Windows, web y móvil. Esta versión toma los mejores gestos de Excalidraw y los adapta a la arquitectura local-first de Lienzo.

## Descargar

- **Instalador Windows x64:** `Lienzo-Setup-1.2.0.exe`
- **Portable Windows x64:** `Lienzo-1.2.0-portable.exe`

También puedes generarlos desde el código:

```bash
npm install
npm run desktop:installer   # release/Lienzo-Setup-1.2.0.exe
npm run desktop:portable    # release/Lienzo-1.2.0-portable.exe
```

El ejecutable no está firmado. Si Windows muestra “Windows protegió tu PC”:

1. Pulsa **Más información**.
2. Pulsa **Ejecutar de todas formas**.

## Novedades

- **Tema oscuro** completo, aplicado a la interfaz y al lienzo, con persistencia local.
- **Barra de herramientas flotante inferior** y dock móvil actualizado.
- **Acciones rápidas** junto a la selección: duplicar, copiar PNG, agrupar, orden Z, bloquear y eliminar.
- **Menú contextual** con clic derecho.
- **Puntero láser** efímero con `K`.
- **Grupos** con `Ctrl/Cmd+G` y `Ctrl/Cmd+Shift+G`.
- **Rellenos** sólido, rayado, cruzado y puntos; **bordes** sólidos, discontinuos y punteados.
- **Conectores** rectos, en codo y curvos.
- **Tipografía mono y cursiva**.
- **Exportación PNG** de la selección, copia al portapapeles y fondo transparente.
- **Arrastrar y soltar imágenes**.
- **Modo concentración** con salida por `Esc`.
- **Cuadrícula configurable** y ajuste con `G`.
- Paleta de comandos y hoja de atajos ampliadas.

## Verificación

- `npm run typecheck` sin errores.
- 21 pruebas unitarias aprobadas.
- `npm run build` correcto.
- Revisión del tablero, tema oscuro, acciones rápidas y menú contextual en navegador.
- Pruebas nuevas de rutas de conector y legibilidad de tintas en tema oscuro.

## Límites conocidos

- Sin nube, cuentas, IA, integraciones ni permisos enterprise.
- Colaboración **last-write-wins** por objeto; sin CRDT.
- Sala LAN sin autenticación; úsala en redes de confianza.
- Ejecutable sin firma de código.
- APK/IPA no incluidos; los proyectos nativos están en el repositorio.

## Detalles técnicos

- React 19 + TypeScript + Canvas 2D.
- Vite 8, Zustand, IndexedDB, Node.js + WebSocket, Electron, Capacitor.
- Build Windows con Electron Builder (NSIS + portable).
- Análisis de referencia: [`docs/EXCALIDRAW-ANALISIS.md`](https://github.com/ismael567-wq/LIENZO-xD/blob/main/docs/EXCALIDRAW-ANALISIS.md).
- Código y documentación: <https://github.com/ismael567-wq/LIENZO-xD>

Hecho para pensar en voz alta, sin pedir permiso a la nube.
