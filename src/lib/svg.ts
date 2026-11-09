import type { Board, ConnectorItem, FileItem, FrameItem, Point, Theme } from '../types';
import {
  connectorLabelPoint,
  connectorPathPoints,
  boundsOfItems,
  isConnector,
} from './geometry';
import { readableInk } from './theme';

export interface SvgExportOptions {
  theme?: Theme;
  selected?: string[];
  padding?: number;
}

interface Palette {
  paper: string;
  ink: string;
  muted: string;
  surface: string;
  frame: string;
  brand: string;
}

function paletteFor(theme: Theme | undefined): Palette {
  return theme === 'dark'
    ? {
        paper: '#141917',
        ink: '#E9EEE9',
        muted: 'rgba(233,238,233,0.5)',
        surface: '#202824',
        frame: '#34423B',
        brand: '#63D6BE',
      }
    : {
        paper: '#F4F1E8',
        ink: '#16211E',
        muted: 'rgba(22,33,30,0.5)',
        surface: '#FFFDF7',
        frame: '#E3DCCB',
        brand: '#0E5B4F',
      };
}

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const FONT = "Inter, 'Segoe UI', system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'Cascadia Mono', monospace";

function wrapLines(text: string, maxWidth: number, fontSize: number): string[] {
  if (!text) return [];
  const perLine = Math.max(1, Math.floor(maxWidth / (fontSize * 0.56)));
  const result: string[] = [];
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    if (!paragraph) {
      result.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length <= perLine) {
        line = candidate;
      } else {
        if (line) result.push(line);
        line = word.slice(0, perLine);
      }
    }
    if (line) result.push(line);
  }
  return result;
}

function textLines(
  lines: string[],
  x: number,
  y: number,
  fontSize: number,
  lineHeight: number,
  options: {
    fill: string;
    weight?: number;
    family?: string;
    anchor?: 'start' | 'middle' | 'end';
    baseline?: string;
  },
): string {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" fill="${options.fill}" font-family="${
          options.family ?? FONT
        }" font-size="${fontSize}" font-weight="${options.weight ?? 400}" text-anchor="${
          options.anchor ?? 'start'
        }" dominant-baseline="${options.baseline ?? 'auto'}">${escapeXml(line)}</text>`,
    )
    .join('');
}

function arrowPath(tip: Point, from: Point, size: number): string {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const one = {
    x: tip.x - size * Math.cos(angle - Math.PI / 7),
    y: tip.y - size * Math.sin(angle - Math.PI / 7),
  };
  const two = {
    x: tip.x - size * Math.cos(angle + Math.PI / 7),
    y: tip.y - size * Math.sin(angle + Math.PI / 7),
  };
  return `M ${tip.x} ${tip.y} L ${one.x} ${one.y} L ${two.x} ${two.y} Z`;
}

function capMarkup(
  cap: ConnectorItem['endCap'],
  tip: Point,
  from: Point,
  size: number,
  color: string,
): string {
  if (!cap || cap === 'none') return '';
  if (cap === 'arrow') {
    return `<path d="${arrowPath(tip, from, size)}" fill="${color}"/>`;
  }
  if (cap === 'dot') {
    return `<circle cx="${tip.x}" cy="${tip.y}" r="${Math.max(2.5, size * 0.26)}" fill="${color}"/>`;
  }
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x) + Math.PI;
  const prongs = cap === 'crowfoot-many' ? [-0.72, 0, 0.72] : [-0.6, 0.6];
  const barAngle = angle + Math.PI / 2;
  const bar = size * 0.55;
  const lines = prongs
    .map((offset) => {
      const a = angle + offset;
      return `<line x1="${tip.x}" y1="${tip.y}" x2="${
        tip.x + Math.cos(a) * size * 0.95
      }" y2="${tip.y + Math.sin(a) * size * 0.95}" stroke="${color}" stroke-width="${
        Math.max(1.2, size * 0.18)
      }" stroke-linecap="round"/>`;
    })
    .join('');
  return `${lines}<line x1="${tip.x + Math.cos(barAngle) * bar}" y1="${
    tip.y + Math.sin(barAngle) * bar
  }" x2="${tip.x - Math.cos(barAngle) * bar}" y2="${
    tip.y - Math.sin(barAngle) * bar
  }" stroke="${color}" stroke-width="${Math.max(1.2, size * 0.18)}" stroke-linecap="round"/>`;
}

