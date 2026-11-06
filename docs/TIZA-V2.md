# tiza v2 — rediseño y alcance

> Documento de entrega de la iteración `1.3.0`. Resume la identidad aplicada, el sistema visual, las funciones nuevas y lo que queda pendiente de los dos informes de producto.

## 1. Resumen ejecutivo

La app se rebautiza como **tiza — pizarras en vivo** y estrena una interfaz v2 construida sobre el sistema de tokens existente.

Se han aplicado dos frentes:

1. **Rediseño visual completo**: identidad, temas noche/día/auto, tipografía, barra superior, dashboard, tarjetas, lienzo, toolbar, inspector, menús, modales, toasts y móvil.
2. **Primera tanda funcional v1.3**: búsqueda en la pizarra, historial de versiones, temporizador de foco y bloqueo de pizarra.

No se ha reescrito el motor Canvas ni el modelo de datos. El rediseño se apoya en tokens y en una capa de acabado, y las claves internas (`useLienzo`, `lienzo:*`) se mantienen para no migrar datos existentes.

## 2. Identidad

| Elemento | Decisión |
|---|---|
| Nombre | **tiza** |
| Descriptor | **pizarras en vivo** |
| Símbolo | Teja clara con ojos y sonrisa, chispa lima |
| Tono | Cercano, manual, sin jerga enterprise |
| Tema principal | Noche (`#1E1C19`) |
| Tema secundario | Día (papel cálido `#FAF7F0`) |

El logo vive en `src/components/Logo.tsx`, `public/favicon.svg` y los iconos PNG generados por `scripts/make-icons.py`. La sonrisa se lee a 16 px y la chispa lima conecta con el color de acción de la interfaz.

## 3. Sistema visual

### Paleta noche (principal)

| Token | Valor | Uso |
|---|---|---|
| `--pizarra` | `#1E1C19` | Fondo del lienzo y de la app |
| `--superficie` | `#2A2823` | Tarjetas, menús, paneles |
| `--superficie-alta` | `#383530` | Estados elevados y hover |
| `--tiza` | `#F3F0E8` | Texto principal |
| `--tiza-suave` | `#ABA59A` | Texto secundario |
| `--tiza-tenue` | `#9C968A` | Metadatos (AA sobre superficie) |
| `--lima-400` | `#C7EC4A` | Acción, foco, selección |
| `--cielo-300` | `#9ECBFF` | Acento informativo |
| `--verde-400` | `#7FDCA8` | Éxito |
| `--rojo-400` | `#FF8A7A` | Error y destructivo |
| `--nota` | `#F6D577` | Nota adhesiva por defecto |

### Paleta día

| Token | Valor | Uso |
|---|---|---|
| `--papel` | `#FAF7F0` | Fondo |
| `--superficie` | `#FFFFFF` | Tarjetas y paneles |
| `--tinta` | `#26241F` | Texto principal |
| `--tinta-suave` | `#6B665C` | Texto secundario |
| `--tinta-tenue` | `#746E64` | Metadatos (AA) |
| `--lima-700` | `#4E611C` | Acción con contraste en claro |
| `--cielo-700` | `#2E5FB7` | Informativo |
| `--verde-700` | `#2E7D5A` | Éxito |
| `--rojo-700` | `#B3372B` | Error |
| `--marca` | `#2F6B4F` | Verde de marca en claro |

Los alias antiguos (`--paper`, `--surface`, `--ink`, `--brand`, etc.) siguen existiendo para que los componentes históricos no se rompan.

### Tipografía

- **Space Grotesk** — titulares, nombres de tablero y cifras grandes.
- **Inter** — texto de interfaz y contenido.
- **JetBrains Mono** — metadatos, atajos, etiquetas y estados.

Las fuentes se cargan como paquetes locales (`@fontsource-variable`), no desde una CDN. La app sigue funcionando offline.

### Movimiento y forma

- Radios de 8–20 px, sombras suaves y bordes de 1 px.
- Transiciones de 140–220 ms; el cambio de tema hace un crossfade breve.
- `prefers-reduced-motion` desactiva las animaciones no esenciales.

## 4. Accesibilidad

