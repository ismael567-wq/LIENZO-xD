# LIENZO xD 1.2.1

![LIENZO xD](https://raw.githubusercontent.com/ismael567-wq/LIENZO-xD/main/docs/screenshots/portada.png)

Actualización de mantenimiento de Lienzo, la pizarra visual **local-first** para Windows, web y móvil. Esta versión arregla la instalación sobre versiones anteriores y añade un comprobador de actualizaciones dentro de la app.

## Descargar

- **Instalador Windows x64:** `Lienzo-Setup-1.2.1.exe`
- **Portable Windows x64:** `Lienzo-1.2.1-portable.exe`

También puedes generarlos desde el código:

```bash
npm install
npm run desktop:installer   # release/Lienzo-Setup-1.2.1.exe
npm run desktop:portable    # release/Lienzo-1.2.1-portable.exe
```

El ejecutable no está firmado. Si Windows muestra “Windows protegió tu PC”:

1. Pulsa **Más información**.
2. Pulsa **Ejecutar de todas formas**.

## Novedades

- **Botón Opciones** en la barra superior y en el panel lateral, con la versión instalada.
- **Comprobador de actualizaciones** contra GitHub, con aviso visual cuando hay una versión nueva.
- **Descarga e instalación desde la app**: descarga el instalador y abre el asistente de Windows.
- **Entrada en la paleta de comandos**: «Opciones y actualizaciones».
- **Versión real** en el diálogo Acerca de.

## Correcciones

- La actualización ya no falla con «Fallo al desinstalar archivos antiguos de la aplicación» cuando el desinstalador de la versión anterior devuelve un error. El instalador limpia la carpeta anterior y continúa.
- El flujo de actualización abre el asistente interactivo en lugar de una instalación silenciosa que podía terminar sin instalar nada.
- Tus tableros, preferencias y datos locales se conservan al actualizar.

## Actualizar desde 1.2.0 o anterior

1. Abre Lienzo.
2. Pulsa el engranaje **Opciones**.
3. Pulsa **Buscar actualizaciones**.
4. Cuando aparezca la versión nueva, pulsa **Descargar e instalar**.
5. Se abrirá el asistente de Windows. Lienzo se cerrará para dejar instalar la nueva versión.

Si prefieres hacerlo a mano, descarga `Lienzo-Setup-1.2.1.exe` desde esta release y ejecútalo. No es necesario desinstalar antes.

## Verificación

- `npm run typecheck` sin errores.
- 29 pruebas unitarias aprobadas.
- `npm run build` correcto.
- Comprobación de la app de escritorio: versión, diálogo de Opciones, búsqueda de actualizaciones y carga de tableros existentes.

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
- Código y documentación: <https://github.com/ismael567-wq/LIENZO-xD>

Hecho para pensar en voz alta, sin pedir permiso a la nube.
