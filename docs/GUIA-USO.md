# Guía de uso — tiza alpha

## ¿Qué es tiza?

tiza es una pizarra visual colaborativa **local-first** para Windows, web y móvil. Sirve para pensar, planificar y presentar ideas sobre un lienzo infinito: notas, formas, textos, conectores, imágenes, marcos y comentarios.

La diferencia con Miro es el punto de partida:

- **Sin cuenta**: abres y empiezas.
- **Sin nube**: tus tableros viven en tu dispositivo.
- **Sin conexión**: funciona offline.
- **Colaboración en tu red**: un servidor pequeño permite editar entre dispositivos de la misma Wi-Fi.
- **Datos abiertos**: exportas e importas JSON y PNG.

Esta es la **versión 1.3.0**. Sigue siendo una alpha funcional pensada para probar el concepto y detectar fallos, no para producción.

---

## 1. Instalar en Windows

1. Descarga `tiza-Setup-1.3.0.exe`.
2. Ejecútalo.
3. Windows puede mostrar **“Windows protegió tu PC”** porque el ejecutable **no está firmado**. Pulsa **Más información → Ejecutar de todas formas**. Es normal en una alpha sin certificado de firma de código.
4. Elige la carpeta de instalación o deja la predeterminada.
5. Al terminar, abre **tiza** desde el menú Inicio o el acceso directo del escritorio.

El instalador crea:

- `tiza.exe` en la carpeta elegida.
- Acceso directo en el escritorio.
- Entrada en el menú Inicio.
- Desinstalador en **Configuración → Aplicaciones**.

También existe una versión **portable** (`tiza-1.3.0-portable.exe`) que no requiere instalación.

### Actualizar desde una versión anterior

tiza incluye un botón **Opciones** (engranaje) en la barra superior y en el panel lateral. Desde ahí puedes:

- Ver la versión instalada.
- Comprobar si hay una actualización publicada en GitHub.
- Descargar y abrir el instalador de la nueva versión.

El aviso de actualización también aparece como un punto coral sobre el engranaje. Al instalar una versión nueva, **tus tableros y preferencias se conservan**: viven en `%APPDATA%\tiza` y el instalador no los borra.

### Requisitos

- Windows 10 u 11, 64 bits.
- ~500 MB de espacio libre.
- Para la colaboración LAN: que el puerto **8787** esté libre y que el Firewall de Windows permita la app en redes privadas.

---

## 2. Primeros pasos

1. Abre tiza. Verás el **dashboard** con tres tableros de ejemplo.
2. Pulsa **Nuevo tablero** para elegir una plantilla o un lienzo en blanco.
3. En el tablero, usa la barra inferior:
   - **Seleccionar (V)**: mover, redimensionar y editar.
   - **Nota (N)**: crear una nota adhesiva.
   - **Texto (T)**: título o párrafo.
   - **Forma (R / O / D)**: rectángulo, elipse o rombo.
   - **Conector (C)**: arrastra de un objeto a otro.
   - **Dibujar (P)** y **Resaltar (L)**.
   - **Imagen (I)**: archivo, arrastrar o pegar.
   - **Marco (F)**: sección y diapositiva.
   - **Comentario (M)**: pin anclado.
4. Haz **doble clic** en una nota, texto o forma para escribir. `Esc` guarda y sale.
5. Pulsa **Compartir** para invitar a tu equipo por LAN o exportar el tablero.
6. Pulsa **Presentar** para recorrer los marcos como diapositivas.

### Atajos esenciales

| Acción | Atajo |
|---|---|
| Seleccionar / mano | `V` / `H` |
| Nota / texto / forma | `N` / `T` / `R` |
| Conector | `C` |
| Dibujar / resaltar | `P` / `L` |
| Marco / comentario | `F` / `M` |
| Deshacer / rehacer | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Duplicar | `Ctrl+D` |
| Buscar en la pizarra | `Ctrl+F` |
| Paleta de comandos | `Ctrl+K` |
| Ajustar a todo | `Shift+1` |
| Presentar / salir | botón **Presentar** / `Esc` |

### Buscar, volver atrás y concentrarte

- **Buscar** (`Ctrl+F`): abre un buscador sobre notas, textos, formas, marcos y etiquetas. Usa las flechas y `Enter` para saltar al resultado.
- **Historial** (**Más → Historial de versiones**): tiza guarda una instantánea automática cada pocos minutos y conserva hasta 24 por pizarra. Puedes guardar una versión manual y restaurar cualquier punto. La restauración se puede deshacer con `Ctrl+Z`.
- **Temporizador de foco** (**Más → Temporizador de foco**): elige 15, 25 o 50 minutos, pausa o reinicia. El panel se puede cerrar sin detener la sesión.
- **Bloquear pizarra** (**Más → Bloquear pizarra**): deja el lienzo en solo lectura para revisar o presentar. El aviso superior permite desbloquear.
- **Tema**: el botón sol/luna alterna día y noche. En **Opciones** puedes elegir **Automático** para seguir la preferencia del sistema.

