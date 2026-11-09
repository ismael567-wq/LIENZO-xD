# tiza 1.3.0

![tiza](https://raw.githubusercontent.com/ismael567-wq/LIENZO-xD/main/docs/screenshots/portada.png)

**tiza — pizarras en vivo.** La pizarra visual local-first para Windows, web y móvil estrena identidad y una primera tanda de funciones de productividad. Sin cuentas, sin nube y con tus tableros en tu dispositivo.

## Novedades

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
- `npm run build` correcto.
- `npm run contraste` → 48/48 AA.
- QA visual en navegador real a 1440×900 y 390×844.

## Pendiente

El rediseño está aplicado y la familia v1.3 está completa (13/13). Quedan pendientes v1.4 (42), v2.0 (31) y v2.0+ (4). Entre lo pendiente: notas de voz/vídeo, flashcards y colaboración CRDT. La asociación de archivos `.tiza` con el sistema operativo no está registrada; la importación funciona desde el menú.

Detalle completo en [`docs/TIZA-V2.md`](TIZA-V2.md).

## Descargar

Los artefactos se generan desde el código:

```bash
npm install
npm run desktop:installer   # release/tiza-Setup-1.3.0.exe
npm run desktop:portable    # release/tiza-1.3.0-portable.exe
```

El ejecutable no está firmado. Si Windows muestra “Windows protegió tu PC”: **Más información → Ejecutar de todas formas**.

## Actualizar

1. Abre tiza.
2. Pulsa el engranaje **Opciones**.
3. Pulsa **Buscar actualizaciones**.
4. Cuando aparezca la versión nueva, pulsa **Descargar e instalar**.

Tus tableros y preferencias se conservan. Las claves internas `lienzo:*` se mantienen para no invalidar datos de versiones anteriores.

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
