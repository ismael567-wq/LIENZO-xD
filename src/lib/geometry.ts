import { nanoid } from 'nanoid';
import type {
  Anchor,
  BoardItem,
  ConnectorItem,
  ItemType,
  Point,
  Rect,
  Viewport,
} from '../types';

export const uid = (size = 10) => nanoid(size);

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const snap = (value: number, grid = 8) => Math.round(value / grid) * grid;

export const screenToWorld = (point: Point, viewport: Viewport): Point => ({
  x: (point.x - viewport.x) / viewport.zoom,
  y: (point.y - viewport.y) / viewport.zoom,
});

export const worldToScreen = (point: Point, viewport: Viewport): Point => ({
  x: point.x * viewport.zoom + viewport.x,
  y: point.y * viewport.zoom + viewport.y,
});

export const isConnector = (item: BoardItem): item is ConnectorItem =>
  item.type === 'connector';

export const isFrame = (item: BoardItem): boolean => item.type === 'frame';

export function itemCenter(item: BoardItem): Point {
  if (isConnector(item)) {
    const mid = connectorMidpoint(item);
    return mid;
  }
  return { x: item.x + item.w / 2, y: item.y + item.h / 2 };
}

export function itemRect(item: BoardItem): Rect {
  if (isConnector(item)) {
    const { a, b } = connectorRawEndpoints(item);
    return normalizeRect(a.x, a.y, b.x, b.y);
  }
  return { x: item.x, y: item.y, w: item.w, h: item.h };
}

export function normalizeRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

