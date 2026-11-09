import type {
  Anchor,
  BoardItem,
  CodeItem,
  ConnectorCap,
  ConnectorItem,
  DrawItem,
  FileItem,
  FlashcardItem,
  FrameItem,
  ImageItem,
  MarkdownItem,
  Point,
  Rect,
  ShapeItem,
  ShapeKind,
  StickerItem,
  StickyItem,
  TableItem,
  TextItem,
  TimerItem,
} from '../types';
import { STICKY_COLORS } from './theme';
import { uid } from './geometry';

const now = () => Date.now();

export function newSticky(point: Point, colorIndex = 0): StickyItem {
  const color = STICKY_COLORS[colorIndex % STICKY_COLORS.length];
  return {
    id: uid(9),
    type: 'sticky',
    x: Math.round(point.x - 90),
    y: Math.round(point.y - 90),
    w: 180,
    h: 180,
    text: '',
    fill: color.value,
    textColor: color.text,
    fontSize: 16,
    author: 'Tú',
    updatedAt: now(),
  };
}

export function newStickyRect(rect: Rect, colorIndex = 0): StickyItem {
  const color = STICKY_COLORS[colorIndex % STICKY_COLORS.length];
  return {
    id: uid(9),
    type: 'sticky',
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    w: Math.max(120, Math.round(rect.w)),
    h: Math.max(100, Math.round(rect.h)),
    text: '',
    fill: color.value,
    textColor: color.text,
    fontSize: 16,
    author: 'Tú',
    updatedAt: now(),
  };
}

export function newText(point: Point, text = ''): TextItem {
  return {
    id: uid(9),
    type: 'text',
    x: Math.round(point.x),
    y: Math.round(point.y),
    w: 340,
    h: 48,
    text,
    fontSize: 26,
    color: '#16211E',
    align: 'left',
    fontWeight: 500,
    fontFamily: 'sans',
    updatedAt: now(),
  };
}

export function newShape(
  rect: Rect,
  shape: ShapeKind = 'rect',
  text = '',
): ShapeItem {
  return {
    id: uid(9),
    type: 'shape',
    shape,
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    w: Math.max(60, Math.round(rect.w)),
    h: Math.max(48, Math.round(rect.h)),
    text,
    fill: '#FFFDF7',
    stroke: '#16211E',
    strokeWidth: 1.5,
    radius: shape === 'rect' ? 14 : 0,
    fontSize: 16,
    textColor: '#16211E',
    fillStyle: 'solid',
    strokeStyle: 'solid',
    edge: shape === 'rect' ? 'round' : 'sharp',
    updatedAt: now(),
  };
}

export function newFrame(rect: Rect, title = 'Nueva sección'): FrameItem {
  return {
    id: uid(9),
    type: 'frame',
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    w: Math.max(240, Math.round(rect.w)),
    h: Math.max(180, Math.round(rect.h)),
    title,
    fill: '#FBFAF4',
    updatedAt: now(),
  };
}

export function newImage(
  src: string,
  naturalWidth: number,
  naturalHeight: number,
  point: Point,
): ImageItem {
  const maxWidth = 520;
  const scale = Math.min(1, maxWidth / Math.max(naturalWidth, 1));
  const w = Math.round(naturalWidth * scale);
  const h = Math.round(naturalHeight * scale);
  return {
    id: uid(9),
    type: 'image',
    x: Math.round(point.x - w / 2),
    y: Math.round(point.y - h / 2),
    w,
    h,
    src,
    alt: 'Imagen del tablero',
    radius: 12,
    updatedAt: now(),
  };
}

export function newDraw(
  absolutePoints: Point[],
  highlighter = false,
  color = '#16211E',
  strokeWidth = 2.5,
): DrawItem {
  const xs = absolutePoints.map((p) => p.x);
  const ys = absolutePoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    id: uid(9),
    type: 'draw',
    x: minX,
    y: minY,
    w: Math.max(2, maxX - minX),
    h: Math.max(2, maxY - minY),
    points: absolutePoints.map((p) => ({ x: p.x - minX, y: p.y - minY })),
    color,
    strokeWidth: highlighter ? 18 : strokeWidth,
    highlighter,
    opacity: highlighter ? 0.35 : 1,
    updatedAt: now(),
  };
}

export function newConnector(a: Anchor, b: Anchor): ConnectorItem {
  return {
    id: uid(9),
    type: 'connector',
    from: a,
    to: b,
    color: '#5B655F',
    strokeWidth: 1.8,
    dashed: false,
    arrowStart: false,
    arrowEnd: true,
    label: '',
    lineType: 'straight',
    startCap: 'none',
    endCap: 'arrow',
    updatedAt: now(),
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  };
}

export interface NewFileOptions {
  fileId: string;
  name: string;
  mime: string;
  size: number;
  kind?: FileItem['kind'];
  preview?: string;
  text?: string;
  pages?: number;
}

