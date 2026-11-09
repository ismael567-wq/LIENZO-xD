import type {
  AnchorSide,
  Board,
  BoardItem,
  CodeItem,
  ConnectorCap,
  ConnectorItem,
  DrawItem,
  FileItem,
  FlashcardItem,
  FrameBackground,
  FrameItem,
  ImageItem,
  MarkdownItem,
  Point,
  Rect,
  ShapeItem,
  StickerItem,
  StickyItem,
  TableItem,
  TextItem,
  Theme,
  TimerItem,
  Viewport,
} from '../types';
import {
  anchorPointsOf,
  boundsOfItems,
  connectorLabelPoint,
  connectorPathPoints,
  getConnectorEndpoints,
  isConnector,
} from './geometry';
import { FONT_DISPLAY, FONT_MONO, FONT_UI, readableInk } from './theme';
import { formatBytes } from './files';

interface Palette {
  paper: string;
  paperLight: string;
  ink: string;
  brand: string;
  gridDot: string;
  gridLine: string;
  frameFill: string;
  frameStroke: string;
  surface: string;
  muted: string;
  placeholder: string;
  shadow: string;
}

const LIGHT_PALETTE: Palette = {
  paper: '#F4F1E8',
  paperLight: '#FBFAF5',
  ink: '#16211E',
  brand: '#0E5B4F',
  gridDot: 'rgba(22, 33, 30, 0.16)',
  gridLine: 'rgba(22, 33, 30, 0.07)',
  frameFill: '#FBFAF4',
  frameStroke: '#E3DCCB',
  surface: '#FFFDF7',
  muted: 'rgba(22, 33, 30, 0.42)',
  placeholder: '#EDE9DC',
  shadow: 'rgba(22, 33, 30, 0.16)',
};

const DARK_PALETTE: Palette = {
  paper: '#141917',
  paperLight: '#1B211E',
  ink: '#E9EEE9',
  brand: '#63D6BE',
  gridDot: 'rgba(233, 238, 233, 0.2)',
  gridLine: 'rgba(233, 238, 233, 0.08)',
  frameFill: '#1B211E',
  frameStroke: '#34423B',
  surface: '#202824',
  muted: 'rgba(233, 238, 233, 0.5)',
  placeholder: '#242D28',
  shadow: 'rgba(0, 0, 0, 0.42)',
};

const paletteFor = (theme: Theme | undefined): Palette =>
  theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;

export interface RenderOptions {
  width: number;
  height: number;
  dpr: number;
  viewport: Viewport;
  theme?: Theme;
  preview?: boolean;
  transparent?: boolean;
  selected?: string[];
  editingId?: string | null;
  marquee?: Rect | null;
  draft?: BoardItem | null;
  hoveredId?: string | null;
  guides?: { x: number[]; y: number[] };
  comments?: boolean;
  clip?: Rect | null;
  onImageLoad?: () => void;
  /** Muestra los cuatro puntos magnéticos del objeto bajo el cursor. */
  anchorTarget?: { item: BoardItem; side?: AnchorSide } | null;
}

interface CachedImage {
  image: HTMLImageElement;
  loaded: boolean;
  failed: boolean;
}

const imageCache = new Map<string, CachedImage>();

export function clearImageCache(): void {
  imageCache.clear();
}