function frameMarkup(frame: FrameItem, palette: Palette, selected: boolean): string {
  const background = frame.background ?? 'plain';
  const pattern: string[] = [];
  const { x, y, w, h } = frame;
  if (background === 'grid' || background === 'axes') {
    for (let gx = x + 32; gx < x + w; gx += 32) {
      pattern.push(
        `<line x1="${gx}" y1="${y}" x2="${gx}" y2="${y + h}" stroke="${palette.frame}" stroke-width="0.8" opacity="0.65"/>`,
      );
    }
    for (let gy = y + 32; gy < y + h; gy += 32) {
      pattern.push(
        `<line x1="${x}" y1="${gy}" x2="${x + w}" y2="${gy}" stroke="${palette.frame}" stroke-width="0.8" opacity="0.65"/>`,
      );
    }
    if (background === 'axes') {
      pattern.push(
        `<line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="${palette.brand}" stroke-width="1.4"/>`,
        `<line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${palette.brand}" stroke-width="1.4"/>`,
      );
    }
  } else if (background === 'dots') {
    for (let gx = x + 14; gx < x + w; gx += 28) {
      for (let gy = y + 14; gy < y + h; gy += 28) {
        pattern.push(
          `<circle cx="${gx}" cy="${gy}" r="1.1" fill="${palette.frame}" opacity="0.8"/>`,
        );
      }
    }
  } else if (background === 'lines') {
    for (let gy = y + 34; gy < y + h; gy += 34) {
      pattern.push(
        `<line x1="${x + 18}" y1="${gy}" x2="${x + w - 18}" y2="${gy}" stroke="${palette.frame}" stroke-width="0.9" opacity="0.55"/>`,
      );
    }
  } else if (background === 'music') {
    for (let gy = y + 40; gy + 36 < y + h; gy += 90) {
      for (let line = 0; line < 5; line += 1) {
        pattern.push(
          `<line x1="${x + 24}" y1="${gy + line * 9}" x2="${x + w - 24}" y2="${
            gy + line * 9
          }" stroke="${palette.frame}" stroke-width="0.9" opacity="0.6"/>`,
        );
      }
    }
  }
  const title = frame.title || 'Marco';
  const pillWidth = Math.max(80, title.length * 7.5 + 34);
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${
    frame.fill || palette.surface
  }" stroke="${selected ? palette.brand : palette.frame}" stroke-width="${
    selected ? 2 : 1.2
  }"/>${pattern.join('')}<rect x="${x}" y="${y - 36}" width="${pillWidth}" height="26" rx="7" fill="${
    palette.surface
  }" stroke="${palette.frame}"/><circle cx="${x + 12}" cy="${
    y - 23
  }" r="3" fill="${palette.brand}"/><text x="${x + 21}" y="${
    y - 18.5
  }" fill="${palette.ink}" font-family="${FONT}" font-size="13" font-weight="600">${escapeXml(
    title,
  )}</text></g>`;
}

function fileMarkup(item: FileItem, palette: Palette): string {
  const meta = [item.kind.toUpperCase(), item.pages ? `${item.page ?? 1}/${item.pages}` : '']
    .filter(Boolean)
    .join(' · ');
  return `<g><rect x="${item.x}" y="${item.y}" width="${item.w}" height="${
    item.h
  }" rx="12" fill="${palette.surface}" stroke="${palette.frame}"/>${textLines(
    wrapLines(item.name, item.w - 36, 14).slice(0, 3),
    item.x + 18,
    item.y + 28,
    14,
    18,
    { fill: palette.ink, weight: 600 },
  )}<text x="${item.x + 18}" y="${item.y + item.h - 18}" fill="${
    palette.muted
  }" font-family="${MONO}" font-size="10">${escapeXml(meta)}</text></g>`;
}

