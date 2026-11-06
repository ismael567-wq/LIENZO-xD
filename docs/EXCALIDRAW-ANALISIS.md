# Análisis de Excalidraw aplicado a tiza

Este documento resume la lectura de Excalidraw usada como referencia de producto y de interfaz para la tanda de mejoras de tiza. No es una copia de su código: Excalidraw es MIT y su arquitectura (React + Canvas 2D + estado centralizado) es parecida a la nuestra, así que sirve como buena fuente de patrones.

Referencia analizada: [`excalidraw/excalidraw`](https://github.com/excalidraw/excalidraw), paquete `packages/excalidraw`.

## 1. Cómo se analizó

Se usó **REA** (Runtime Evidence Analyzer) sobre el árbol local de Excalidraw, limitando el análisis estático a los archivos de interfaz más relevantes:

| Archivo | Qué aporta |
|---|---|
| `components/App.tsx` | Composición general, estado de herramienta, selección, menús, atajos y láser. |
| `components/LayerUI.tsx` | Capas de interfaz, posicionamiento flotante y orden de interacción. |
| `components/Toolbar.tsx` | Barra de herramientas y agrupación de acciones. |
| `components/Tools.tsx` | Definición de herramientas y botones. |
| `components/PropertiesPopover.tsx` | Inspector de propiedades contextual. |
| `components/LaserPointerButton.tsx` | Puntero láser. |
| `components/ContextMenu.tsx` | Menú contextual. |
| `components/DarkModeToggle.tsx` | Conmutador de tema. |

Resultado de la corrida:

- 8 archivos JavaScript/TypeScript analizados.
- 46.454 nodos AST visitados.
- 430.565 bytes de texto leídos.
- 849 hallazgos, casi todos de **flujo de datos dinámico** (`unknown-value`, `dynamic-call`, `ambiguous-target`) porque `App.tsx` concentra miles de líneas y el estado pasa por callbacks y referencias.
- 0 fallos de parseo y 0 archivos con UTF-8 inválido.

La evidencia completa quedó en `rea-excalidraw-summary2.json` durante la sesión de análisis. Los hallazgos no son defectos de Excalidraw: son límites del análisis estático ante un componente enorme con estado dinámico. Para tiza la lección es mantener componentes pequeños y el estado en el store, no replicar ese monolito.

## 2. Patrones de interfaz que adoptamos

### 2.1 Barra flotante inferior

Excalidraw coloca las herramientas principales en una barra flotante centrada, cerca del pulgar y del puntero, y deja las acciones secundarias en menús. tiza tenía una barra lateral; la cambiamos por una barra inferior con:

- Herramientas primarias: seleccionar, mano, nota, texto, forma, conector, dibujo, resaltador, láser.
- Acciones de inserción: imagen, marco, comentario, borrar, plantillas.
- Historial: deshacer y rehacer.
- Etiquetas y atajos en tooltips.

En móvil se mantiene el dock inferior, ahora con láser.

### 2.2 Acciones rápidas sobre la selección

Excalidraw muestra acciones junto al objeto seleccionado en lugar de obligar a ir al panel. tiza incorpora `QuickActions`:

- Contador de elementos seleccionados.
- Duplicar, copiar como PNG, agrupar/desagrupar, traer al frente, enviar al fondo, bloquear y eliminar.
- Se coloca encima de la selección y se voltea debajo si no hay espacio.

### 2.3 Menú contextual

El clic derecho abre acciones según el contexto:

- Sobre un elemento: editar texto, duplicar, copiar PNG, agrupar, orden Z, bloquear y eliminar.
- Sobre el lienzo vacío: crear nota o texto en ese punto, seleccionar todo y ajustar a todo.

Se cierra con `Esc` o al hacer clic fuera y se mantiene dentro del viewport.

### 2.4 Inspector contextual

Excalidraw separa propiedades por tipo de elemento. tiza amplía el inspector existente con:

- Relleno: sólido, rayado, cruzado y puntos.
- Borde: sólido, guiones y puntos; esquinas vivas o redondeadas.
- Conectores: recta, codo y curva.
- Texto: sans, serif, mono y cursiva.
- Grupo: agrupar y desagrupar.

### 2.5 Tema oscuro

Excalidraw permite alternar tema claro/oscuro y adapta el lienzo, no solo la interfaz. tiza añade:

- Tema persistido en `localStorage` y aplicado con `data-theme` en `<html>`.
- Paleta oscura para papel, tinta, superficie, líneas y sombras.
- Render del canvas con paleta oscura (fondo, cuadrícula, marcos, comentarios, selección y estado vacío).
- Ajuste de tintas oscuras para que textos, trazos y conectores sigan siendo legibles sobre el papel oscuro.
- Exportación PNG con el tema activo y opción de fondo transparente.

### 2.6 Puntero láser

El láser de Excalidraw es una herramienta efímera: no crea elementos ni historial. En tiza:

- La tecla `K` activa el puntero láser.
- El trazo se dibuja en un canvas superpuesto al render normal.
- Los puntos se desvanecen en ~1,1 s y el rastro se limpia solo.
- Funciona con ratón, lápiz y táctil.

### 2.7 Modo concentración

Equivalente al zen de Excalidraw: oculta barra superior, paneles, toolbar y estado, deja el lienzo limpio y muestra una salida discreta con `Esc`.

### 2.8 Exportación y portapapeles

Excalidraw permite exportar la escena completa o la selección y copiar PNG. tiza añade:

- PNG del tablero completo.
- PNG solo de la selección, con recorte a sus límites.
- Copia directa al portapapeles.
- Fondo transparente y render con el tema activo.
- Nombre de archivo con sufijo `-seleccion` cuando corresponde.

## 3. Modelo de datos

Excalidraw usa elementos con propiedades opcionales y vínculos por id. tiza mantiene su modelo local-first y añade campos opcionales para no romper tableros existentes:

```ts
type Theme = 'light' | 'dark';
type FillStyle = 'solid' | 'hachure' | 'cross-hatch' | 'dots';
type StrokeStyle = 'solid' | 'dashed' | 'dotted';
type EdgeStyle = 'sharp' | 'round';
type ConnectorLineType = 'straight' | 'elbow' | 'curve';
type FontFamily = 'sans' | 'serif' | 'mono';

interface ItemBase {
  groupId?: string; // agrupa selección, movimiento y duplicado
}

interface ShapeItem {
  fillStyle?: FillStyle;
  strokeStyle?: StrokeStyle;
  edge?: EdgeStyle;
}

interface TextItem {
  fontFamily?: FontFamily;
  italic?: boolean;
}

interface ConnectorItem {
  lineType?: ConnectorLineType;
}

interface Board {
  gridSize?: number; // 16, 24, 32, 48…
}
```

Los campos son opcionales para que los tableros guardados antes de esta versión se lean sin migración.

### Grupos

No hay un elemento “grupo” separado. Los elementos comparten `groupId`; al seleccionar uno se expande la selección a todos los miembros. Al duplicar se genera un `groupId` nuevo para la copia, de modo que el grupo original y el duplicado no queden unidos. Al desagrupar se limpia el campo en los elementos seleccionados.

## 4. Render

El render sigue en Canvas 2D para conservar el rendimiento y la arquitectura local-first:

- `canvasRenderer.ts` recibe `theme` y `transparent` como opciones.
- La cuadrícula usa `board.gridSize` y se dibuja con la paleta activa.
- Los conectores comparten una ruta (`connectorPathPoints`) para dibujo, hit testing, etiqueta y bounds; así el codo y la curva se comportan igual en todas partes.
- Los rellenos no sólidos se recortan a la forma y se dibujan con líneas o puntos.
- La selección, los comentarios y el estado vacío usan la paleta del tema.

## 5. Qué no se copió

Excalidraw es mucho más grande y resuelve problemas que tiza no necesita todavía:

- Colaboración CRDT, cifrado extremo a extremo y salas en la nube.
- Biblioteca de elementos, integraciones y ecosistema de plugins.
- Edición avanzada de puntos de flecha y binding complejo.
- Historial colaborativo y presencia a gran escala.
- i18n completa y accesibilidad avanzada.

tiza mantiene su propuesta: **local-first, sin cuentas, sin nube y con colaboración LAN**. Las mejoras toman los gestos y la ergonomía de Excalidraw, no su infraestructura.

## 6. Verificación

- `npm run typecheck`: sin errores.
- `npm test`: 4 archivos, 21 pruebas.
- `npm run build`: correcto.
- Revisión en navegador del tablero, tema oscuro, acciones rápidas y menú contextual.
- Pruebas nuevas para rutas de conector (recta, codo, curva), hit testing y legibilidad de tintas en tema oscuro.

## 7. Siguientes pasos posibles

1. Biblioteca de elementos reutilizables.
2. Edición de vértices de conectores.
3. Exportación SVG además de PNG.
4. Atajos configurables.
5. Más plantillas y un selector visual de temas.