export function rectContains(rect: Rect, point: Point, tolerance = 0): boolean {
  return (
    point.x >= rect.x - tolerance &&
    point.x <= rect.x + rect.w + tolerance &&
    point.y >= rect.y - tolerance &&
    point.y <= rect.y + rect.h + tolerance
  );
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function connectorRawEndpoints(conn: ConnectorItem): { a: Point; b: Point } {
  return {
    a: { x: conn.from.x, y: conn.from.y },
    b: { x: conn.to.x, y: conn.to.y },
  };
}

function connectorMidpoint(conn: ConnectorItem): Point {
  const { a, b } = connectorRawEndpoints(conn);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Point on the edge of an item's box, in the direction of `toward`. */
export function edgePoint(item: BoardItem, toward: Point): Point {
  const center = itemCenter(item);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const rect = itemRect(item);
  const halfW = Math.max(rect.w / 2, 1);
  const halfH = Math.max(rect.h / 2, 1);
  const scale = Math.min(
    Math.abs(dx) > 0 ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY,
    Math.abs(dy) > 0 ? halfH / Math.abs(dy) : Number.POSITIVE_INFINITY,
  );
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

export function getAnchorPoint(anchor: Anchor, items: BoardItem[]): Point {
  if (anchor.itemId) {
    const item = items.find((candidate) => candidate.id === anchor.itemId);
    if (item && !isConnector(item)) return itemCenter(item);
  }
  return { x: anchor.x, y: anchor.y };
}

export function getConnectorEndpoints(
  conn: ConnectorItem,
  items: BoardItem[],
): { a: Point; b: Point } {
  const fromItem = conn.from.itemId
    ? items.find((item) => item.id === conn.from.itemId)
    : undefined;
  const toItem = conn.to.itemId
    ? items.find((item) => item.id === conn.to.itemId)
    : undefined;

  const rawA =
    fromItem && !isConnector(fromItem)
      ? itemCenter(fromItem)
      : { x: conn.from.x, y: conn.from.y };
  const rawB =
    toItem && !isConnector(toItem)
      ? itemCenter(toItem)
      : { x: conn.to.x, y: conn.to.y };

  let a = rawA;
  let b = rawB;
  if (fromItem && !isConnector(fromItem)) a = edgePoint(fromItem, rawB);
  if (toItem && !isConnector(toItem)) b = edgePoint(toItem, rawA);
  return { a, b };
}

/** Polyline used to draw and hit-test a connector. */
export function connectorPathPoints(
  conn: ConnectorItem,
  items: BoardItem[],
): Point[] {
  const { a, b } = getConnectorEndpoints(conn, items);
  const lineType = conn.lineType ?? 'straight';
  if (lineType === 'elbow') {
    if (Math.abs(a.y - b.y) < 2) return [a, b];
    if (Math.abs(a.x - b.x) < 2) return [a, b];
    const midX = (a.x + b.x) / 2;
    return [a, { x: midX, y: a.y }, { x: midX, y: b.y }, b];
  }
  if (lineType === 'curve') {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const bend = Math.min(140, length * 0.2);
    const control = {
      x: (a.x + b.x) / 2 - (dy / length) * bend,
      y: (a.y + b.y) / 2 + (dx / length) * bend,
    };
    const points: Point[] = [];
    for (let step = 0; step <= 24; step += 1) {
      const t = step / 24;
      const mt = 1 - t;
      points.push({
        x: mt * mt * a.x + 2 * mt * t * control.x + t * t * b.x,
        y: mt * mt * a.y + 2 * mt * t * control.y + t * t * b.y,
      });
    }
    return points;
  }
  return [a, b];
}

export function distanceToConnector(
  conn: ConnectorItem,
  items: BoardItem[],
  point: Point,
): number {
  const points = connectorPathPoints(conn, items);
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    best = Math.min(best, distanceToSegment(point, points[index - 1], points[index]));
  }
  return best;
}

export function connectorLabelPoint(
  conn: ConnectorItem,
  items: BoardItem[],
): Point {
  const points = connectorPathPoints(conn, items);
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  let total = 0;
  const lengths: number[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const length = Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
    lengths.push(length);
    total += length;
  }
  let target = total / 2;
  for (let index = 1; index < points.length; index += 1) {
    const length = lengths[index - 1];
    if (target <= length) {
      const t = length === 0 ? 0 : target / length;
      return {
        x: points[index - 1].x + (points[index].x - points[index - 1].x) * t,
        y: points[index - 1].y + (points[index].y - points[index - 1].y) * t,
      };
    }
    target -= length;
  }
  return points[points.length - 1];
}

export function connectorBounds(conn: ConnectorItem, items: BoardItem[]): Rect {
  const points = connectorPathPoints(conn, items);
  const pad = conn.strokeWidth + 8;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

export function hitTest(
  items: BoardItem[],
  point: Point,
  zoom = 1,
  includeFrames = true,
): BoardItem | null {
  const tolerance = 8 / zoom;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.locked) continue;
    if (isConnector(item)) {
      if (
        distanceToConnector(item, items, point) <=
        Math.max(8, item.strokeWidth) / zoom
      ) {
        return item;
      }
      continue;
    }
    if (item.type === 'frame') continue;
    if (rectContains(itemRect(item), point, tolerance)) return item;
  }
  if (includeFrames) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item.locked || item.type !== 'frame') continue;
      const titleRect = {
        x: item.x,
        y: item.y - 40,
        w: Math.max(item.w, 120),
        h: 40,
      };
      if (
        rectContains(itemRect(item), point, tolerance) ||
        rectContains(titleRect, point, tolerance)
      ) {
        return item;
      }
    }
  }
  return null;
}