function connectorMarkup(
  item: ConnectorItem,
  board: Board,
  palette: Palette,
  theme: Theme | undefined,
): string {
  const points = connectorPathPoints(item, board.items);
  if (points.length < 2) return '';
  const color = readableInk(item.color, theme ?? 'light');
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const startCap = item.startCap ?? (item.arrowStart ? 'arrow' : 'none');
  const endCap = item.endCap ?? (item.arrowEnd ? 'arrow' : 'none');
  const size = 11 + item.strokeWidth;
  const label = item.label
    ? (() => {
        const mid = connectorLabelPoint(item, board.items);
        const width = item.label.length * 7 + 16;
        return `<rect x="${mid.x - width / 2}" y="${mid.y - 11}" width="${width}" height="22" rx="6" fill="${
          palette.surface
        }" stroke="${palette.frame}"/><text x="${mid.x}" y="${
          mid.y + 4
        }" fill="${palette.ink}" font-family="${FONT}" font-size="12" font-weight="600" text-anchor="middle">${escapeXml(
          item.label,
        )}</text>`;
      })()
    : '';
  return `<g><path d="${path}" fill="none" stroke="${color}" stroke-width="${
    item.strokeWidth
  }" stroke-linecap="round" stroke-linejoin="round" ${
    item.dashed ? 'stroke-dasharray="8 6"' : ''
  }/>${capMarkup(endCap, points[points.length - 1], points[points.length - 2], size, color)}${capMarkup(
    startCap,
    points[0],
    points[1],
    size,
    color,
  )}${label}</g>`;
}