- **Contraste**: `npm run contraste` audita 48 pares de texto/fondo en ambos temas. Resultado actual: **48/48 AA**.
- **Objetivos táctiles**: mínimo 44 × 44 px con puntero grueso, incluidos barra superior, dock, menús, búsqueda y temporizador.
- **Foco visible**: anillo lima de 2 px con offset.
- **Teclado**: `Ctrl/Cmd+F` busca, `Ctrl/Cmd+K` abre la paleta, `Esc` cierra overlays.
- **Tema del sistema**: la modalidad `auto` escucha `prefers-color-scheme` sin recargar.
- **Canvas**: los objetos siguen sin ser navegables individualmente por lector de pantalla; es un límite conocido del motor actual.

## 5. Funciones v1.3 implementadas

### Búsqueda en la pizarra

- Archivo: `src/components/BoardSearch.tsx`.
- Abre con `Ctrl/Cmd+F`, icono del menú o paleta de comandos.
- Busca en notas, formas, textos, marcos y etiquetas.
- Resultados con tipo, fragmento y salto al elemento; navegación con flechas y `Enter`.

### Historial de versiones

- Archivos: `src/lib/versions.ts`, `src/components/HistoryDialog.tsx`.
- IndexedDB con hasta 24 instantáneas por pizarra.
- Instantánea automática cada pocos minutos y guardado manual.
- Restauración con confirmación; la acción entra en el historial de deshacer.

### Temporizador de foco

- Archivo: `src/components/FocusTimer.tsx`.
- Presets de 15, 25 y 50 minutos; pausa, reanudación y reinicio.
- Barra de progreso con `role="progressbar"` y tiempo anunciado con `aria-live`.

### Bloqueo de pizarra

- Campo `board.locked` en el modelo y `toggleBoardLock` en el store.
- El lienzo pasa a solo lectura, pero se puede seguir navegando.
- Aviso superior pulsable para desbloquear; también disponible en menú y paleta.

## 6. Cambios técnicos

- `ThemeMode = 'auto' | 'light' | 'dark'` en `src/types.ts`, `src/lib/theme.ts` y el store.
- Script inline en `index.html` para evitar el destello de tema.
- Tokens duales y capa de acabado en `src/styles/global.css`.
- Versiones en IndexedDB integradas con el autosave de `src/lib/persistence.ts`.
- Iconos PWA y de escritorio regenerados desde el nuevo símbolo.
- Metadatos de app: `tiza`, versión `1.3.0`, `appId` `app.tiza.desktop`.
- Se conservan las claves `useLienzo` y `lienzo:*` para no invalidar tableros ni preferencias.

## 7. Verificación

```bash
npm run typecheck
npm test
npm run build
npm run contraste
```

Resultados de la iteración:

- TypeScript sin errores.
- 29/29 pruebas unitarias aprobadas.
- Build de Vite + PWA correcto.
- Auditoría de contraste 48/48 AA.
- QA visual en navegador real: dashboard y pizarra en noche y día, 1440×900 y 390×844.
- Búsqueda, historial, temporizador y bloqueo comprobados en la app.
- Sin errores de consola en las rutas revisadas.

## 8. Lo que queda pendiente

Los informes suman **90 ideas** agrupadas en 9 familias y repartidas en cuatro horizontes. Esta iteración no las implementa todas: aplica el rediseño y una primera tajada funcional.

| Horizonte | Ideas | Implementadas | Estado |
|---|---:|---:|---|
| v1.3 | 13 | 4 | Búsqueda, historial, temporizador y bloqueo |
| v1.4 | 42 | 0 | Pendiente |
| v2.0 | 31 | 0 | Pendiente |
| v2.0+ | 4 | 0 | Pendiente |

Pendientes destacados que no deben darse por hechos:

- Exportación **PDF** y **SVG**.
- Anclas laterales magnéticas para conectores.
- Arrastrar y pegar **cualquier archivo**, no solo imágenes.
- Notas de **voz** y **vídeo**.
- **Flashcards** y repaso espaciado.
- Resto de ideas de las familias v1.4, v2.0 y v2.0+.
- Sincronización CRDT, cuentas opcionales y colaboración fuera de la LAN.

La razón de no abordarlas aún es de foco: primero se consolida una identidad coherente y un núcleo de productividad probado. Añadir las 86 ideas restantes sin producto validado habría producido una alpha más ancha, no mejor.

## 9. Siguiente prioridad recomendada

1. Exportación PDF/SVG y anclas laterales: alto valor, bajo riesgo sobre el motor actual.
2. Arrastrar cualquier archivo y notas de voz: contenido rico sin tocar el modelo de colaboración.
3. Flashcards y repaso: convierte la pizarra en herramienta de estudio.
4. CRDT y cuentas opcionales: solo cuando haya validación de uso real.
