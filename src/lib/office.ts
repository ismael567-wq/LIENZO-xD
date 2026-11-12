import { strFromU8, unzipSync } from 'fflate';
import type { BoardItem } from '../types';
import { newFrame, newTable, newText } from './factory';
import { parseDelimited } from './v2';

/**
 * Conversión local de Office y CSV a objetos nativos.
 * DOCX y PPTX son contenedores ZIP con XML: se leen en el navegador,
 * sin subir nada y sin depender de servicios externos.
 */

export type OfficeKind = 'docx' | 'pptx' | 'csv';

export function officeKindOf(name: string, mime = ''): OfficeKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.docx') || mime.includes('wordprocessingml')) return 'docx';
  if (lower.endsWith('.pptx') || mime.includes('presentationml')) return 'pptx';
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || mime.includes('csv')) return 'csv';
  return null;
}

export function canConvertOffice(name: string, mime = ''): boolean {
  return officeKindOf(name, mime) !== null;
}

function parseXml(xml: string): Document {
  if (typeof DOMParser === 'undefined') {
    throw new Error('La conversión de Office necesita un navegador.');
  }
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('El documento XML interno está dañado.');
  }
  return doc;
}

function textsOf(element: Element, tag: string): string {
  return Array.from(element.getElementsByTagName(tag))
    .map((node) => node.textContent ?? '')
    .join('')
    .trim();
}

/** Párrafos de un .docx, incluidas las celdas de tabla. */
export function extractDocxParagraphs(buffer: ArrayBuffer): string[] {
  const files = unzipSync(new Uint8Array(buffer));
  const entry = files['word/document.xml'];
  if (!entry) throw new Error('El .docx no contiene word/document.xml.');
  const doc = parseXml(strFromU8(entry));
  const paragraphs = Array.from(doc.getElementsByTagName('w:p'))
    .map((paragraph) => textsOf(paragraph, 'w:t'))
    .filter((text) => text.length > 0);
  return paragraphs;
}

export interface OfficeSlide {
  title: string;
  lines: string[];
}

/** Diapositivas de un .pptx en orden numérico, con su primer texto como título. */
export function extractPptxSlides(buffer: ArrayBuffer): OfficeSlide[] {
  const files = unzipSync(new Uint8Array(buffer));
  const names = Object.keys(files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      return na - nb;
    });
  if (names.length === 0) throw new Error('El .pptx no contiene diapositivas.');
  return names.map((name, index) => {
    const doc = parseXml(strFromU8(files[name]));
    const lines = Array.from(doc.getElementsByTagName('a:p'))
      .map((paragraph) => textsOf(paragraph, 'a:t'))
      .filter((text) => text.length > 0);
    const title = lines[0] ?? `Diapositiva ${index + 1}`;
    return { title, lines: lines.slice(1) };
  });
}

function frameWithBody(
  name: string,
  lines: string[],
  x: number,
  y: number,
  width = 620,
  fontSize = 15,
): BoardItem[] {
  const height = Math.max(240, Math.min(1400, 90 + lines.length * 24));
  const frame = newFrame({ x, y, w: width, h: height }, name);
  const text = newText({ x: x + 24, y: y + 56 }, lines.join('\n'));
  text.w = width - 48;
  text.h = height - 82;
  text.fontSize = fontSize;
  text.color = '#26332F';
  text.fontFamily = 'sans';
  return [frame, text];
}

function docxItems(paragraphs: string[], name: string, point: { x: number; y: number }): BoardItem[] {
  if (paragraphs.length === 0) return [];
  const items: BoardItem[] = [];
  const chunk = 26;
  const pages = Math.ceil(paragraphs.length / chunk);
  for (let index = 0; index < pages; index += 1) {
    const slice = paragraphs.slice(index * chunk, (index + 1) * chunk);
    const suffix = pages > 1 ? ` · ${index + 1}/${pages}` : '';
    items.push(
      ...frameWithBody(
        `${name}${suffix}`,
        slice,
        point.x + index * 680,
        point.y,
        620,
        15,
      ),
    );
  }
  return items;
}

function pptxItems(slides: OfficeSlide[], name: string, point: { x: number; y: number }): BoardItem[] {
  const items: BoardItem[] = [];
  slides.forEach((slide, index) => {
    const x = point.x + (index % 2) * 610;
    const y = point.y + Math.floor(index / 2) * 430;
    const frame = newFrame({ x, y, w: 560, h: 360 }, slide.title || `${name} · ${index + 1}`);
    items.push(frame);
    const body = slide.lines.length > 0 ? slide.lines.join('\n') : 'Diapositiva sin texto.';
    const text = newText({ x: x + 24, y: y + 58 }, body);
    text.w = 512;
    text.h = 274;
    text.fontSize = 16;
    text.color = '#26332F';
    items.push(text);
  });
  return items;
}

function csvItems(text: string, name: string, point: { x: number; y: number }): BoardItem[] {
  const parsed = parseDelimited(text);
  if (parsed.rows.length === 0) return [];
  const rows = parsed.rows.slice(0, 60).map((row) => row.slice(0, 16));
  const columns = Math.max(1, ...rows.map((row) => row.length));
  const table = newTable(point, rows);
  table.w = Math.max(380, columns * 118);
  table.h = Math.max(180, rows.length * 30 + 16);
  table.fontSize = 12;
  table.header = true;
  const title = newText({ x: point.x - 200, y: point.y - 150 }, name);
  title.fontSize = 18;
  title.w = table.w;
  return [title, table];
}

/** Convierte el archivo en marcos, textos o una tabla nativa. */
export function officeToItems(
  name: string,
  mime: string,
  buffer: ArrayBuffer,
  point: { x: number; y: number },
): BoardItem[] {
  const kind = officeKindOf(name, mime);
  if (!kind) return [];
  if (kind === 'docx') {
    return docxItems(extractDocxParagraphs(buffer), name, point);
  }
  if (kind === 'pptx') {
    return pptxItems(extractPptxSlides(buffer), name, point);
  }
  const text = new TextDecoder('utf-8').decode(new Uint8Array(buffer));
  return csvItems(text, name, point);
}