export function renderBoardSVG(board: Board, options: SvgExportOptions = {}): string {
  const theme = options.theme;
  const palette = paletteFor(theme);
  const padding = options.padding ?? 48;
  const selectedSet = new Set(options.selected ?? []);
  const scope =
    selectedSet.size > 0
      ? board.items.filter((item) => selectedSet.has(item.id))
      : board.items;
  const bounds = boundsOfItems(scope) ?? { x: 0, y: 0, w: 1200, h: 800 };
  const width = Math.ceil(bounds.w + padding * 2);
  const height = Math.ceil(bounds.h + padding * 2);
  const viewX = bounds.x - padding;
  const viewY = bounds.y - padding;
  const parts: string[] = [];
  parts.push(
    `<rect x="${viewX}" y="${viewY}" width="${width}" height="${height}" fill="${
      theme === 'dark' ? palette.paper : '#F4F1E8'
    }"/>`,
  );

  for (const frame of board.items.filter(
    (item): item is FrameItem => item.type === 'frame' && !item.hidden,
  )) {
    parts.push(frameMarkup(frame, palette, selectedSet.has(frame.id)));
  }

  for (const item of board.items) {
    if (item.hidden || item.type === 'frame') continue;
    if (selectedSet.size > 0 && !selectedSet.has(item.id)) continue;
    if (item.type === 'sticky') {
      const fontSize = item.fontSize || 16;
      const paddingX = Math.max(12, Math.min(20, item.w * 0.1));
      const lines = wrapLines(item.text || 'Escribe algo…', item.w - paddingX * 2, fontSize);
      parts.push(
        `<g><rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="6" fill="${
          item.fill
        }" stroke="rgba(22,33,30,0.08)"/>${textLines(
          lines,
          item.x + paddingX,
          item.y + paddingX + fontSize,
          fontSize,
          fontSize * 1.38,
          { fill: item.textColor || palette.ink, weight: 500 },
        )}</g>`,
      );
    } else if (item.type === 'shape') {
      const shapeMarkup =
        item.shape === 'ellipse'
          ? `<ellipse cx="${item.x + item.w / 2}" cy="${item.y + item.h / 2}" rx="${
              item.w / 2
            }" ry="${item.h / 2}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${
              item.strokeWidth
            }"/>`
          : item.shape === 'diamond'
            ? `<polygon points="${item.x + item.w / 2},${item.y} ${item.x + item.w},${
                item.y + item.h / 2
              } ${item.x + item.w / 2},${item.y + item.h} ${item.x},${
                item.y + item.h / 2
              }" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${
                item.strokeWidth
              }"/>`
            : `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${
                item.h
              }" rx="${item.edge === 'sharp' ? 0 : item.radius}" fill="${
                item.fill
              }" stroke="${item.stroke}" stroke-width="${item.strokeWidth}"/>`;
      const lines = wrapLines(item.text, item.w - 36, item.fontSize || 16);
      parts.push(
        `<g>${shapeMarkup}${textLines(
          lines,
          item.x + item.w / 2,
          item.y + item.h / 2 - ((lines.length - 1) * (item.fontSize || 16) * 1.3) / 2,
          item.fontSize || 16,
          (item.fontSize || 16) * 1.3,
          { fill: item.textColor || palette.ink, weight: 500, anchor: 'middle', baseline: 'middle' },
        )}</g>`,
      );
    } else if (item.type === 'text') {
      const fontSize = item.fontSize || 24;
      const lines = wrapLines(item.text || 'Escribe algo…', item.w, fontSize);
      parts.push(
        textLines(
          lines,
          item.align === 'center' ? item.x + item.w / 2 : item.x,
          item.y + fontSize,
          fontSize,
          fontSize * 1.28,
          {
            fill: readableInk(item.color, theme ?? 'light'),
            weight: item.fontWeight,
            family: item.fontFamily === 'mono' ? MONO : FONT,
            anchor: item.align === 'center' ? 'middle' : 'start',
          },
        ),
      );
    } else if (item.type === 'draw') {
      const path = item.points
        .map(
          (point, index) =>
            `${index === 0 ? 'M' : 'L'} ${item.x + point.x} ${item.y + point.y}`,
        )
        .join(' ');
      parts.push(
        `<path d="${path}" fill="none" stroke="${readableInk(
          item.color,
          theme ?? 'light',
        )}" stroke-width="${item.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${
          item.opacity ?? 1
        }"/>`,
      );
    } else if (item.type === 'image') {
      parts.push(
        `<g><clipPath id="clip-${item.id}"><rect x="${item.x}" y="${item.y}" width="${
          item.w
        }" height="${item.h}" rx="${item.radius}"/></clipPath><image href="${escapeXml(
          item.src,
        )}" x="${item.x}" y="${item.y}" width="${item.w}" height="${
          item.h
        }" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${item.id})"/><rect x="${
          item.x
        }" y="${item.y}" width="${item.w}" height="${item.h}" rx="${
          item.radius
        }" fill="none" stroke="${palette.frame}"/></g>`,
      );
    } else if (item.type === 'file') {
      parts.push(fileMarkup(item, palette));
    } else if (item.type === 'timer') {
      const remaining =
        item.running && item.endsAt
          ? Math.max(0, Math.ceil((item.endsAt - Date.now()) / 1000))
          : item.remaining;
      const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
      const seconds = String(remaining % 60).padStart(2, '0');
      parts.push(
        `<g><rect x="${item.x}" y="${item.y}" width="${item.w}" height="${
          item.h
        }" rx="14" fill="${palette.surface}" stroke="${palette.frame}"/><text x="${
          item.x + item.w / 2
        }" y="${item.y + item.h / 2}" fill="${palette.ink}" font-family="${MONO}" font-size="32" font-weight="600" text-anchor="middle" dominant-baseline="middle">${minutes}:${seconds}</text><text x="${
          item.x + item.w / 2
        }" y="${item.y + item.h - 16}" fill="${palette.muted}" font-family="${FONT}" font-size="12" text-anchor="middle">${escapeXml(
          item.label,
        )}</text></g>`,
      );
    } else if (isConnector(item)) {
      parts.push(connectorMarkup(item, board, palette, theme));
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewX} ${viewY} ${width} ${height}">${parts.join(
    '',
  )}</svg>`;
}
