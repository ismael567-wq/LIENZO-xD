import type {
  Board,
  BoardItem,
  ConnectorItem,
  DrawItem,
  FrameItem,
  ImageItem,
  Point,
  Rect,
  ShapeItem,
  StickyItem,
  TextItem,
  Viewport,
} from '../types';
import {
  boundsOfItems,
  getConnectorEndpoints,
  isConnector,
} from './geometry';
import { FONT_DISPLAY, FONT_UI } from './theme';

const PAPER = '#F4F1E8';
const PAPER_LIGHT = '#FBFAF5';
const INK = '#16211E';
const BRAND = '#0E5B4F';
const GRID_DOT = 'rgba(22, 33, 30, 0.16)';
const GRID_LINE = 'rgba(22, 33, 30, 0.07)';

export interface RenderOptions {
  width: number;
  height: number;
  dpr: number;
  viewport: Viewport;
  preview?: boolean;
  selected?: string[];
  editingId?: string | null;
  marquee?: Rect | null;
  draft?: BoardItem | null;
  hoveredId?: string | null;
  guides?: { x: number[]; y: number[] };
  comments?: boolean;
  clip?: Rect | null;
  onImageLoad?: () => void;
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
  family: 'sans' | 'serif' = 'sans',
): string {
  return `${weight} ${size}px ${family === 'serif' ? FONT_DISPLAY : FONT_UI}`;
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
): void {
  const spacing = 24 * viewport.zoom;
  if (spacing < 11) return;
  const offsetX = ((viewport.x % spacing) + spacing) % spacing;
  const offsetY = ((viewport.y % spacing) + spacing) % spacing;
  if (grid) {
    ctx.strokeStyle = GRID_LINE;
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
  ctx.fillStyle = GRID_DOT;
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
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  if (!preview) {
    ctx.shadowColor = 'rgba(22, 33, 30, 0.16)';
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
    ctx.fillStyle = item.textColor || INK;
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
          ? item.textColor || INK
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
  roundRect(ctx, item.x, item.y, item.w, item.h, item.radius ?? 12);
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  item: ShapeItem,
  options: RenderOptions,
): void {
  const preview = options.preview ?? false;
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  if (!preview) {
    ctx.shadowColor = 'rgba(22, 33, 30, 0.07)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
  }
  shapePath(ctx, item);
  ctx.fillStyle = item.fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (item.strokeWidth > 0) {
    ctx.strokeStyle = item.stroke;
    ctx.lineWidth = item.strokeWidth;
    ctx.stroke();
  }
  if (options.editingId !== item.id && item.text) {
    const padding = 18;
    const fontSize = item.fontSize || 16;
    ctx.font = fontString(fontSize, 500);
    ctx.fillStyle = item.textColor || INK;
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
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  const fontSize = item.fontSize || 24;
  const weight = item.fontFamily === 'serif' ? 400 : item.fontWeight;
  ctx.font = fontString(fontSize, weight, item.fontFamily === 'serif' ? 'serif' : 'sans');
  ctx.fillStyle = item.color;
  ctx.textBaseline = 'top';
  ctx.textAlign = item.align === 'center' ? 'center' : 'left';
  const lines = wrapText(ctx, item.text || 'Escribe algo…', item.w);
  const lineHeight = fontSize * 1.28;
  const x = item.align === 'center' ? item.x + item.w / 2 : item.x;
  lines.forEach((line, index) => {
    ctx.fillStyle = item.text ? item.color : 'rgba(22, 33, 30, 0.32)';
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
  ctx.strokeStyle = item.color;
  ctx.lineWidth = item.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.translate(item.x, item.y);
  ctx.beginPath();
  const points = item.points;
  if (points.length === 1) {
    ctx.arc(points[0].x, points[0].y, item.strokeWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = item.color;
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
  ctx.restore();
}

function drawImageItem(
  ctx: CanvasRenderingContext2D,
  item: ImageItem,
  options: RenderOptions,
): void {
  const entry = getImage(item.src, options.onImageLoad);
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  roundRect(ctx, item.x, item.y, item.w, item.h, item.radius ?? 10);
  if (entry.loaded) {
    ctx.clip();
    ctx.drawImage(entry.image, item.x, item.y, item.w, item.h);
  } else {
    ctx.fillStyle = '#EDE9DC';
    ctx.fill();
    ctx.fillStyle = 'rgba(22, 33, 30, 0.42)';
    ctx.font = fontString(13, 500);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry.failed ? 'Imagen no disponible' : 'Cargando imagen…', item.x + item.w / 2, item.y + item.h / 2);
    ctx.textAlign = 'left';
  }
  ctx.restore();
  ctx.save();
  roundRect(ctx, item.x, item.y, item.w, item.h, item.radius ?? 10);
  ctx.strokeStyle = 'rgba(22, 33, 30, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawFrameTitle(
  ctx: CanvasRenderingContext2D,
  item: FrameItem,
  selected: boolean,
): void {
  const title = item.title || 'Marco';
  ctx.save();
  ctx.font = fontString(13, 600);
  const textWidth = ctx.measureText(title).width;
  const pillWidth = textWidth + 34;
  const pillHeight = 26;
  const y = item.y - 36;
  ctx.shadowColor = 'rgba(22, 33, 30, 0.07)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, item.x, y, pillWidth, pillHeight, 7);
  ctx.fillStyle = '#FFFDF7';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = selected ? BRAND : '#E3DCCB';
  ctx.lineWidth = selected ? 1.6 : 1;
  ctx.stroke();
  ctx.fillStyle = BRAND;
  ctx.beginPath();
  ctx.arc(item.x + 12, y + pillHeight / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.fillText(title, item.x + 21, y + pillHeight / 2 + 0.5);
  ctx.restore();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  item: FrameItem,
  selected: boolean,
): void {
  ctx.save();
  roundRect(ctx, item.x, item.y, item.w, item.h, 10);
  ctx.fillStyle = item.fill || PAPER_LIGHT;
  ctx.fill();
  ctx.strokeStyle = selected ? BRAND : '#E3DCCB';
  ctx.lineWidth = selected ? 2 : 1.2;
  ctx.stroke();
  ctx.restore();
  drawFrameTitle(ctx, item, selected);
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

function drawConnector(
  ctx: CanvasRenderingContext2D,
  item: ConnectorItem,
  board: Board,
): void {
  const { a, b } = getConnectorEndpoints(item, board.items);
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  ctx.strokeStyle = item.color;
  ctx.fillStyle = item.color;
  ctx.lineWidth = item.strokeWidth;
  ctx.lineCap = 'round';
  if (item.dashed) ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  const size = 11 + item.strokeWidth;
  if (item.arrowEnd) drawArrow(ctx, b, a, size);
  if (item.arrowStart) drawArrow(ctx, a, b, size);
  if (item.label) {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    ctx.font = fontString(12, 600);
    const width = ctx.measureText(item.label).width;
    roundRect(ctx, mid.x - width / 2 - 8, mid.y - 11, width + 16, 22, 6);
    ctx.fillStyle = '#FFFDF7';
    ctx.fill();
    ctx.strokeStyle = '#E3DCCB';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = INK;
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
  ctx.save();
  ctx.strokeStyle = BRAND;
  ctx.lineWidth = 1.8 / zoom;
  for (const item of board.items) {
    if (!selected.has(item.id)) continue;
    if (isConnector(item)) {
      const { a, b } = getConnectorEndpoints(item, board.items);
      ctx.save();
      ctx.strokeStyle = 'rgba(14, 91, 79, 0.35)';
      ctx.lineWidth = 6 / zoom;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
      for (const point of [a, b]) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFDF7';
        ctx.fill();
        ctx.stroke();
      }
      continue;
    }
    ctx.strokeRect(item.x, item.y, item.w, item.h);
    if (item.type === 'frame') {
      // Frame title is outside the body; outline the body only.
    }
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
        ctx.fillStyle = '#FFFDF7';
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
): void {
  board.comments.forEach((comment, index) => {
    ctx.save();
    ctx.shadowColor = 'rgba(22, 33, 30, 0.18)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.arc(comment.x, comment.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = comment.resolved ? '#A8AFA9' : '#E04F2F';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#FFFDF7';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#FFFDF7';
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
): void {
  const centerX = width / 2;
  const centerY = height / 2;
  ctx.save();
  ctx.globalAlpha = preview ? 0.75 : 0.9;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(22, 33, 30, 0.28)';
  ctx.font = fontString(preview ? 15 : 20, 500, 'serif');
  ctx.fillText('Un lienzo en blanco para pensar', centerX, centerY - 6);
  ctx.font = fontString(preview ? 11 : 13, 500);
  ctx.fillStyle = 'rgba(22, 33, 30, 0.35)';
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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width * dpr, height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = preview ? PAPER_LIGHT : PAPER;
  ctx.fillRect(0, 0, width, height);
  if (!preview) drawDots(ctx, width, height, viewport, board.background === 'grid');
  if (board.items.length === 0) drawEmptyState(ctx, width, height, preview);

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
    (item): item is FrameItem => item.type === 'frame',
  );
  for (const frame of frames) drawFrame(ctx, frame, selected.has(frame.id));
  for (const item of board.items) {
    if (item.type === 'frame') continue;
    if (item.type === 'sticky') drawSticky(ctx, item, options);
    else if (item.type === 'shape') drawShape(ctx, item, options);
    else if (item.type === 'text') drawText(ctx, item, options);
    else if (item.type === 'draw') drawDraw(ctx, item, options);
    else if (item.type === 'image') drawImageItem(ctx, item, options);
    else if (item.type === 'connector') drawConnector(ctx, item, board);
  }

  if (options.draft) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    const draft = options.draft;
    if (draft.type === 'sticky') drawSticky(ctx, draft, { ...options, editingId: null });
    else if (draft.type === 'shape') drawShape(ctx, draft, { ...options, editingId: null });
    else if (draft.type === 'frame') drawFrame(ctx, draft, true);
    else if (draft.type === 'draw') drawDraw(ctx, draft, options);
    else if (draft.type === 'connector') drawConnector(ctx, draft, board);
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

  if (options.comments) drawComments(ctx, board);

  if (options.marquee) {
    const marquee = options.marquee;
    ctx.save();
    ctx.fillStyle = 'rgba(14, 91, 79, 0.08)';
    ctx.strokeStyle = BRAND;
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
  options: { preview?: boolean; comments?: boolean } = {},
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
