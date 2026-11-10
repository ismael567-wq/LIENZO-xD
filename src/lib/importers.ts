import type { BoardItem, ShapeKind } from '../types';
import { newConnector, newDraw, newShape, newStickyRect, newText } from './factory';
import { uid } from './geometry';

/**
 * Importadores de terceros.
 *
 * Soportamos los formatos que más se usan para migrar una pizarra a tiza:
 *  - Excalidraw (.excalidraw / .json con `type: "excalidraw"`)
 *  - JAM (respaldo JSON de Jamboard, con `shapes` o `elements`)
 *  - Mermaid (texto `flowchart` / `graph` convertido a formas y flechas)
 *
 * Todos devuelven elementos nativos del tablero, listos para insertar.
 */

type Json = Record<string, unknown>;

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asArray = (value: unknown): Json[] =>
  Array.isArray(value) ? value.filter((entry): entry is Json => Boolean(entry) && typeof entry === 'object') : [];

const color = (value: unknown, fallback: string): string => {
  const raw = asString(value, fallback).trim();
  if (!raw || raw === 'transparent' || raw === 'none') return fallback;
  return raw;
};

function centerOf(items: BoardItem[]): { x: number; y: number } {
  if (items.length === 0) return { x: 0, y: 0 };
  const xs = items.flatMap((item) => [item.x, item.x + item.w]);
  const ys = items.flatMap((item) => [item.y, item.y + item.h]);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

/** Reubica el conjunto alrededor de un punto para no caer fuera del lienzo. */
export function centerItems(items: BoardItem[], point = { x: 240, y: 180 }): BoardItem[] {
  const center = centerOf(items);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return items.map((item) =>
    item.type === 'connector'
      ? item
      : { ...item, x: Math.round(item.x + dx), y: Math.round(item.y + dy) },
  );
}

// ---------------------------------------------------------------- Excalidraw

function excalidrawShape(element: Json): ShapeKind {
  const type = asString(element.type).toLowerCase();
  if (type === 'ellipse') return 'ellipse';
  if (type === 'diamond') return 'diamond';
  return 'rect';
}

export function parseExcalidraw(text: string): BoardItem[] {
  const data = JSON.parse(text) as Json;
  const elements = asArray(data.elements);
  if (elements.length === 0) {
    throw new Error('El archivo de Excalidraw no contiene elementos.');
  }
  const items: BoardItem[] = [];
  for (const element of elements) {
    const type = asString(element.type).toLowerCase();
    if (element.isDeleted === true) continue;
    const x = asNumber(element.x);
    const y = asNumber(element.y);
    const w = Math.max(1, asNumber(element.width));
    const h = Math.max(1, asNumber(element.height));
    if (type === 'rectangle' || type === 'ellipse' || type === 'diamond') {
      const shape = newShape({ x, y, w, h }, excalidrawShape(element), asString(element.text));
      shape.fill = color(element.backgroundColor, 'transparent');
      shape.stroke = color(element.strokeColor, '#16211E');
      shape.strokeWidth = Math.max(1, asNumber(element.strokeWidth, 1.5));
      shape.textColor = color(element.strokeColor, '#16211E');
      shape.fontSize = Math.max(10, asNumber(element.fontSize, 16));
      items.push(shape);
    } else if (type === 'text') {
      const textItem = newText({ x, y }, asString(element.text));
      textItem.w = Math.max(80, w);
      textItem.h = Math.max(24, h || 32);
      textItem.fontSize = Math.max(10, asNumber(element.fontSize, 20));
      textItem.color = color(element.strokeColor, '#16211E');
      items.push(textItem);
    } else if (type === 'arrow' || type === 'line' || type === 'freedraw') {
      const points = asArray(element.points).map((point) => ({
        x: x + asNumber(point[0] ?? point.x),
        y: y + asNumber(point[1] ?? point.y),
      }));
      if (points.length === 0) {
        points.push({ x, y }, { x: x + w, y: y + h });
      }
      if (points.length === 1) points.push({ x: points[0].x + 1, y: points[0].y });
      const draw = newDraw(points, false, color(element.strokeColor, '#16211E'), Math.max(1, asNumber(element.strokeWidth, 2)));
      items.push(draw);
    }
  }
  return centerItems(items);
}

// --------------------------------------------------------------------- JAM

const JAM_SHAPE: Record<string, ShapeKind> = {
  rect: 'rect',
  rectangle: 'rect',
  square: 'rect',
  round: 'rect',
  sticky: 'rect',
  note: 'rect',
  ellipse: 'ellipse',
  circle: 'ellipse',
  oval: 'ellipse',
  diamond: 'diamond',
  rhombus: 'diamond',
};

/**
 * Los respaldos de Jamboard no tienen un esquema público estable. Aceptamos
 * tanto un JSON propio con `shapes`/`elements` como una lista de trazos y
 * notas con coordenadas, que es lo que exportan las herramientas de terceros.
 */
export function parseJam(text: string): BoardItem[] {
  const data = JSON.parse(text) as Json;
  const source = Array.isArray(data.shapes)
    ? asArray(data.shapes)
    : Array.isArray(data.elements)
      ? asArray(data.elements)
      : Array.isArray(data.items)
        ? asArray(data.items)
        : [];
  if (source.length === 0) {
    throw new Error('El archivo JAM no contiene formas reconocibles.');
  }
  const items: BoardItem[] = [];
  for (const shape of source) {
    const type = asString(shape.type, 'sticky').toLowerCase();
    const x = asNumber(shape.x ?? shape.left ?? shape.positionX);
    const y = asNumber(shape.y ?? shape.top ?? shape.positionY);
    const w = Math.max(40, asNumber(shape.width ?? shape.w, 220));
    const h = Math.max(32, asNumber(shape.height ?? shape.h, 160));
    const text = asString(shape.text ?? shape.content ?? shape.value);
    if (type === 'stroke' || type === 'path' || type === 'draw' || type === 'line') {
      const rawPoints = asArray(shape.points);
      const points = rawPoints.map((point) => ({
        x: x + asNumber(point.x ?? point[0]),
        y: y + asNumber(point.y ?? point[1]),
      }));
      if (points.length >= 2) {
        items.push(newDraw(points, false, color(shape.color ?? shape.stroke, '#16211E'), Math.max(1, asNumber(shape.strokeWidth ?? shape.width, 2))));
      }
      continue;
    }
    if (type === 'text') {
      const textItem = newText({ x, y }, text);
      textItem.w = Math.max(80, w);
      textItem.h = Math.max(24, h);
      textItem.fontSize = Math.max(10, asNumber(shape.fontSize, 20));
      textItem.color = color(shape.color ?? shape.stroke, '#16211E');
      items.push(textItem);
      continue;
    }
    const sticky = newStickyRect({ x, y, w, h }, Math.round(Math.random() * 5));
    sticky.text = text;
    sticky.fill = color(shape.fill ?? shape.color ?? shape.background, sticky.fill);
    sticky.textColor = color(shape.textColor ?? shape.colorText, sticky.textColor);
    sticky.fontSize = Math.max(10, asNumber(shape.fontSize, 16));
    const kind = JAM_SHAPE[type];
    if (kind && kind !== 'rect') {
      const converted = newShape({ x, y, w, h }, kind, text);
      converted.fill = color(shape.fill ?? shape.color ?? shape.background, sticky.fill);
      converted.stroke = color(shape.stroke ?? shape.border, '#16211E');
      converted.textColor = sticky.textColor;
      converted.fontSize = sticky.fontSize;
      items.push(converted);
    } else {
      items.push(sticky);
    }
  }
  return centerItems(items);
}

// ------------------------------------------------------------------ Mermaid

interface MermaidNode {
  id: string;
  label: string;
  kind: 'rect' | 'round' | 'diamond' | 'circle';
}

interface MermaidEdge {
  from: string;
  to: string;
  label: string;
}

function mermaidLabel(raw: string): string {
  return raw
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .trim();
}

function parseMermaidNode(token: string): MermaidNode | null {
  const match = token.trim().match(/^([\w-]+)\s*(\(\(.*\)\)|\[.*\]|\(.*\)|\{.*\}|\[\/.*\/\])?$/);
  if (!match) return null;
  const id = match[1];
  const shape = match[2] ?? '';
  let kind: MermaidNode['kind'] = 'rect';
  let label = id;
  if (shape.startsWith('((')) {
    kind = 'circle';
    label = shape.slice(2, -2);
  } else if (shape.startsWith('{')) {
    kind = 'diamond';
    label = shape.slice(1, -1);
  } else if (shape.startsWith('(')) {
    kind = 'round';
    label = shape.slice(1, -1);
  } else if (shape.startsWith('[')) {
    kind = 'rect';
    label = shape.slice(1, -1).replace(/^\/|\/$/g, '');
  }
  return { id, label: mermaidLabel(label), kind };
}

export function parseMermaid(text: string): BoardItem[] {
  const nodes = new Map<string, MermaidNode>();
  const edges: MermaidEdge[] = [];
  const ensure = (token: string): string | null => {
    const node = parseMermaidNode(token);
    if (!node) return null;
    if (!nodes.has(node.id)) nodes.set(node.id, node);
    else if (node.label !== node.id) nodes.set(node.id, node);
    return node.id;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%') || /^(flowchart|graph)\b/i.test(line)) continue;
    if (/^(subgraph|end|classDef|class|style|linkStyle|click)\b/i.test(line)) continue;
    const edgeMatch = line.match(
      /^(.+?)\s*(-->|---|-.->|==>)\s*(?:\|([^|]*)\|\s*)?(.+)$/,
    );
    if (edgeMatch) {
      const from = ensure(edgeMatch[1].trim());
      const to = ensure(edgeMatch[4].trim());
      if (from && to) {
        edges.push({ from, to, label: mermaidLabel(edgeMatch[3] ?? '') });
      }
      continue;
    }
    ensure(line);
  }

  if (nodes.size === 0) {
    throw new Error('No se encontraron nodos de Mermaid en el texto.');
  }

  // Niveles por BFS desde los nodos sin entradas; el resto se coloca después.
  const incoming = new Map<string, number>();
  nodes.forEach((_node, id) => incoming.set(id, 0));
  for (const edge of edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }
  const level = new Map<string, number>();
  const queue: string[] = [];
  nodes.forEach((_node, id) => {
    if ((incoming.get(id) ?? 0) === 0) {
      level.set(id, 0);
      queue.push(id);
    }
  });
  if (queue.length === 0) {
    const first = nodes.keys().next().value as string;
    level.set(first, 0);
    queue.push(first);
  }
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const base = level.get(current) ?? 0;
    for (const edge of edges.filter((candidate) => candidate.from === current)) {
      const next = Math.max(level.get(edge.to) ?? 0, base + 1);
      if (!level.has(edge.to) || next > (level.get(edge.to) ?? 0)) {
        level.set(edge.to, next);
        queue.push(edge.to);
      }
    }
  }
  nodes.forEach((_node, id) => {
    if (!level.has(id)) level.set(id, 0);
  });

  const perLevel = new Map<number, number>();
  const items: BoardItem[] = [];
  const idMap = new Map<string, string>();
  const vertical = !/^(flowchart\s+)?LR\b/i.test(text);
  for (const [id, node] of nodes) {
    const depth = level.get(id) ?? 0;
    const index = perLevel.get(depth) ?? 0;
    perLevel.set(depth, index + 1);
    const w = node.kind === 'circle' ? 130 : 190;
    const h = node.kind === 'circle' ? 130 : 78;
    const x = vertical ? 60 + index * (w + 70) : 60 + depth * 280;
    const y = vertical ? 60 + depth * 160 : 60 + index * (h + 60);
    const shape = newShape(
      { x, y, w, h },
      node.kind === 'diamond' ? 'diamond' : node.kind === 'circle' || node.kind === 'round' ? 'ellipse' : 'rect',
      node.label,
    );
    shape.fill = '#FFFDF7';
    shape.stroke = '#16211E';
    shape.fontSize = 15;
    items.push(shape);
    idMap.set(id, shape.id);
  }
  for (const edge of edges) {
    const from = items.find((item) => item.id === idMap.get(edge.from));
    const to = items.find((item) => item.id === idMap.get(edge.to));
    if (!from || !to) continue;
    const connector = newConnector(
      { itemId: from.id, x: from.x + from.w, y: from.y + from.h / 2, side: 'right' },
      { itemId: to.id, x: to.x, y: to.y + to.h / 2, side: 'left' },
    );
    connector.lineType = 'elbow';
    connector.label = edge.label;
    connector.id = uid(9);
    items.push(connector);
  }
  return centerItems(items);
}

export type ImportFormat = 'excalidraw' | 'jam' | 'mermaid';

export function importFromText(format: ImportFormat, text: string): BoardItem[] {
  if (format === 'excalidraw') return parseExcalidraw(text);
  if (format === 'jam') return parseJam(text);
  return parseMermaid(text);
}