export function hitTestAll(
  items: BoardItem[],
  point: Point,
  zoom = 1,
): BoardItem | null {
  return hitTest(items, point, zoom, true);
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLE_ORDER: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function handlePoints(rect: Rect): Record<Handle, Point> {
  return {
    nw: { x: rect.x, y: rect.y },
    n: { x: rect.x + rect.w / 2, y: rect.y },
    ne: { x: rect.x + rect.w, y: rect.y },
    e: { x: rect.x + rect.w, y: rect.y + rect.h / 2 },
    se: { x: rect.x + rect.w, y: rect.y + rect.h },
    s: { x: rect.x + rect.w / 2, y: rect.y + rect.h },
    sw: { x: rect.x, y: rect.y + rect.h },
    w: { x: rect.x, y: rect.y + rect.h / 2 },
  };
}

export function getHandleAt(rect: Rect, point: Point, zoom = 1): Handle | null {
  const radius = 9 / zoom;
  const points = handlePoints(rect);
  for (const handle of HANDLE_ORDER) {
    const p = points[handle];
    if (Math.abs(point.x - p.x) <= radius && Math.abs(point.y - p.y) <= radius) {
      return handle;
    }
  }
  return null;
}

export const HANDLE_CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

export function resizeRectFromHandle(
  start: Rect,
  handle: Handle,
  deltaX: number,
  deltaY: number,
  minSize = 32,
): Rect {
  let { x, y, w, h } = start;
  if (handle.includes('w')) {
    const nextW = Math.max(minSize, start.w - deltaX);
    x = start.x + (start.w - nextW);
    w = nextW;
  }
  if (handle.includes('e')) {
    w = Math.max(minSize, start.w + deltaX);
  }
  if (handle.includes('n')) {
    const nextH = Math.max(minSize, start.h - deltaY);
    y = start.y + (start.h - nextH);
    h = nextH;
  }
  if (handle.includes('s')) {
    h = Math.max(minSize, start.h + deltaY);
  }
  return { x, y, w, h };
}

export function scalePoints(
  points: Point[],
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
): Point[] {
  const sx = oldW === 0 ? 1 : newW / oldW;
  const sy = oldH === 0 ? 1 : newH / oldH;
  return points.map((p) => ({ x: p.x * sx, y: p.y * sy }));
}

export function boundsOfItems(
  items: BoardItem[],
  ids?: string[],
): Rect | null {
  const set = ids ? new Set(ids) : null;
  const selected = set ? items.filter((item) => set.has(item.id)) : items;
  if (selected.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const item of selected) {
    const rect = isConnector(item) ? connectorBounds(item, items) : itemRect(item);
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function fitViewport(
  content: Rect,
  width: number,
  height: number,
  padding = 88,
  maxZoom = 1.15,
): Viewport {
  const availableW = Math.max(width - padding * 2, 120);
  const availableH = Math.max(height - padding * 2, 120);
  const zoom = clamp(
    Math.min(availableW / Math.max(content.w, 1), availableH / Math.max(content.h, 1)),
    0.06,
    maxZoom,
  );
  return {
    zoom,
    x: (width - content.w * zoom) / 2 - content.x * zoom,
    y: (height - content.h * zoom) / 2 - content.y * zoom,
  };
}

export function zoomAtPoint(
  viewport: Viewport,
  factor: number,
  screenPoint: Point,
): Viewport {
  const zoom = clamp(viewport.zoom * factor, 0.06, 4);
  const world = screenToWorld(screenPoint, viewport);
  return {
    zoom,
    x: screenPoint.x - world.x * zoom,
    y: screenPoint.y - world.y * zoom,
  };
}

export function getFrameSlides(items: BoardItem[]): Rect[] {
  const frames = items.filter(
    (item): item is Extract<BoardItem, { type: 'frame' }> =>
      item.type === 'frame',
  );
  if (frames.length === 0) return [];
  return frames
    .slice()
    .sort((a, b) => (Math.abs(a.y - b.y) > 80 ? a.y - b.y : a.x - b.x))
    .map((frame) => ({
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
    }));
}

export function sortFramesFirst(items: BoardItem[]): BoardItem[] {
  return [...items].sort((a, b) => {
    if (a.type === 'frame' && b.type !== 'frame') return -1;
    if (b.type === 'frame' && a.type !== 'frame') return 1;
    return 0;
  });
}

export function itemTypeLabel(type: ItemType): string {
  switch (type) {
    case 'sticky':
      return 'Nota';
    case 'shape':
      return 'Forma';
    case 'text':
      return 'Texto';
    case 'draw':
      return 'Trazo';
    case 'image':
      return 'Imagen';
    case 'frame':
      return 'Marco';
    case 'connector':
      return 'Conector';
    default:
      return 'Elemento';
  }
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(timestamp).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function isTextItem(item: BoardItem): boolean {
  return item.type === 'sticky' || item.type === 'text' || item.type === 'shape';
}
