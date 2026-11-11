import type { Board, BoardItem } from '../types';
import {
  newConnector,
  newFrame,
  newShape,
  newStickyRect,
  newText,
  newTimerItem,
} from './factory';
import { uid } from './geometry';

/**
 * Utilidades de la fase v2.0: datos, prototipos, aula y automatizaciones.
 * Todo es local y no añade dependencias externas.
 */

export interface CsvResult {
  rows: string[][];
  delimiter: string;
}

/** Parser CSV/TSV ligero con soporte de comillas y saltos dentro de celdas. */
export function parseDelimited(text: string): CsvResult {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts: Array<[string, number]> = [
    [',', (firstLine.match(/,/g) ?? []).length],
    [';', (firstLine.match(/;/g) ?? []).length],
    ['\t', (firstLine.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  const delimiter = counts[0][1] > 0 ? counts[0][0] : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return { rows: rows.filter((entry) => entry.some((value) => value !== '')), delimiter };
}

export type ChartKind = 'bar' | 'line' | 'pie';

const CHART_COLORS = ['#2F6B4F', '#C7A24A', '#3D7EA6', '#C26B4A', '#7A5EA8', '#4C8C6A'];

function chartTheme(dark: boolean) {
  return dark
    ? { bg: '#2A2823', ink: '#F3F0E8', muted: '#ABA59A', line: '#4A463F' }
    : { bg: '#FFFDF7', ink: '#16211E', muted: '#6B7A74', line: '#DCD6C8' };
}

/** Genera un gráfico PNG a partir de una tabla de datos. */
export function renderChartDataUrl(
  rows: string[][],
  kind: ChartKind,
  title: string,
  dark = false,
): { src: string; width: number; height: number } {
  const width = 800;
  const height = 480;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar el gráfico.');
  const theme = chartTheme(dark);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = theme.ink;
  ctx.font = '600 22px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(title || 'Gráfico', 32, 24);

  const header = rows[0] ?? [];
  const body = rows.slice(1);
  if (body.length === 0) {
    ctx.fillStyle = theme.muted;
    ctx.font = '400 15px Inter, system-ui, sans-serif';
    ctx.fillText('Añade filas de datos para dibujar el gráfico.', 32, 70);
    return { src: canvas.toDataURL('image/png'), width, height };
  }
  const labels = body.map((row) => row[0] ?? '');
  const series = body.map((row) => Number(String(row[1] ?? '0').replace(',', '.')) || 0);
  const max = Math.max(1, ...series);
  const plot = { x: 70, y: 90, w: width - 120, h: height - 170 };

  if (kind === 'pie') {
    const total = series.reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
    let angle = -Math.PI / 2;
    const cx = width / 2 - 70;
    const cy = plot.y + plot.h / 2;
    const radius = Math.min(plot.h, plot.w) / 2.4;
    series.forEach((value, index) => {
      const slice = (Math.max(0, value) / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = CHART_COLORS[index % CHART_COLORS.length];
      ctx.fill();
      angle += slice;
    });
    ctx.font = '500 13px Inter, system-ui, sans-serif';
    labels.forEach((label, index) => {
      ctx.fillStyle = theme.ink;
      ctx.fillRect(width - 190, plot.y + index * 24, 10, 10);
      ctx.fillStyle = CHART_COLORS[index % CHART_COLORS.length];
      ctx.fillRect(width - 190, plot.y + index * 24, 10, 10);
      ctx.fillStyle = theme.ink;
      ctx.fillText(
        `${label.slice(0, 16)} · ${series[index]}`,
        width - 172,
        plot.y + index * 24 - 1,
      );
    });
    return { src: canvas.toDataURL('image/png'), width, height };
  }

  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1;
  for (let step = 0; step <= 4; step += 1) {
    const y = plot.y + (plot.h / 4) * step;
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.w, y);
    ctx.stroke();
    ctx.fillStyle = theme.muted;
    ctx.font = '400 11px Inter, system-ui, sans-serif';
    ctx.fillText(String(Math.round(max - (max / 4) * step)), 28, y - 5);
  }

  const slot = plot.w / Math.max(1, series.length);
  if (kind === 'bar') {
    series.forEach((value, index) => {
      const barHeight = (value / max) * plot.h;
      ctx.fillStyle = CHART_COLORS[index % CHART_COLORS.length];
      ctx.fillRect(
        plot.x + slot * index + slot * 0.22,
        plot.y + plot.h - barHeight,
        slot * 0.56,
        barHeight,
      );
    });
  } else {
    ctx.strokeStyle = CHART_COLORS[0];
    ctx.lineWidth = 3;
    ctx.beginPath();
    series.forEach((value, index) => {
      const x = plot.x + slot * index + slot / 2;
      const y = plot.y + plot.h - (value / max) * plot.h;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    series.forEach((value, index) => {
      const x = plot.x + slot * index + slot / 2;
      const y = plot.y + plot.h - (value / max) * plot.h;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = CHART_COLORS[0];
      ctx.fill();
    });
  }
  ctx.fillStyle = theme.ink;
  ctx.font = '500 12px Inter, system-ui, sans-serif';
  labels.forEach((label, index) => {
    ctx.fillText(
      label.length > 10 ? `${label.slice(0, 9)}…` : label,
      plot.x + slot * index + slot * 0.16,
      plot.y + plot.h + 14,
    );
  });
  ctx.fillStyle = theme.muted;
  ctx.font = '400 12px Inter, system-ui, sans-serif';
  ctx.fillText(header[1] ?? 'Valor', 32, height - 34);
  return { src: canvas.toDataURL('image/png'), width, height };
}

export type WireframeKind = 'browser' | 'mobile' | 'card' | 'button' | 'input';

/** Kit de wireframes: piezas agrupadas listas para arrastrar a un prototipo. */
export function buildWireframe(kind: WireframeKind, point: { x: number; y: number }): BoardItem[] {
  const group = uid(8);
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  const items: BoardItem[] = [];
  const push = <T extends BoardItem>(item: T): T => {
    item.groupId = group;
    items.push(item);
    return item;
  };
  const label = (text: string, tx: number, ty: number, size = 15) => {
    const item = push(newText({ x: tx, y: ty }, text));
    item.fontSize = size;
    item.color = '#16211E';
    return item;
  };

  if (kind === 'browser') {
    const frame = push(newFrame({ x, y, w: 680, h: 460 }, 'Navegador'));
    frame.fill = '#FFFFFF';
    const bar = push(newShape({ x: x + 16, y: y + 46, w: 648, h: 38 }, 'rect'));
    bar.fill = '#EFEAE0';
    bar.stroke = '#D6CFC1';
    bar.edge = 'sharp';
    ['#D96B5F', '#E2B44E', '#6FAE7C'].forEach((fill, index) => {
      const dot = push(newShape({ x: x + 30 + index * 20, y: y + 57, w: 12, h: 12 }, 'ellipse'));
      dot.fill = fill;
      dot.stroke = fill;
    });
    label('https://tiza.local', x + 110, y + 56, 13);
    const body = push(newShape({ x: x + 16, y: y + 96, w: 648, h: 340 }, 'rect'));
    body.fill = '#FBF8F1';
    body.stroke = '#E4DDCF';
    body.edge = 'sharp';
    body.text = 'Contenido de la página';
    body.textColor = '#6B665C';
    label('Título de la página', x + 40, y + 120, 24);
    const lineA = push(newShape({ x: x + 40, y: y + 166, w: 420, h: 16 }, 'rect'));
    lineA.fill = '#E7E1D4';
    lineA.stroke = '#E7E1D4';
    const lineB = push(newShape({ x: x + 40, y: y + 194, w: 340, h: 16 }, 'rect'));
    lineB.fill = '#E7E1D4';
    lineB.stroke = '#E7E1D4';
    const cta = push(newShape({ x: x + 40, y: y + 236, w: 160, h: 44 }, 'rect', 'Acción'));
    cta.fill = '#2F6B4F';
    cta.stroke = '#2F6B4F';
    cta.textColor = '#FFFFFF';
  } else if (kind === 'mobile') {
    const frame = push(newFrame({ x, y, w: 300, h: 560 }, 'Móvil'));
    frame.fill = '#FFFFFF';
    const notch = push(newShape({ x: x + 110, y: y + 52, w: 80, h: 12 }, 'rect'));
    notch.fill = '#16211E';
    notch.stroke = '#16211E';
    label('Título de pantalla', x + 30, y + 92, 22);
    const card = push(newShape({ x: x + 26, y: y + 140, w: 248, h: 140 }, 'rect'));
    card.fill = '#F3EFE5';
    card.stroke = '#E1D9C9';
    card.text = 'Tarjeta de contenido';
    const cta = push(newShape({ x: x + 26, y: y + 470, w: 248, h: 48 }, 'rect', 'Continuar'));
    cta.fill = '#2F6B4F';
    cta.stroke = '#2F6B4F';
    cta.textColor = '#FFFFFF';
  } else if (kind === 'card') {
    const card = push(newShape({ x, y, w: 300, h: 220 }, 'rect'));
    card.fill = '#FFFFFF';
    card.stroke = '#DCD5C7';
    card.edge = 'round';
    const photo = push(newShape({ x: x + 16, y: y + 16, w: 268, h: 110 }, 'rect'));
    photo.fill = '#E9E3D6';
    photo.stroke = '#E9E3D6';
    photo.text = 'Imagen';
    photo.textColor = '#8A8375';
    label('Título de la tarjeta', x + 18, y + 140, 18);
    label('Descripción breve en dos líneas.', x + 18, y + 170, 12);
  } else if (kind === 'button') {
    const button = push(newShape({ x, y, w: 200, h: 52 }, 'rect', 'Botón principal'));
    button.fill = '#2F6B4F';
    button.stroke = '#2F6B4F';
    button.textColor = '#FFFFFF';
    button.fontSize = 16;
  } else {
    const input = push(newShape({ x, y, w: 320, h: 52 }, 'rect'));
    input.fill = '#FFFFFF';
    input.stroke = '#B9B1A2';
    input.edge = 'round';
    const hint = label('Escribe aquí…', x + 16, y + 16, 14);
    hint.color = '#8A8375';
    label('Etiqueta del campo', x, y - 24, 12);
  }
  return items;
}

/** Kanban vivo: columnas como marcos y tarjetas como notas. */
export function buildKanban(point: { x: number; y: number }): BoardItem[] {
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  const columns = [
    ['Por hacer', ['Definir objetivo', 'Reunir ejemplos']],
    ['En curso', ['Prototipo inicial']],
    ['Hecho', ['Acordar alcance']],
  ] as const;
  const items: BoardItem[] = [];
  const timer = newTimerItem({ x: x + 40, y: y + 520 }, 15);
  timer.label = 'Sprint';
  items.push(timer);
  columns.forEach(([title, cards], column) => {
    const frame = newFrame({ x: x + column * 360, y, w: 320, h: 480 }, title);
    frame.fill = '#F7F3EA';
    items.push(frame);
    cards.forEach((text, index) => {
      const sticky = newStickyRect(
        { x: x + column * 360 + 24, y: y + 70 + index * 150, w: 272, h: 128 },
        column,
      );
      sticky.text = text;
      items.push(sticky);
    });
  });
  return items;
}

/** Duelo de zonas: cuatro marcos, temporizador y espacio para votar. */
export function buildZoneDuel(point: { x: number; y: number }): BoardItem[] {
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  const items: BoardItem[] = [];
  const timer = newTimerItem({ x: x + 760, y: y + 10 }, 5);
  timer.label = 'Duelo';
  items.push(timer);
  ['Equipo 1', 'Equipo 2', 'Equipo 3', 'Equipo 4'].forEach((title, index) => {
    const frame = newFrame(
      {
        x: x + (index % 2) * 380,
        y: y + Math.floor(index / 2) * 300,
        w: 360,
        h: 280,
      },
      title,
    );
    frame.fill = index % 2 === 0 ? '#F7F3EA' : '#FBF8F1';
    items.push(frame);
  });
  return items;
}

/** Coloca la selección en una fila ordenada y la conecta en cadena. */
export function arrangeFlow(items: BoardItem[], gap = 80): BoardItem[] {
  const nodes = items.filter((item) => item.type !== 'connector');
  if (nodes.length < 2) return items;
  const startX = Math.min(...nodes.map((item) => item.x));
  const startY = Math.min(...nodes.map((item) => item.y));
  const connectors = items.filter((item) => item.type === 'connector');
  const result: BoardItem[] = [];
  let cursor = startX;
  nodes.forEach((item, index) => {
    const placed = { ...item, x: cursor, y: startY } as BoardItem;
    result.push(placed);
    cursor += item.w + gap;
    if (index < nodes.length - 1) {
      const nextX = cursor;
      const connector = newConnector(
        {
          itemId: item.id,
          x: placed.x + item.w,
          y: placed.y + item.h / 2,
          side: 'right',
        },
        {
          itemId: nodes[index + 1].id,
          x: nextX,
          y: startY + nodes[index + 1].h / 2,
          side: 'left',
        },
      );
      connector.lineType = 'elbow';
      result.push(connector);
    }
  });
  return [...result, ...connectors];
}

export const ASSET_LIBRARY: Array<{ category: string; symbols: string[] }> = [
  {
    category: 'Personas y equipos',
    symbols: ['👤', '👥', '🧑‍🏫', '🧑‍💻', '🧑‍🎨', '🤝', '💬', '🗣️', '❤️', '🧠'],
  },
  {
    category: 'Producto y tecnología',
    symbols: ['💻', '📱', '🖥️', '☁️', '🗄️', '🔌', '⚙️', '🔒', '🔑', '🌐'],
  },
  {
    category: 'Ideas y acciones',
    symbols: ['💡', '🎯', '🚀', '⭐', '✅', '❗', '⚡', '🔥', '📌', '🏆'],
  },
  {
    category: 'Naturaleza y tiempo',
    symbols: ['🌱', '🌳', '☀️', '🌙', '⏰', '📅', '🗓️', '🌍', '🌊', '🍃'],
  },
];

const EMBED_WHITELIST = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'figma.com',
  'google.com/maps',
  'openstreetmap.org',
  'spotify.com',
  'open.spotify.com',
  'docs.google.com',
  'miro.com',
  'excalidraw.com',
  'codepen.io',
  'soundcloud.com',
];

export function isEmbedAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    const host = parsed.hostname.replace(/^www\./, '');
    return EMBED_WHITELIST.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`) || url.includes(allowed),
    );
  } catch {
    return false;
  }
}

/** Exporta una selección como HTML autocontenido (Make Real local). */
export function buildHtmlFromItems(items: BoardItem[], title: string): string {
  const nodes = items.filter((item) => item.type !== 'connector');
  const xs = nodes.flatMap((item) => [item.x, item.x + item.w]);
  const ys = nodes.flatMap((item) => [item.y, item.y + item.h]);
  const minX = Math.min(...xs, 0);
  const minY = Math.min(...ys, 0);
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const blocks = nodes
    .map((item) => {
      const text =
        'text' in item && typeof item.text === 'string'
          ? item.text
          : item.type === 'frame'
            ? item.title
            : item.type === 'sticky'
              ? item.text
              : item.type === 'flashcard'
                ? item.front
                : '';
      const fill =
        item.type === 'sticky'
          ? item.fill
          : item.type === 'shape'
            ? item.fill
            : 'transparent';
      const border =
        item.type === 'shape' ? `1.5px solid ${item.stroke}` : '1px solid #DCD5C7';
      const radius = item.type === 'shape' && item.shape === 'ellipse' ? '999px' : '10px';
      const style = [
        'position:absolute',
        `left:${item.x - minX}px`,
        `top:${item.y - minY}px`,
        `width:${item.w}px`,
        `height:${item.h}px`,
        `background:${fill}`,
        `border:${border}`,
        `border-radius:${radius}`,
        item.type === 'text'
          ? 'border:0;background:transparent'
          : '',
        item.type === 'shape' ? 'display:flex;align-items:center;justify-content:center' : '',
        'padding:12px',
        'box-sizing:border-box',
        'white-space:pre-wrap',
        'overflow:hidden',
        'font-family:Inter,system-ui,sans-serif',
        `font-size:${'fontSize' in item ? item.fontSize : 15}px`,
        `color:${'textColor' in item ? item.textColor : '#16211E'}`,
      ]
        .filter(Boolean)
        .join(';');
      return `<div style="${style}">${escape(text)}</div>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
  body { margin:0; background:#FBF8F1; font-family:Inter,system-ui,sans-serif; }
  .stage { position:relative; margin:40px auto; background:#FFFDF7; border:1px solid #E4DDCF; border-radius:16px; box-shadow:0 24px 60px rgba(22,33,30,.12); }
</style>
</head>
<body>
<div class="stage" style="width:${Math.max(320, Math.ceil(Math.max(...xs, 0) - minX + 80))}px;height:${Math.max(240, Math.ceil(Math.max(...ys, 0) - minY + 80))}px">
${blocks}
</div>
</body>
</html>`;
}

export function boardToText(board: Board): string {
  return board.items
    .map((item) => {
      if (item.type === 'sticky' || item.type === 'text' || item.type === 'shape') {
        return item.text;
      }
      if (item.type === 'frame') return `# ${item.title}`;
      if (item.type === 'markdown' || item.type === 'code') return item.text;
      if (item.type === 'flashcard') return `P: ${item.front}\nR: ${item.back}`;
      if (item.type === 'file') return item.name;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}