---

## 3. Colaborar en la red local

1. Abre un tablero.
2. Pulsa **Compartir**.
3. Pulsa **Iniciar sala**.
4. Escanea el **QR** con el móvil o copia el enlace.
5. El otro dispositivo debe estar en la **misma red Wi-Fi**.
6. Los cursores y los cambios aparecen en tiempo real.

Notas:

- En el escritorio, el servidor de sala se inicia automáticamente dentro de la app.
- Si usas la versión web, ejecuta `npm run server` en el ordenador.
- El servidor usa el puerto **8787**; si está ocupado, Electron prueba 8788–8799.
- La sala **no tiene autenticación**: comparte el enlace solo con personas de confianza.
- No hay sincronización entre redes distintas ni nube.

---

## 4. Usar tiza en el móvil

### Opción A — PWA (la más rápida)

1. Arranca la sala desde el escritorio.
2. Abre el enlace o escanea el QR en el móvil.
3. En Chrome/Edge: **Menú → Añadir a pantalla de inicio**.
4. En iPhone/Safari: **Compartir → Añadir a pantalla de inicio**.

Funciona offline después de la primera carga (los tableros se guardan en el navegador).

### Opción B — App nativa (Capacitor)

El repositorio incluye los proyectos `android/` e `ios/`:

```bash
npm run cap:sync
npx cap open android   # requiere Android Studio/JDK
npx cap open ios       # requiere Xcode en macOS
```

La compilación de APK/IPA no está incluida en la entrega porque requiere el toolchain nativo.

---

## 5. Dónde están tus datos

- **Escritorio**: IndexedDB dentro del perfil de Electron, normalmente en `%APPDATA%\tiza`. Si actualizas desde Lienzo, tiza reutiliza automáticamente el perfil anterior `%APPDATA%\Lienzo` para conservar tableros.
- **Web**: IndexedDB del navegador.
- **Sala LAN**: el servidor guarda copias en `data/boards/` (versión Node) o en la carpeta de usuario de Electron.
- **Exportación**: usa **Compartir → Exportar** para guardar PNG o JSON.
- **Importación**: **Compartir → Importar** para abrir un `.tiza.json` (también acepta los antiguos `.lienzo.json`).

Haz copias de seguridad con la exportación JSON antes de probar cambios grandes.

---

## 6. Comentarios sobre esta alpha

Esta entrega incluye comentarios y documentación para que el proyecto sea fácil de entender y probar:

- `README.md`: qué es, cómo instalarlo y cómo ejecutarlo.
- `docs/ANALISIS-MIRO.md`: investigación de Miro y decisiones de producto.
- `docs/ARQUITECTURA.md`: modelo de datos, canvas, colaboración, plataformas y límites.
- `docs/VERIFICACION.md`: pruebas, build, Electron y capturas.
- `docs/REA-INSTALACION.md`: instalación del proyecto REA.
- `docs/GUIA-USO.md`: este documento.

### Qué funciona bien

- Lienzo infinito, objetos, edición, selección y atajos.
- Plantillas, presentación, comentarios y exportación.
- Persistencia local y PWA offline.
- Sala LAN con QR, presencia y sincronización.
- Búsqueda, historial de versiones, temporizador de foco y bloqueo de pizarra.
- Temas automático, día y noche, con contraste AA y objetivos táctiles de 44 px.
- Instalador de Windows y versión portable.

### Límites alpha conocidos

- No hay nube, cuentas, permisos enterprise, IA ni 250+ integraciones.
- La sincronización es **last-write-wins por objeto**; si dos personas editan el mismo objeto a la vez, una edición puede pisar la otra.
- La sala LAN no tiene autenticación.
- El catálogo tiene 9 plantillas.
- El ejecutable no está firmado; SmartScreen puede avisar.
- El rendimiento con decenas de miles de objetos no está optimizado.
- El APK/IPA no viene compilado.

### Cómo reportar un fallo

Incluye:

1. Qué estabas haciendo.
2. Qué esperabas.
3. Qué ocurrió.
4. Versión (`1.3.0`) y plataforma (Windows, navegador, móvil).
5. Una captura o el tablero exportado en JSON si es posible.

---

## 7. Desinstalar

- **Windows**: Configuración → Aplicaciones → tiza → Desinstalar.
- **PWA**: mantén pulsado el icono → Quitar.
- Tus tableros exportados en JSON no se borran con la app.