function getImage(src: string, onLoad?: () => void): CachedImage {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const image = new Image();
  const entry: CachedImage = { image, loaded: false, failed: false };
  image.onload = () => {
    entry.loaded = true;
    onLoad?.();
  };
  image.onerror = () => {
    entry.failed = true;
    onLoad?.();
  };
  image.src = src;
  imageCache.set(src, entry);
  return entry;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fontString(
  size: number,
  weight: number | string = 400,
  family: 'sans' | 'serif' | 'mono' = 'sans',
  italic = false,
): string {
  const stack =
    family === 'serif' ? FONT_DISPLAY : family === 'mono' ? FONT_MONO : FONT_UI;
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${stack}`;
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (!text) return [];
  const lines: string[] = [];
  const paragraphs = text.replace(/\r/g, '').split('\n');
  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
      } else {
        let chunk = '';
        for (const character of word) {
          if (ctx.measureText(chunk + character).width > maxWidth && chunk) {
            lines.push(chunk);
            chunk = character;
          } else {
            chunk += character;
          }
        }
        line = chunk;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawDots(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewport: Viewport,
  grid: boolean,
  palette: Palette,
  gridSize = 24,
): void {
  const spacing = gridSize * viewport.zoom;
  if (spacing < 11) return;
  const offsetX = ((viewport.x % spacing) + spacing) % spacing;
  const offsetY = ((viewport.y % spacing) + spacing) % spacing;
  if (grid) {
    ctx.strokeStyle = palette.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = offsetX; x < width; x += spacing) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, height);
    }
    for (let y = offsetY; y < height; y += spacing) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(width, Math.round(y) + 0.5);
    }
    ctx.stroke();
    return;
  }
  ctx.fillStyle = palette.gridDot;
  const radius = Math.min(1.5, Math.max(0.8, viewport.zoom * 1.05));
  ctx.beginPath();
  for (let x = offsetX; x < width; x += spacing) {
    for (let y = offsetY; y < height; y += spacing) {
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
  }
  ctx.fill();
}

function drawSticky(
  ctx: CanvasRenderingContext2D,
  item: StickyItem,
  options: RenderOptions,
): void {
  const preview = options.preview ?? false;
  const palette = paletteFor(options.theme);
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  if (!preview) {
    ctx.shadowColor = palette.shadow;
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
  }
  roundRect(ctx, item.x, item.y, item.w, item.h, 6);
  ctx.fillStyle = item.fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(22, 33, 30, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (options.editingId !== item.id) {
    const padding = Math.max(12, Math.min(20, item.w * 0.1));
    const fontSize = item.fontSize || 16;
    ctx.fillStyle = item.textColor || palette.ink;
    ctx.font = fontString(fontSize, 500);
    ctx.textBaseline = 'top';
    const lines = wrapText(ctx, item.text || 'Escribe algo…', item.w - padding * 2);
    const lineHeight = fontSize * 1.38;
    const maxLines = Math.floor((item.h - padding * 2) / lineHeight);
    ctx.save();
    roundRect(ctx, item.x, item.y, item.w, item.h, 6);
    ctx.clip();
    lines.slice(0, Math.max(maxLines, 1)).forEach((line, index) => {
      ctx.fillStyle =
        item.text || lines.length > 0
          ? item.textColor || palette.ink
          : 'rgba(22, 33, 30, 0.38)';
      ctx.fillText(line, item.x + padding, item.y + padding + index * lineHeight);
    });
    ctx.restore();

    if (item.author && item.h >= 130) {
      ctx.font = fontString(10, 600);
      ctx.fillStyle = 'rgba(22, 33, 30, 0.42)';
      ctx.textAlign = 'right';
      ctx.fillText(item.author, item.x + item.w - 14, item.y + item.h - 22);
      ctx.textAlign = 'left';
    }
  }
  ctx.restore();
}

function shapePath(
  ctx: CanvasRenderingContext2D,
  item: ShapeItem,
): void {
  if (item.shape === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(
      item.x + item.w / 2,
      item.y + item.h / 2,
      item.w / 2,
      item.h / 2,
      0,
      0,
      Math.PI * 2,
    );
    return;
  }
  if (item.shape === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(item.x + item.w / 2, item.y);
    ctx.lineTo(item.x + item.w, item.y + item.h / 2);
    ctx.lineTo(item.x + item.w / 2, item.y + item.h);
    ctx.lineTo(item.x, item.y + item.h / 2);
    ctx.closePath();
    return;
  }
  const radius = item.edge === 'sharp' ? 0 : item.radius ?? 12;
  roundRect(ctx, item.x, item.y, item.w, item.h, radius);
}

function applyStrokeStyle(
  ctx: CanvasRenderingContext2D,
  item: ShapeItem | ConnectorItem,
  width: number,
): void {
  const style =
    item.type === 'shape'
      ? item.strokeStyle ?? 'solid'
      : item.dashed
        ? 'dashed'
        : 'solid';
  if (style === 'dashed') {
    ctx.setLineDash([Math.max(7, width * 3.2), Math.max(5, width * 2.2)]);
    ctx.lineCap = 'round';
  } else if (style === 'dotted') {
    ctx.setLineDash([Math.max(1, width * 0.8), Math.max(5, width * 2.4)]);
    ctx.lineCap = 'round';
  } else {
    ctx.setLineDash([]);
  }
}

function fillShapeWithStyle(
  ctx: CanvasRenderingContext2D,
  item: ShapeItem,
): void {
  const style = item.fillStyle ?? 'solid';
  if (style === 'solid') {
    ctx.fillStyle = item.fill;
    ctx.fill();
    return;
  }
  ctx.save();
  shapePath(ctx, item);
  ctx.clip();
  ctx.fillStyle = item.fill;
  ctx.globalAlpha = 0.32;
  ctx.fillRect(item.x, item.y, item.w, item.h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = item.stroke;
  ctx.lineWidth = Math.max(0.8, Math.min(2, item.strokeWidth || 1.2));
  const spacing = 9;
  const diagonal = Math.hypot(item.w, item.h);
  const steps = Math.ceil(diagonal / spacing) + 2;
  const drawDiagonal = (direction: 1 | -1) => {
    ctx.beginPath();
    for (let step = -steps; step <= steps; step += 1) {
      const offset = step * spacing;
      if (direction === 1) {
        ctx.moveTo(item.x + offset, item.y);
        ctx.lineTo(item.x + offset + item.h, item.y + item.h);
      } else {
        ctx.moveTo(item.x + offset + item.h, item.y);
        ctx.lineTo(item.x + offset, item.y + item.h);
      }
    }
    ctx.stroke();
  };
  if (style === 'hachure') drawDiagonal(1);
  if (style === 'cross-hatch') {
    drawDiagonal(1);
    drawDiagonal(-1);
  }
  if (style === 'dots') {
    ctx.fillStyle = item.stroke;
    for (let x = item.x + spacing / 2; x < item.x + item.w; x += spacing) {
      for (let y = item.y + spacing / 2; y < item.y + item.h; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1.15, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  item: ShapeItem,
  options: RenderOptions,
): void {
  const preview = options.preview ?? false;
  const palette = paletteFor(options.theme);
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  if (!preview) {
    ctx.shadowColor = palette.shadow;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
  }
  shapePath(ctx, item);
  fillShapeWithStyle(ctx, item);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (item.strokeWidth > 0) {
    ctx.strokeStyle = item.stroke;
    ctx.lineWidth = item.strokeWidth;
    applyStrokeStyle(ctx, item, item.strokeWidth);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (options.editingId !== item.id && item.text) {
    const padding = 18;
    const fontSize = item.fontSize || 16;
    ctx.font = fontString(fontSize, 500);
    ctx.fillStyle = item.textColor || palette.ink;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const lines = wrapText(ctx, item.text, item.w - padding * 2);
    const lineHeight = fontSize * 1.3;
    const startY = item.y + item.h / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => {
      ctx.fillText(line, item.x + item.w / 2, startY + index * lineHeight);
    });
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  item: TextItem,
  options: RenderOptions,
): void {
  if (options.editingId === item.id) return;
  const palette = paletteFor(options.theme);
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  const fontSize = item.fontSize || 24;
  const weight = item.fontFamily === 'serif' ? 400 : item.fontWeight;
  ctx.font = fontString(
    fontSize,
    weight,
    item.fontFamily ?? 'sans',
    Boolean(item.italic),
  );
  ctx.fillStyle = readableInk(item.color, options.theme ?? 'light');
  ctx.textBaseline = 'top';
  ctx.textAlign = item.align === 'center' ? 'center' : 'left';
  const lines = wrapText(ctx, item.text || 'Escribe algo…', item.w);
  const lineHeight = fontSize * 1.28;
  const x = item.align === 'center' ? item.x + item.w / 2 : item.x;
  lines.forEach((line, index) => {
    ctx.fillStyle = item.text
      ? readableInk(item.color, options.theme ?? 'light')
      : palette.muted;
    ctx.fillText(line, x, item.y + index * lineHeight);
  });
  ctx.restore();
}

function drawDraw(
  ctx: CanvasRenderingContext2D,
  item: DrawItem,
  options: RenderOptions,
): void {
  if (item.points.length === 0) return;
  ctx.save();
  ctx.globalAlpha = (item.opacity ?? 1) * (options.preview ? 0.9 : 1);
  const ink = readableInk(item.color, options.theme ?? 'light');
  ctx.strokeStyle = ink;
  ctx.lineWidth = item.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.translate(item.x, item.y);
  ctx.beginPath();
  const points = item.points;
  if (points.length === 1) {
    ctx.arc(points[0].x, points[0].y, item.strokeWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index += 1) {
    const midX = (points[index].x + points[index + 1].x) / 2;
    const midY = (points[index].y + points[index + 1].y) / 2;
    ctx.quadraticCurveTo(points[index].x, points[index].y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  if (item.chalk) {
    // Textura de tiza: dos pasadas desplazadas y motas de polvo.
    ctx.globalAlpha *= 0.35;
    ctx.lineWidth = Math.max(0.7, item.strokeWidth * 0.55);
    for (let pass = 0; pass < 2; pass += 1) {
      ctx.beginPath();
      ctx.moveTo(points[0].x + (pass ? 0.8 : -0.6), points[0].y + (pass ? -0.7 : 0.5));
      for (let index = 1; index < points.length; index += 1) {
        const jitterX = Math.sin(index * 12.9898 + pass * 3.1) * 0.9;
        const jitterY = Math.cos(index * 78.233 + pass * 1.7) * 0.9;
        ctx.lineTo(points[index].x + jitterX, points[index].y + jitterY);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = (item.opacity ?? 1) * 0.25;
    ctx.fillStyle = ink;
    for (let index = 0; index < points.length; index += 4) {
      const point = points[index];
      const radius = Math.max(0.4, item.strokeWidth * 0.16);
      ctx.beginPath();
      ctx.arc(point.x + Math.sin(index) * 1.6, point.y + Math.cos(index) * 1.6, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawImageItem(
  ctx: CanvasRenderingContext2D,
  item: ImageItem,
  options: RenderOptions,
): void {
  const entry = getImage(item.src, options.onImageLoad);
  const palette = paletteFor(options.theme);
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  roundRect(ctx, item.x, item.y, item.w, item.h, item.radius ?? 10);
  if (entry.loaded) {
    ctx.clip();
    ctx.drawImage(entry.image, item.x, item.y, item.w, item.h);
  } else {
    ctx.fillStyle = palette.placeholder;
    ctx.fill();
    ctx.fillStyle = palette.muted;
    ctx.font = fontString(13, 500);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry.failed ? 'Imagen no disponible' : 'Cargando imagen…', item.x + item.w / 2, item.y + item.h / 2);
    ctx.textAlign = 'left';
  }
  ctx.restore();
  ctx.save();
  roundRect(ctx, item.x, item.y, item.w, item.h, item.radius ?? 10);
  ctx.strokeStyle = palette.frameStroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

const FILE_KIND_LABEL: Record<FileItem['kind'], string> = {
  file: 'Archivo',
  pdf: 'PDF',
  video: 'Vídeo',
  audio: 'Audio',
  csv: 'CSV',
  doc: 'Documento',
  sheet: 'Hoja',
};

function fileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].slice(0, 4).toUpperCase() : 'FILE';
}

function drawFile(
  ctx: CanvasRenderingContext2D,
  item: FileItem,
  options: RenderOptions,
): void {
  const palette = paletteFor(options.theme);
  const previewHeight = item.preview ? Math.min(item.h - 64, item.h * 0.62) : 0;
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  roundRect(ctx, item.x, item.y, item.w, item.h, 12);
  ctx.fillStyle = palette.surface;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  if (previewHeight > 0 && item.preview) {
    const entry = getImage(item.preview, options.onImageLoad);
    ctx.save();
    roundRect(ctx, item.x, item.y, item.w, previewHeight, 12);
    ctx.clip();
    if (entry.loaded) {
      const scale = Math.max(item.w / entry.image.width, previewHeight / entry.image.height);
      const dw = entry.image.width * scale;
      const dh = entry.image.height * scale;
      ctx.drawImage(
        entry.image,
        item.x + (item.w - dw) / 2,
        item.y + (previewHeight - dh) / 2,
        dw,
        dh,
      );
    } else {
      ctx.fillStyle = palette.placeholder;
      ctx.fillRect(item.x, item.y, item.w, previewHeight);
    }
    ctx.restore();
  }

  const iconSize = previewHeight > 0 ? 0 : 54;
  const iconX = item.x + 18;
  const iconY = item.y + (previewHeight > 0 ? previewHeight + 16 : 18);
  if (iconSize > 0) {
    roundRect(ctx, iconX, iconY, iconSize, iconSize, 9);
    ctx.fillStyle = palette.brand;
    ctx.globalAlpha = (item.opacity ?? 1) * 0.14;
    ctx.fill();
    ctx.globalAlpha = item.opacity ?? 1;
    ctx.fillStyle = palette.brand;
    ctx.font = fontString(12, 700, 'mono');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fileExtension(item.name), iconX + iconSize / 2, iconY + iconSize / 2);
    ctx.textAlign = 'left';
  }

  const textX = iconSize > 0 ? iconX + iconSize + 14 : item.x + 18;
  const textTop = iconSize > 0 ? iconY + 2 : item.y + previewHeight + 18;
  const maxWidth = item.x + item.w - 18 - textX;
  ctx.fillStyle = palette.ink;
  ctx.font = fontString(14, 600);
  ctx.textBaseline = 'top';
  const nameLines = wrapText(ctx, item.name, Math.max(60, maxWidth));
  nameLines.slice(0, 2).forEach((line, index) => {
    ctx.fillText(line, textX, textTop + index * 18);
  });
  const metaTop = textTop + Math.min(2, nameLines.length) * 18 + 6;
  ctx.fillStyle = palette.muted;
  ctx.font = fontString(10, 500, 'mono');
  const meta = [
    FILE_KIND_LABEL[item.kind] ?? 'Archivo',
    formatBytes(item.size),
    item.pages ? `${item.page ?? 1}/${item.pages}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  ctx.fillText(meta, textX, metaTop);

  if (previewHeight === 0 && iconSize === 0) {
    ctx.fillStyle = palette.muted;
    ctx.font = fontString(10, 500);
    ctx.fillText('Doble clic para abrir', textX, metaTop + 18);
  }

  roundRect(ctx, item.x, item.y, item.w, item.h, 12);
  ctx.strokeStyle = palette.frameStroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawCode(
  ctx: CanvasRenderingContext2D,
  item: CodeItem,
  options: RenderOptions,
): void {
  const palette = paletteFor(options.theme);
  const padding = 14;
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  roundRect(ctx, item.x, item.y, item.w, item.h, 12);
  ctx.fillStyle = options.theme === 'dark' ? '#151A18' : '#F7F5EF';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.save();
  roundRect(ctx, item.x, item.y, item.w, item.h, 12);
  ctx.clip();
  const headerHeight = 26;
  ctx.fillStyle = options.theme === 'dark' ? '#202824' : '#EDE9DC';
  ctx.fillRect(item.x, item.y, item.w, headerHeight);
  ctx.fillStyle = palette.muted;
  ctx.font = fontString(10, 600, 'mono');
  ctx.textBaseline = 'middle';
  ctx.fillText(item.language.toUpperCase() || 'CÓDIGO', item.x + padding, item.y + headerHeight / 2);
  ctx.textBaseline = 'top';
  const fontSize = item.fontSize || 14;
  const lines = wrapText(ctx, item.text || '// escribe código…', item.w - padding * 2);
  lines.slice(0, Math.floor((item.h - headerHeight - padding) / (fontSize * 1.5))).forEach((line, index) => {
    const tokens = line.split(/(\b(?:const|let|var|function|return|if|else|for|while|import|from|export|class|new|async|await|true|false|null)\b|"[^"]*"|'[^']*'|\/\/.*$|\d+)/g);
    let x = item.x + padding;
    for (const token of tokens) {
      if (!token) continue;
      const isKeyword = /^(?:const|let|var|function|return|if|else|for|while|import|from|export|class|new|async|await|true|false|null)$/.test(token);
      const isString = /^["']/.test(token);
      const isComment = token.startsWith('//');
      const isNumber = /^\d+$/.test(token);
      ctx.fillStyle = isKeyword
        ? options.theme === 'dark' ? '#C7EC4A' : '#4E611C'
        : isString
          ? options.theme === 'dark' ? '#9ECBFF' : '#2E5FB7'
          : isComment
            ? palette.muted
            : isNumber
              ? options.theme === 'dark' ? '#FFB27A' : '#A34A13'
              : palette.ink;
      ctx.font = fontString(fontSize, 400, 'mono');
      ctx.fillText(token, x, item.y + headerHeight + padding + index * fontSize * 1.5);
      x += ctx.measureText(token).width;
    }
  });
  ctx.restore();
  roundRect(ctx, item.x, item.y, item.w, item.h, 12);
  ctx.strokeStyle = palette.frameStroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function markdownLines(text: string): Array<{ text: string; kind: 'h1' | 'h2' | 'bullet' | 'check' | 'quote' | 'body'; checked?: boolean }> {
  return text.replace(/\r/g, '').split('\n').map((raw) => {
    const line = raw.trimEnd();
    if (/^#\s+/.test(line)) return { text: line.replace(/^#\s+/, ''), kind: 'h1' as const };
    if (/^##\s+/.test(line)) return { text: line.replace(/^##\s+/, ''), kind: 'h2' as const };
    if (/^[-*]\s+\[[ xX]\]\s+/.test(line)) {
      return {
        text: line.replace(/^[-*]\s+\[[ xX]\]\s+/, ''),
        kind: 'check' as const,
        checked: /\[[xX]\]/.test(line),
      };
    }
    if (/^[-*]\s+/.test(line)) return { text: line.replace(/^[-*]\s+/, ''), kind: 'bullet' as const };
    if (/^>\s+/.test(line)) return { text: line.replace(/^>\s+/, ''), kind: 'quote' as const };
    return { text: line, kind: 'body' as const };
  });
}

function drawMarkdown(
  ctx: CanvasRenderingContext2D,
  item: MarkdownItem,
  options: RenderOptions,
): void {
  const palette = paletteFor(options.theme);
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, item.x, item.y, item.w, item.h, 10);
  ctx.fillStyle = options.theme === 'dark' ? '#1B211E' : '#FFFDF7';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.save();
  roundRect(ctx, item.x, item.y, item.w, item.h, 10);
  ctx.clip();
  let y = item.y + 16;
  const padding = 18;
  for (const line of markdownLines(item.text || '# Título\n\n- Punto uno')) {
    const base = item.fontSize || 16;
    const size = line.kind === 'h1' ? base * 1.5 : line.kind === 'h2' ? base * 1.2 : base;
    ctx.font = fontString(size, line.kind === 'h1' ? 700 : line.kind === 'h2' ? 650 : 400, line.kind === 'h1' || line.kind === 'h2' ? 'serif' : 'sans');
    ctx.fillStyle = line.kind === 'quote' ? palette.muted : palette.ink;
    const prefix = line.kind === 'bullet' ? '• ' : line.kind === 'check' ? (line.checked ? '☑ ' : '☐ ') : '';
    const lines = wrapText(ctx, prefix + line.text, item.w - padding * 2);
    for (const text of lines) {
      if (y > item.y + item.h - 12) break;
      ctx.fillText(text, item.x + padding, y);
      y += size * 1.4;
    }
    if (line.kind === 'h1' || line.kind === 'h2') y += 3;
    if (y > item.y + item.h - 12) break;
  }
  ctx.restore();
  roundRect(ctx, item.x, item.y, item.w, item.h, 10);
  ctx.strokeStyle = palette.frameStroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawTable(
  ctx: CanvasRenderingContext2D,
  item: TableItem,
  options: RenderOptions,
): void {
  const palette = paletteFor(options.theme);
  const rows = item.rows.length > 0 ? item.rows : [['']];
  const columns = Math.max(1, ...rows.map((row) => row.length));
  const cellW = item.w / columns;
  const cellH = item.h / Math.max(1, rows.length);
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  ctx.fillStyle = options.theme === 'dark' ? '#1B211E' : '#FFFDF7';
  ctx.fillRect(item.x, item.y, item.w, item.h);
  ctx.font = fontString(item.fontSize || 13, 500);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    if (item.header && rowIndex === 0) {
      ctx.fillStyle = options.theme === 'dark' ? '#26302B' : '#EDE9DC';
      ctx.fillRect(item.x, item.y + rowIndex * cellH, item.w, cellH);
    }
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const text = rows[rowIndex]?.[columnIndex] ?? '';
      ctx.fillStyle = palette.ink;
      ctx.font = fontString(item.fontSize || 13, item.header && rowIndex === 0 ? 650 : 400);
      const clipped = wrapText(ctx, text, Math.max(10, cellW - 16))[0] ?? '';
      ctx.fillText(clipped, item.x + columnIndex * cellW + 8, item.y + rowIndex * cellH + cellH / 2);
    }
  }
  ctx.strokeStyle = palette.frameStroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let columnIndex = 1; columnIndex < columns; columnIndex += 1) {
    ctx.moveTo(Math.round(item.x + columnIndex * cellW) + 0.5, item.y);
    ctx.lineTo(Math.round(item.x + columnIndex * cellW) + 0.5, item.y + item.h);
  }
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    ctx.moveTo(item.x, Math.round(item.y + rowIndex * cellH) + 0.5);
    ctx.lineTo(item.x + item.w, Math.round(item.y + rowIndex * cellH) + 0.5);
  }
  ctx.stroke();
  ctx.strokeRect(item.x + 0.5, item.y + 0.5, item.w - 1, item.h - 1);
  ctx.restore();
}

function drawSticker(
  ctx: CanvasRenderingContext2D,
  item: StickerItem,
  _options: RenderOptions,
): void {
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  const size = Math.min(item.w, item.h);
  ctx.font = `${Math.max(12, size * 0.72)}px ${FONT_UI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = item.fill ?? '#16211E';
  ctx.fillText(item.symbol, item.x + item.w / 2, item.y + item.h / 2);
  ctx.restore();
}

function drawFlashcard(
  ctx: CanvasRenderingContext2D,
  item: FlashcardItem,
  options: RenderOptions,
): void {
  const palette = paletteFor(options.theme);
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, item.x, item.y, item.w, item.h, 14);
  ctx.fillStyle = item.flipped
    ? options.theme === 'dark' ? '#2A3A33' : '#E8F1EA'
    : options.theme === 'dark' ? '#1B211E' : '#FFFDF7';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = palette.frameStroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const text = item.flipped ? item.back : item.front;
  ctx.fillStyle = palette.ink;
  ctx.font = fontString(item.fontSize || 18, 600, 'serif');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapText(ctx, text || (item.flipped ? 'Respuesta' : 'Pregunta'), item.w - 40);
  const lineHeight = (item.fontSize || 18) * 1.35;
  const startY = item.y + item.h / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.slice(0, 8).forEach((line, index) => {
    ctx.fillText(line, item.x + item.w / 2, startY + index * lineHeight);
  });
  ctx.font = fontString(10, 600, 'mono');
  ctx.fillStyle = palette.muted;
  ctx.fillText(item.flipped ? 'RESPUESTA · CLIC PARA VOLTEAR' : 'PREGUNTA · CLIC PARA VOLTEAR', item.x + item.w / 2, item.y + item.h - 16);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawItemExtras(
  ctx: CanvasRenderingContext2D,
  item: BoardItem,
  options: RenderOptions,
): void {
  const palette = paletteFor(options.theme);
  if (isConnector(item)) return;
  const badges: Array<{ text: string; color: string }> = [];
  if (item.voiceNote) badges.push({ text: '▶ voz', color: palette.brand });
  if (item.linkTo) badges.push({ text: '↗ portal', color: palette.brand });
  if (item.votes && item.votes.length > 0) badges.push({ text: `● ${item.votes.length}`, color: '#E04F2F' });
  if (badges.length === 0) return;
  ctx.save();
  ctx.font = fontString(9, 700, 'mono');
  let x = item.x + 8;
  const y = item.y + item.h - 8;
  for (const badge of badges) {
    const width = ctx.measureText(badge.text).width + 10;
    roundRect(ctx, x, y - 13, width, 16, 5);
    ctx.fillStyle = palette.surface;
    ctx.fill();
    ctx.strokeStyle = badge.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = badge.color;
    ctx.textBaseline = 'middle';
    ctx.fillText(badge.text, x + 5, y - 4.5);
    x += width + 4;
  }
  ctx.restore();
}

function drawTimer(
  ctx: CanvasRenderingContext2D,
  item: TimerItem,
  options: RenderOptions,
): void {
  const palette = paletteFor(options.theme);
  const now = Date.now();
  const remaining = item.running && item.endsAt
    ? Math.max(0, Math.ceil((item.endsAt - now) / 1000))
    : Math.max(0, item.remaining);
  const total = Math.max(1, item.duration);
  const done = remaining <= 0;
  const progress = Math.min(1, remaining / total);
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h / 2 - 6;
  const radius = Math.max(18, Math.min(item.w, item.h) / 2 - 26);
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  roundRect(ctx, item.x, item.y, item.w, item.h, 14);
  ctx.fillStyle = palette.surface;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.lineWidth = Math.max(5, radius * 0.16);
  ctx.strokeStyle = palette.frameStroke;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = done ? '#E04F2F' : palette.brand;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.stroke();
  ctx.lineCap = 'butt';

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  ctx.fillStyle = done ? '#E04F2F' : palette.ink;
  ctx.font = fontString(Math.max(20, Math.min(38, radius * 0.62)), 600, 'mono');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    cx,
    cy - 2,
  );
  ctx.fillStyle = palette.muted;
  ctx.font = fontString(10, 600, 'mono');
  const status = done ? '¡TIEMPO!' : item.running ? 'EN MARCHA' : 'EN PAUSA';
  ctx.fillText(status, cx, cy + radius * 0.5);
  ctx.fillStyle = palette.ink;
  ctx.font = fontString(12, 600);
  ctx.textBaseline = 'bottom';
  ctx.fillText(item.label || 'Tiempo', cx, item.y + item.h - 12);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawAnchorHints(
  ctx: CanvasRenderingContext2D,
  target: { item: BoardItem; side?: AnchorSide },
  palette: Palette,
  zoom: number,
): void {
  if (isConnector(target.item)) return;
  const radius = 4.5 / zoom;
  for (const anchor of anchorPointsOf(target.item)) {
    ctx.beginPath();
    ctx.arc(anchor.point.x, anchor.point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = anchor.side === target.side ? palette.brand : palette.surface;
    ctx.fill();
    ctx.strokeStyle = palette.brand;
    ctx.lineWidth = 1.4 / zoom;
    ctx.stroke();
  }
}

function drawFrameTitle(
  ctx: CanvasRenderingContext2D,
  item: FrameItem,
  selected: boolean,
  palette: Palette,
): void {
  const title = item.title || 'Marco';
  ctx.save();
  ctx.font = fontString(13, 600);
  const textWidth = ctx.measureText(title).width;
  const pillWidth = textWidth + 34;
  const pillHeight = 26;
  const y = item.y - 36;
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, item.x, y, pillWidth, pillHeight, 7);
  ctx.fillStyle = palette.surface;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = selected ? palette.brand : palette.frameStroke;
  ctx.lineWidth = selected ? 1.6 : 1;
  ctx.stroke();
  ctx.fillStyle = palette.brand;
  ctx.beginPath();
  ctx.arc(item.x + 12, y + pillHeight / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.ink;
  ctx.textBaseline = 'middle';
  ctx.fillText(title, item.x + 21, y + pillHeight / 2 + 0.5);
  ctx.restore();
}

function drawFramePattern(
  ctx: CanvasRenderingContext2D,
  item: FrameItem,
  background: FrameBackground,
  palette: Palette,
): void {
  if (background === 'plain') return;
  ctx.save();
  roundRect(ctx, item.x, item.y, item.w, item.h, 10);
  ctx.clip();
  const { x, y, w, h } = item;
  ctx.strokeStyle = palette.frameStroke;
  ctx.fillStyle = palette.frameStroke;
  ctx.lineWidth = 1;
  if (background === 'grid' || background === 'axes') {
    const spacing = 32;
    ctx.globalAlpha = background === 'axes' ? 0.45 : 0.7;
    ctx.beginPath();
    for (let gx = x + spacing; gx < x + w; gx += spacing) {
      ctx.moveTo(Math.round(gx) + 0.5, y);
      ctx.lineTo(Math.round(gx) + 0.5, y + h);
    }
    for (let gy = y + spacing; gy < y + h; gy += spacing) {
      ctx.moveTo(x, Math.round(gy) + 0.5);
      ctx.lineTo(x + w, Math.round(gy) + 0.5);
    }
    ctx.stroke();
    if (background === 'axes') {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = palette.brand;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x + w, y + h / 2);
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w / 2, y + h);
      ctx.stroke();
    }
  } else if (background === 'dots') {
    ctx.globalAlpha = 0.8;
    const spacing = 28;
    const radius = 1.1;
    ctx.beginPath();
    for (let gx = x + spacing / 2; gx < x + w; gx += spacing) {
      for (let gy = y + spacing / 2; gy < y + h; gy += spacing) {
        ctx.moveTo(gx + radius, gy);
        ctx.arc(gx, gy, radius, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  } else if (background === 'lines') {
    ctx.globalAlpha = 0.55;
    const spacing = 34;
    ctx.beginPath();
    for (let gy = y + spacing; gy < y + h - 12; gy += spacing) {
      ctx.moveTo(x + 18, Math.round(gy) + 0.5);
      ctx.lineTo(x + w - 18, Math.round(gy) + 0.5);
    }
    ctx.stroke();
  } else if (background === 'music') {
    ctx.globalAlpha = 0.6;
    const gap = 9;
    const staffHeight = gap * 4;
    const staffGap = 54;
    for (let gy = y + 40; gy + staffHeight < y + h - 16; gy += staffHeight + staffGap) {
      ctx.beginPath();
      for (let line = 0; line < 5; line += 1) {
        const ly = gy + line * gap;
        ctx.moveTo(x + 24, Math.round(ly) + 0.5);
        ctx.lineTo(x + w - 24, Math.round(ly) + 0.5);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  item: FrameItem,
  selected: boolean,
  palette: Palette,
): void {
  ctx.save();
  roundRect(ctx, item.x, item.y, item.w, item.h, 10);
  ctx.fillStyle = item.fill || palette.frameFill;
  ctx.fill();
  ctx.strokeStyle = selected ? palette.brand : palette.frameStroke;
  ctx.lineWidth = selected ? 2 : 1.2;
  ctx.stroke();
  ctx.restore();
  drawFramePattern(ctx, item, item.background ?? 'plain', palette);
  if (item.layout && item.layout !== 'blank') {
    ctx.save();
    roundRect(ctx, item.x, item.y, item.w, item.h, 10);
    ctx.clip();
    ctx.strokeStyle = palette.brand;
    ctx.globalAlpha = 0.26;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    if (item.layout === 'title') {
      ctx.beginPath();
      ctx.moveTo(item.x + item.w * 0.18, item.y + item.h * 0.55);
      ctx.lineTo(item.x + item.w * 0.82, item.y + item.h * 0.55);
      ctx.stroke();
    } else if (item.layout === 'title-content') {
      ctx.beginPath();
      ctx.moveTo(item.x + item.w * 0.1, item.y + item.h * 0.28);
      ctx.lineTo(item.x + item.w * 0.9, item.y + item.h * 0.28);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(item.x + item.w * 0.1, item.y + item.h * 0.52);
      ctx.lineTo(item.x + item.w * 0.9, item.y + item.h * 0.52);
      ctx.moveTo(item.x + item.w * 0.1, item.y + item.h * 0.7);
      ctx.lineTo(item.x + item.w * 0.9, item.y + item.h * 0.7);
      ctx.stroke();
    } else if (item.layout === 'two-columns') {
      ctx.beginPath();
      ctx.moveTo(item.x + item.w / 2, item.y + item.h * 0.16);
      ctx.lineTo(item.x + item.w / 2, item.y + item.h * 0.86);
      ctx.stroke();
    }
    ctx.restore();
  }
  drawFrameTitle(ctx, item, selected, palette);
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  tip: Point,
  from: Point,
  size: number,
): void {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(
    tip.x - size * Math.cos(angle - Math.PI / 7),
    tip.y - size * Math.sin(angle - Math.PI / 7),
  );
  ctx.lineTo(
    tip.x - size * Math.cos(angle + Math.PI / 7),
    tip.y - size * Math.sin(angle + Math.PI / 7),
  );
  ctx.closePath();
  ctx.fill();
}

function drawCap(
  ctx: CanvasRenderingContext2D,
  cap: ConnectorCap,
  tip: Point,
  from: Point,
  size: number,
): void {
  if (cap === 'none') return;
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  if (cap === 'arrow') {
    drawArrow(ctx, tip, from, size);
    return;
  }
  if (cap === 'dot') {
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, Math.max(2.5, size * 0.26), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const prongs = cap === 'crowfoot-many' ? [-0.72, 0, 0.72] : [-0.6, 0.6];
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = Math.max(1.2, size * 0.18);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const offset of prongs) {
    const a = angle + Math.PI + offset;
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x + Math.cos(a) * size * 0.95, tip.y + Math.sin(a) * size * 0.95);
  }
  // Barra perpendicular del crowfoot.
  const barAngle = angle + Math.PI / 2;
  const bar = size * 0.55;
  ctx.moveTo(tip.x + Math.cos(barAngle) * bar, tip.y + Math.sin(barAngle) * bar);
  ctx.lineTo(tip.x - Math.cos(barAngle) * bar, tip.y - Math.sin(barAngle) * bar);
  ctx.stroke();
  ctx.restore();
}

/** Traza una polilínea con codos redondeados. */
function traceRoundedPolyline(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  radius = 18,
): void {
  if (points.length < 2) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const inLength = Math.hypot(current.x - previous.x, current.y - previous.y);
    const outLength = Math.hypot(next.x - current.x, next.y - current.y);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    if (r < 1) {
      ctx.lineTo(current.x, current.y);
      continue;
    }
    const inAngle = Math.atan2(current.y - previous.y, current.x - previous.x);
    const outAngle = Math.atan2(next.y - current.y, next.x - current.x);
    const from = {
      x: current.x - Math.cos(inAngle) * r,
      y: current.y - Math.sin(inAngle) * r,
    };
    const to = {
      x: current.x + Math.cos(outAngle) * r,
      y: current.y + Math.sin(outAngle) * r,
    };
    ctx.lineTo(from.x, from.y);
    ctx.arcTo(current.x, current.y, to.x, to.y, r);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

function drawConnector(
  ctx: CanvasRenderingContext2D,
  item: ConnectorItem,
  board: Board,
  options: RenderOptions,
): void {
  const palette = paletteFor(options.theme);
  const points = connectorPathPoints(item, board.items);
  if (points.length < 2) return;
  const first = points[0];
  const last = points[points.length - 1];
  const beforeLast = points[points.length - 2];
  const afterFirst = points[1];
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  const ink = readableInk(item.color, options.theme ?? 'light');
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = item.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  applyStrokeStyle(ctx, item, item.strokeWidth);
  ctx.beginPath();
  if ((item.lineType ?? 'straight') === 'elbow') {
    traceRoundedPolyline(ctx, points, 18);
  } else {
    ctx.moveTo(first.x, first.y);
    for (let index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index].x, points[index].y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  const size = 11 + item.strokeWidth;
  const endCap = item.endCap ?? (item.arrowEnd ? 'arrow' : 'none');
  const startCap = item.startCap ?? (item.arrowStart ? 'arrow' : 'none');
  drawCap(ctx, endCap, last, beforeLast, size);
  drawCap(ctx, startCap, first, afterFirst, size);
  if (item.label) {
    const mid = connectorLabelPoint(item, board.items);
    ctx.font = fontString(12, 600);
    const width = ctx.measureText(item.label).width;
    roundRect(ctx, mid.x - width / 2 - 8, mid.y - 11, width + 16, 22, 6);
    ctx.fillStyle = palette.surface;
    ctx.fill();
    ctx.strokeStyle = palette.frameStroke;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = palette.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, mid.x, mid.y + 0.5);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  board: Board,
  options: RenderOptions,
): void {
  const selected = new Set(options.selected ?? []);
  if (selected.size === 0) return;
  const zoom = options.viewport.zoom;
  const palette = paletteFor(options.theme);
  ctx.save();
  ctx.strokeStyle = palette.brand;
  ctx.lineWidth = 1.8 / zoom;
  for (const item of board.items) {
    if (!selected.has(item.id) || item.hidden) continue;
    if (isConnector(item)) {
      const points = connectorPathPoints(item, board.items);
      ctx.save();
      ctx.strokeStyle = palette.brand;
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 6 / zoom;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index += 1) {
        ctx.lineTo(points[index].x, points[index].y);
      }
      ctx.stroke();
      ctx.restore();
      for (const point of [points[0], points[points.length - 1]]) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = palette.surface;
        ctx.fill();
        ctx.stroke();
      }
      continue;
    }
    ctx.strokeRect(item.x, item.y, item.w, item.h);
  }
  if (selected.size === 1) {
    const item = board.items.find((candidate) => selected.has(candidate.id));
    if (item && !isConnector(item) && !item.locked) {
      const points: Point[] = [
        { x: item.x, y: item.y },
        { x: item.x + item.w / 2, y: item.y },
        { x: item.x + item.w, y: item.y },
        { x: item.x + item.w, y: item.y + item.h / 2 },
        { x: item.x + item.w, y: item.y + item.h },
        { x: item.x + item.w / 2, y: item.y + item.h },
        { x: item.x, y: item.y + item.h },
        { x: item.x, y: item.y + item.h / 2 },
      ];
      const size = 8 / zoom;
      for (const point of points) {
        ctx.fillStyle = palette.surface;
        ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
        ctx.strokeRect(point.x - size / 2, point.y - size / 2, size, size);
      }
    }
  }
  ctx.restore();
}

function drawComments(
  ctx: CanvasRenderingContext2D,
  board: Board,
  options: RenderOptions,
): void {
  const palette = paletteFor(options.theme);
  board.comments.forEach((comment, index) => {
    ctx.save();
    ctx.shadowColor = palette.shadow;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.arc(comment.x, comment.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = comment.resolved ? '#A8AFA9' : '#E04F2F';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = palette.surface;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = palette.surface;
    ctx.font = fontString(11, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), comment.x, comment.y + 0.5);
    ctx.restore();
  });
}

function drawEmptyState(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  preview: boolean,
  palette: Palette,
): void {
  const centerX = width / 2;
  const centerY = height / 2;
  ctx.save();
  ctx.globalAlpha = preview ? 0.75 : 0.9;
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.muted;
  ctx.font = fontString(preview ? 15 : 20, 500, 'serif');
  ctx.fillText('Una pizarra en blanco para pensar', centerX, centerY - 6);
  ctx.font = fontString(preview ? 11 : 13, 500);
  ctx.fillStyle = palette.muted;
  ctx.fillText(
    preview ? 'Empieza con una nota' : 'Haz doble clic o elige una herramienta para empezar',
    centerX,
    centerY + 18,
  );
  ctx.restore();
}

export function renderBoard(
  ctx: CanvasRenderingContext2D,
  board: Board,
  options: RenderOptions,
): void {
  const { width, height, dpr, viewport, preview = false } = options;
  const palette = paletteFor(options.theme);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width * dpr, height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!options.transparent) {
    ctx.fillStyle = preview ? palette.paperLight : palette.paper;
    ctx.fillRect(0, 0, width, height);
    if (!preview) {
      drawDots(
        ctx,
        width,
        height,
        viewport,
        board.background === 'grid',
        palette,
        board.gridSize ?? 24,
      );
    }
  }
  const layerHidden = new Set(
    (board.layers ?? []).filter((layer) => layer.hidden).map((layer) => layer.id),
  );
  const itemVisible = (item: BoardItem): boolean => {
    if (item.hidden) return false;
    if (item.layerId && layerHidden.has(item.layerId)) return false;
    if (board.pages && board.pages.length > 0) {
      const pageId = board.currentPageId ?? board.pages[0]?.id;
      const itemPageId = (item as { pageId?: string }).pageId;
      if (itemPageId && itemPageId !== pageId) return false;
    }
    if (item.type === 'draw' && item.pageOf) {
      const current = board.pdfPages?.[item.pageOf.fileId] ?? 1;
      if (current !== item.pageOf.page) return false;
    }
    return true;
  };
  const visibleItems = board.items.filter(itemVisible);
  if (visibleItems.length === 0 && !options.transparent) {
    drawEmptyState(ctx, width, height, preview, palette);
  }

  ctx.save();
  ctx.translate(viewport.x, viewport.y);
  ctx.scale(viewport.zoom, viewport.zoom);
  if (options.clip) {
    ctx.beginPath();
    ctx.rect(options.clip.x, options.clip.y, options.clip.w, options.clip.h);
    ctx.clip();
  }

  const selected = new Set(options.selected ?? []);
  const frames = board.items.filter(
    (item): item is FrameItem => item.type === 'frame' && itemVisible(item),
  );
  for (const frame of frames) drawFrame(ctx, frame, selected.has(frame.id), palette);
  for (const item of board.items) {
    if (item.type === 'frame' || !itemVisible(item)) continue;
    if (item.type === 'sticky') drawSticky(ctx, item, options);
    else if (item.type === 'shape') drawShape(ctx, item, options);
    else if (item.type === 'text') drawText(ctx, item, options);
    else if (item.type === 'draw') drawDraw(ctx, item, options);
    else if (item.type === 'image') drawImageItem(ctx, item, options);
    else if (item.type === 'file') drawFile(ctx, item, options);
    else if (item.type === 'timer') drawTimer(ctx, item, options);
    else if (item.type === 'code') drawCode(ctx, item, options);
    else if (item.type === 'markdown') drawMarkdown(ctx, item, options);
    else if (item.type === 'table') drawTable(ctx, item, options);
    else if (item.type === 'sticker') drawSticker(ctx, item, options);
    else if (item.type === 'flashcard') drawFlashcard(ctx, item, options);
    else if (item.type === 'connector') drawConnector(ctx, item, board, options);
    if (item.type !== 'connector') drawItemExtras(ctx, item, options);
  }

  if (board.veil) {
    const revealed = new Set(board.revealedFrames ?? []);
    for (const frame of frames) {
      if (!frame.veiled || revealed.has(frame.id)) continue;
      ctx.save();
      roundRect(ctx, frame.x, frame.y, frame.w, frame.h, 10);
      ctx.fillStyle = options.theme === 'dark' ? '#111513' : '#26241F';
      ctx.fill();
      ctx.fillStyle = options.theme === 'dark' ? '#C7EC4A' : '#FFFDF7';
      ctx.font = fontString(16, 650, 'serif');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Velo · marco oculto', frame.x + frame.w / 2, frame.y + frame.h / 2 - 8);
      ctx.font = fontString(10, 600, 'mono');
      ctx.globalAlpha = 0.7;
      ctx.fillText('CLIC PARA REVELAR', frame.x + frame.w / 2, frame.y + frame.h / 2 + 16);
      ctx.restore();
    }
  }

  if (options.anchorTarget) {
    ctx.save();
    drawAnchorHints(ctx, options.anchorTarget, palette, viewport.zoom);
    ctx.restore();
  }

  if (options.draft) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    const draft = options.draft;
    if (draft.type === 'sticky') drawSticky(ctx, draft, { ...options, editingId: null });
    else if (draft.type === 'shape') drawShape(ctx, draft, { ...options, editingId: null });
    else if (draft.type === 'frame') drawFrame(ctx, draft, true, palette);
    else if (draft.type === 'draw') drawDraw(ctx, draft, options);
    else if (draft.type === 'connector') drawConnector(ctx, draft, board, options);
    ctx.restore();
  }

  if (options.guides && (options.guides.x.length > 0 || options.guides.y.length > 0)) {
    ctx.save();
    ctx.strokeStyle = '#E04F2F';
    ctx.lineWidth = 1 / viewport.zoom;
    ctx.setLineDash([5 / viewport.zoom, 4 / viewport.zoom]);
    for (const x of options.guides.x) {
      ctx.beginPath();
      ctx.moveTo(x, -10000);
      ctx.lineTo(x, 10000);
      ctx.stroke();
    }
    for (const y of options.guides.y) {
      ctx.beginPath();
      ctx.moveTo(-10000, y);
      ctx.lineTo(10000, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (options.comments) drawComments(ctx, board, options);

  if (options.marquee) {
    const marquee = options.marquee;
    ctx.save();
    ctx.fillStyle = palette.brand;
    ctx.globalAlpha = 0.1;
    ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = palette.brand;
    ctx.lineWidth = 1.2 / viewport.zoom;
    ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
    ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
    ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h);
    ctx.restore();
  }

  if (!preview) drawSelection(ctx, board, options);
  ctx.restore();
}

export function renderBoardToCanvas(
  canvas: HTMLCanvasElement,
  board: Board,
  viewport: Viewport,
  options: { preview?: boolean; comments?: boolean; theme?: Theme } = {},
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  renderBoard(ctx, board, {
    width,
    height,
    dpr,
    viewport,
    preview: options.preview,
    comments: options.comments,
    theme: options.theme,
    selected: [],
  });
}

export function boardContentBounds(board: Board): Rect | null {
  const bounds = boundsOfItems(board.items);
  if (board.comments.length === 0) return bounds;
  let minX = bounds?.x ?? Number.POSITIVE_INFINITY;
  let minY = bounds?.y ?? Number.POSITIVE_INFINITY;
  let maxX = bounds ? bounds.x + bounds.w : Number.NEGATIVE_INFINITY;
  let maxY = bounds ? bounds.y + bounds.h : Number.NEGATIVE_INFINITY;
  for (const comment of board.comments) {
    minX = Math.min(minX, comment.x - 24);
    minY = Math.min(minY, comment.y - 24);
    maxX = Math.max(maxX, comment.x + 24);
    maxY = Math.max(maxY, comment.y + 24);
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
