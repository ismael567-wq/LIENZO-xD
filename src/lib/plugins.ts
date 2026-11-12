import type { BoardItem, ShapeKind } from '../types';
import { newFrame, newShape, newSticker, newStickyRect, newText } from './factory';

/**
 * Plugins declarativos en JSON: formas, notas, textos, marcos y stickers.
 * No ejecutan código, así que un plugin comunitario no puede tocar la app.
 */

export interface PluginItemSpec {
  type: 'sticky' | 'text' | 'shape' | 'frame' | 'sticker';
  text?: string;
  title?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  fill?: string;
  color?: string;
  shape?: ShapeKind;
  symbol?: string;
  fontSize?: number;
}

export interface BoardPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  items: PluginItemSpec[];
}

const STORAGE = 'lienzo:plugins:v1';
const TYPES = new Set(['sticky', 'text', 'shape', 'frame', 'sticker']);
const SHAPES = new Set(['rect', 'ellipse', 'diamond']);

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function cleanText(value: unknown, max = 800): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** Valida y normaliza un plugin; lanza un error legible si no cumple el esquema. */
export function validatePlugin(raw: unknown): BoardPlugin {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('El plugin debe ser un objeto JSON.');
  }
  const data = raw as Record<string, unknown>;
  const id = cleanText(data.id, 48).trim();
  const name = cleanText(data.name, 60).trim();
  if (!/^[a-zA-Z0-9._-]{2,48}$/.test(id)) {
    throw new Error('El id debe tener entre 2 y 48 caracteres: letras, números, . _ -');
  }
  if (!name) throw new Error('El plugin necesita un nombre.');
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('El plugin necesita al menos un objeto en "items".');
  }
  if (data.items.length > 40) throw new Error('Un plugin no puede superar 40 objetos.');
  const items: PluginItemSpec[] = data.items.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`El objeto ${index + 1} no es válido.`);
    }
    const item = entry as Record<string, unknown>;
    const type = cleanText(item.type, 20).toLowerCase() as PluginItemSpec['type'];
    if (!TYPES.has(type)) {
      throw new Error(`El tipo "${type}" del objeto ${index + 1} no está permitido.`);
    }
    const spec: PluginItemSpec = {
      type,
      x: clampNumber(item.x, 0, -10_000, 10_000),
      y: clampNumber(item.y, 0, -10_000, 10_000),
      w: clampNumber(item.w, type === 'sticker' ? 96 : 240, 20, 4_000),
      h: clampNumber(item.h, type === 'sticker' ? 96 : 140, 20, 4_000),
      text: cleanText(item.text),
      title: cleanText(item.title, 120),
      color: cleanText(item.color, 24) || undefined,
      fill: cleanText(item.fill, 24) || undefined,
      fontSize: clampNumber(item.fontSize, 16, 8, 96),
      symbol: cleanText(item.symbol, 8) || undefined,
    };
    const shape = cleanText(item.shape, 20) as ShapeKind;
    if (type === 'shape' && SHAPES.has(shape)) spec.shape = shape;
    return spec;
  });
  return {
    id,
    name,
    version: cleanText(data.version, 16) || '1.0',
    description: cleanText(data.description, 240),
    items,
  };
}

export function loadPlugins(): BoardPlugin[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      try {
        return [validatePlugin(entry)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function savePlugins(plugins: BoardPlugin[]): void {
  localStorage.setItem(STORAGE, JSON.stringify(plugins));
}

export function installPlugin(raw: unknown): BoardPlugin {
  const plugin = validatePlugin(raw);
  const plugins = loadPlugins().filter((entry) => entry.id !== plugin.id);
  savePlugins([...plugins, plugin]);
  return plugin;
}

export function removePlugin(id: string): void {
  savePlugins(loadPlugins().filter((entry) => entry.id !== id));
}

/** Convierte las piezas declarativas en objetos reales del tablero. */
export function pluginToItems(plugin: BoardPlugin, point: { x: number; y: number }): BoardItem[] {
  return plugin.items.map((spec) => {
    const target = { x: point.x + (spec.x ?? 0), y: point.y + (spec.y ?? 0) };
    if (spec.type === 'sticky') {
      const sticky = newStickyRect(
        { x: target.x, y: target.y, w: spec.w ?? 240, h: spec.h ?? 140 },
        0,
      );
      sticky.text = spec.text || plugin.name;
      if (spec.fill) sticky.fill = spec.fill;
      if (spec.fontSize) sticky.fontSize = spec.fontSize;
      return sticky;
    }
    if (spec.type === 'frame') {
      const frame = newFrame(
        { x: target.x, y: target.y, w: spec.w ?? 360, h: spec.h ?? 260 },
        spec.title || plugin.name,
      );
      if (spec.fill) frame.fill = spec.fill;
      return frame;
    }
    if (spec.type === 'shape') {
      const shape = newShape(
        { x: target.x, y: target.y, w: spec.w ?? 220, h: spec.h ?? 120 },
        spec.shape ?? 'rect',
        spec.text ?? '',
      );
      if (spec.fill) shape.fill = spec.fill;
      if (spec.color) {
        shape.stroke = spec.color;
        shape.textColor = spec.color;
      }
      if (spec.fontSize) shape.fontSize = spec.fontSize;
      return shape;
    }
    if (spec.type === 'sticker') {
      const sticker = newSticker(target, spec.symbol || '⭐');
      sticker.w = spec.w ?? 96;
      sticker.h = spec.h ?? 96;
      return sticker;
    }
    const text = newText(target, spec.text || plugin.name);
    text.w = spec.w ?? 320;
    text.h = spec.h ?? 60;
    if (spec.fontSize) text.fontSize = spec.fontSize;
    if (spec.color) text.color = spec.color;
    return text;
  });
}

export const PLUGIN_EXAMPLE = JSON.stringify(
  {
    id: 'retro-kit',
    name: 'Kit de retrospectiva',
    version: '1.0',
    description: 'Tres columnas y una nota de bienvenida.',
    items: [
      { type: 'frame', title: 'Qué funcionó', x: 0, y: 0, w: 300, h: 420, fill: '#F7F3EA' },
      { type: 'frame', title: 'Qué mejorar', x: 340, y: 0, w: 300, h: 420, fill: '#FBF8F1' },
      { type: 'frame', title: 'Acciones', x: 680, y: 0, w: 300, h: 420, fill: '#F7F3EA' },
      {
        type: 'sticky',
        text: 'Escribe una idea por nota',
        x: 20,
        y: 60,
        w: 260,
        h: 120,
        fill: '#F6E27A',
      },
    ],
  },
  null,
  2,
);
