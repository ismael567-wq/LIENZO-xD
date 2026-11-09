import type { Board, Theme } from '../types';
import { boardContentBounds, renderBoard } from './canvasRenderer';
import { boundsOfItems, fitViewport, getFrameSlides } from './geometry';
import { boardToFile } from './storage';
import { renderBoardSVG } from './svg';
import { buildPdfBlob, type PdfPageImage } from './pdf';

export function safeFileName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tiza'
  );
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportBoardJSON(board: Board): void {
  const payload = JSON.stringify(boardToFile(board), null, 2);
  downloadBlob(
    new Blob([payload], { type: 'application/json' }),
    `${safeFileName(board.name)}.tiza.json`,
  );
}

export interface WorkspaceFile {
  app: 'tiza';
  version: 1;
  kind: 'workspace';
  exportedAt: string;
  boards: Board[];
}

export function workspaceToFile(boards: Board[]): WorkspaceFile {
  return {
    app: 'tiza',
    version: 1,
    kind: 'workspace',
    exportedAt: new Date().toISOString(),
    boards,
  };
}

export function exportWorkspace(boards: Board[]): void {
  const payload = JSON.stringify(workspaceToFile(boards), null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([payload], { type: 'application/json' }),
    `tiza-workspace-${stamp}.tiza`,
  );
}

export function parseWorkspaceFile(text: string): Board[] {
  const parsed = JSON.parse(text) as unknown;
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as WorkspaceFile).boards)
      ? (parsed as WorkspaceFile).boards
      : null;
  if (!list) throw new Error('El archivo no contiene un workspace de tiza.');
  const boards: Board[] = [];
  for (const candidate of list) {
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      typeof (candidate as Board).name !== 'string' ||
      !Array.isArray((candidate as Board).items)
    ) {
      continue;
    }
    const board = structuredClone(candidate as Board);
    board.comments = Array.isArray(board.comments) ? board.comments : [];
    board.background = board.background ?? 'dots';
    boards.push(board);
  }
  if (boards.length === 0) throw new Error('No encontramos tableros válidos en el archivo.');
  return boards;
}

export interface SvgExportOptions {
  selected?: string[];
  theme?: Theme;
}

export function exportBoardSVG(board: Board, options: SvgExportOptions = {}): void {
  const svg = renderBoardSVG(board, options);
  const suffix = options.selected && options.selected.length > 0 ? '-seleccion' : '';
  downloadBlob(
    new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
    `${safeFileName(board.name)}${suffix}.svg`,
  );
}

function canvasToJpegBytes(canvas: HTMLCanvasElement): Uint8Array {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export interface PdfExportOptions {
  theme?: Theme;
}

/**
 * Una página por marco. Si no hay marcos, una sola página con todo el
 * contenido. Cada página se rasteriza y se incrusta como JPEG en un PDF
 * mínimo generado en cliente.
 */
export async function renderBoardPDFBlob(
  board: Board,
  options: PdfExportOptions = {},
): Promise<Blob> {
  const frames = getFrameSlides(board.items);
  const bounds = boardContentBounds(board) ?? { x: 0, y: 0, w: 1200, h: 800 };
  const rectangles =
    frames.length > 0
      ? frames.map((frame) => ({
          x: frame.x - 34,
          y: frame.y - 50,
          w: frame.w + 68,
          h: frame.h + 66,
        }))
      : [
          {
            x: bounds.x - 48,
            y: bounds.y - 48,
            w: bounds.w + 96,
            h: bounds.h + 96,
          },
        ];
  const pages: PdfPageImage[] = [];
  for (const rect of rectangles) {
    const width = Math.max(1, Math.ceil(rect.w));
    const height = Math.max(1, Math.ceil(rect.h));
    const dpr = Math.max(
      0.75,
      Math.min(2, 3200 / Math.max(width, height)),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo preparar la exportación a PDF.');
    renderBoard(ctx, board, {
      width,
      height,
      dpr,
      viewport: { x: -rect.x, y: -rect.y, zoom: 1 },
      theme: options.theme,
      preview: false,
      transparent: false,
      comments: false,
      selected: [],
    });
    pages.push({
      jpeg: canvasToJpegBytes(canvas),
      width: canvas.width,
      height: canvas.height,
    });
  }
  return buildPdfBlob(pages);
}

export async function exportBoardPDF(
  board: Board,
  options: PdfExportOptions = {},
): Promise<void> {
  const blob = await renderBoardPDFBlob(board, options);
  downloadBlob(blob, `${safeFileName(board.name)}.pdf`);
}

export interface PngExportOptions {
  /** Export only these element ids instead of the whole board. */
  selected?: string[];
  theme?: Theme;
  /** Skip comments and the paper background for a transparent PNG. */
  transparent?: boolean;
  /** Render at this multiplier instead of the automatic one. */
  scale?: number;
}

function scopedBoard(board: Board, selected?: string[]): Board {
  if (!selected || selected.length === 0) return board;
  const ids = new Set(selected);
  return { ...board, items: board.items.filter((item) => ids.has(item.id)) };
}

export async function renderBoardPNGBlob(
  board: Board,
  options: PngExportOptions = {},
): Promise<Blob> {
  const scoped = scopedBoard(board, options.selected);
  const selectionMode = Boolean(options.selected && options.selected.length > 0);
  const bounds = selectionMode
    ? boundsOfItems(scoped.items)
    : boardContentBounds(scoped);
  const padding = 72;
  const width = Math.max(selectionMode ? 200 : 1200, Math.ceil((bounds?.w ?? 1200) + padding * 2));
  const height = Math.max(selectionMode ? 200 : 800, Math.ceil((bounds?.h ?? 800) + padding * 2));
  const maxDimension = 4200;
  const autoScale = Math.min(2, maxDimension / Math.max(width, height));
  const scale = options.scale ?? autoScale;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la exportación.');
  const viewport = fitViewport(
    bounds ?? { x: 0, y: 0, w: 1200, h: 800 },
    width,
    height,
    padding,
    1,
  );
  renderBoard(ctx, scoped, {
    width,
    height,
    dpr: scale,
    viewport,
    theme: options.theme,
    transparent: options.transparent,
    preview: false,
    comments: !options.transparent,
    selected: [],
  });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error('No se pudo generar el PNG.')),
      'image/png',
    );
  });
}

export async function exportBoardPNG(
  board: Board,
  options: PngExportOptions = {},
): Promise<void> {
  const blob = await renderBoardPNGBlob(board, options);
  const suffix = options.selected && options.selected.length > 0 ? '-seleccion' : '';
  downloadBlob(blob, `${safeFileName(board.name)}${suffix}.png`);
}

/** Copy a PNG of the board (or the selection) to the system clipboard. */
export async function copyBoardPNG(
  board: Board,
  options: PngExportOptions = {},
): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('Este navegador no permite copiar imágenes al portapapeles.');
  }
  const blob = await renderBoardPNGBlob(board, options);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
    image.src = src;
  });
}

export async function fileToImage(
  file: File,
  maxDimension = 1600,
): Promise<{ src: string; width: number; height: number }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen.');
  }
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  if (scale >= 1 && dataUrl.length < 900000) {
    return { src: dataUrl, width: image.width, height: image.height };
  }
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { src: dataUrl, width: image.width, height: image.height };
  ctx.drawImage(image, 0, 0, width, height);
  const compressed = canvas.toDataURL('image/webp', 0.9);
  return { src: compressed, width, height };
}

export async function imageFileFromClipboard(
  event: ClipboardEvent,
): Promise<File | null> {
  const items = event.clipboardData?.items;
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}