export function newFile(point: Point, options: NewFileOptions): FileItem {
  const w = 300;
  const h = 190;
  return {
    id: uid(9),
    type: 'file',
    x: Math.round(point.x - w / 2),
    y: Math.round(point.y - h / 2),
    w,
    h,
    name: options.name,
    mime: options.mime,
    size: options.size,
    fileId: options.fileId,
    kind: options.kind ?? 'file',
    preview: options.preview,
    text: options.text,
    page: options.pages ? 1 : undefined,
    pages: options.pages,
    updatedAt: now(),
  };
}

export function newTimerItem(point: Point, minutes = 5): TimerItem {
  return {
    id: uid(9),
    type: 'timer',
    x: Math.round(point.x - 120),
    y: Math.round(point.y - 80),
    w: 240,
    h: 160,
    label: 'Tiempo',
    duration: Math.max(1, Math.round(minutes)) * 60,
    endsAt: null,
    remaining: Math.max(1, Math.round(minutes)) * 60,
    running: false,
    sound: true,
    updatedAt: now(),
  };
}

export function newCode(point: Point, text = '', language = 'ts'): CodeItem {
  return {
    id: uid(9),
    type: 'code',
    x: Math.round(point.x - 210),
    y: Math.round(point.y - 120),
    w: 420,
    h: 240,
    text,
    language,
    fontSize: 14,
    updatedAt: now(),
  };
}

export function newMarkdown(point: Point, text = '# Idea\n\n- Punto uno\n- [ ] Tarea'): MarkdownItem {
  return {
    id: uid(9),
    type: 'markdown',
    x: Math.round(point.x - 190),
    y: Math.round(point.y - 110),
    w: 380,
    h: 220,
    text,
    fontSize: 16,
    updatedAt: now(),
  };
}

export function newTable(point: Point, rows?: string[][]): TableItem {
  return {
    id: uid(9),
    type: 'table',
    x: Math.round(point.x - 200),
    y: Math.round(point.y - 110),
    w: 400,
    h: 220,
    rows: rows ?? [
      ['Columna 1', 'Columna 2', 'Columna 3'],
      ['', '', ''],
      ['', '', ''],
    ],
    fontSize: 13,
    header: true,
    updatedAt: now(),
  };
}

export function newSticker(point: Point, symbol = '⭐'): StickerItem {
  return {
    id: uid(9),
    type: 'sticker',
    x: Math.round(point.x - 48),
    y: Math.round(point.y - 48),
    w: 96,
    h: 96,
    symbol,
    updatedAt: now(),
  };
}

export function newFlashcard(point: Point, front = '', back = ''): FlashcardItem {
  return {
    id: uid(9),
    type: 'flashcard',
    x: Math.round(point.x - 150),
    y: Math.round(point.y - 100),
    w: 300,
    h: 200,
    front,
    back,
    flipped: false,
    fontSize: 18,
    updatedAt: now(),
  };
}

export function capFromFlags(
  start: boolean,
  end: boolean,
): { startCap: ConnectorCap; endCap: ConnectorCap } {
  return {
    startCap: start ? 'arrow' : 'none',
    endCap: end ? 'arrow' : 'none',
  };
}

export function cloneItemWithNewIds(item: BoardItem, offset = 24): BoardItem {
  const clone = structuredClone(item) as BoardItem;
  clone.id = uid(9);
  if ('x' in clone && 'y' in clone) {
    clone.x += offset;
    clone.y += offset;
  }
  if ('updatedAt' in clone) clone.updatedAt = now();
  return clone;
}

export function duplicateItems(
  items: BoardItem[],
  selectedIds: string[],
  offset = 24,
): { items: BoardItem[]; newIds: string[] } {
  const selected = new Set(selectedIds);
  const originals = items.filter((item) => selected.has(item.id));
  const idMap = new Map<string, string>();
  const clones = originals.map((item) => {
    const clone = cloneItemWithNewIds(item, offset);
    idMap.set(item.id, clone.id);
    return clone;
  });
  const groupMap = new Map<string, string>();
  for (const clone of clones) {
    if (clone.type === 'connector') {
      if (clone.from.itemId && idMap.has(clone.from.itemId)) {
        clone.from.itemId = idMap.get(clone.from.itemId);
      }
      if (clone.to.itemId && idMap.has(clone.to.itemId)) {
        clone.to.itemId = idMap.get(clone.to.itemId);
      }
    }
    if (clone.groupId) {
      let nextGroup = groupMap.get(clone.groupId);
      if (!nextGroup) {
        nextGroup = uid(9);
        groupMap.set(clone.groupId, nextGroup);
      }
      clone.groupId = nextGroup;
    }
  }
  return { items: clones, newIds: clones.map((item) => item.id) };
}
