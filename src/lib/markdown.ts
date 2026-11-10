import type { Board, BoardItem, FrameItem } from '../types';
import { itemRect } from './geometry';
import { safeFileName } from './export';

function textOf(item: BoardItem): string {
  if ('text' in item && typeof item.text === 'string') return item.text;
  if (item.type === 'frame') return item.title;
  if (item.type === 'flashcard') return `${item.front} ${item.back}`;
  if (item.type === 'file') return item.name;
  if (item.type === 'timer') return item.label;
  if (item.type === 'sticker') return item.symbol;
  return '';
}

function itemToMarkdown(item: BoardItem, labels: Map<string, string>): string {
  switch (item.type) {
    case 'sticky':
    case 'shape':
    case 'text':
      return item.text.trim() ? item.text.trim() : '';
    case 'markdown':
      return item.text.trim();
    case 'code':
      return `\`\`\`${item.language || ''}\n${item.text}\n\`\`\``;
    case 'table': {
      if (item.rows.length === 0) return '';
      const width = Math.max(...item.rows.map((row) => row.length));
      const rows = item.rows.map((row) =>
        Array.from({ length: width }, (_, index) => row[index] ?? ''),
      );
      const header = rows[0];
      const separator = header.map(() => '---');
      const body = rows.slice(1);
      return [header, separator, ...body]
        .map((row) => `| ${row.join(' | ')} |`)
        .join('\n');
    }
    case 'flashcard':
      return `**Pregunta:** ${item.front || '—'}\n\n**Respuesta:** ${item.back || '—'}`;
    case 'frame':
      return `## ${item.title || 'Marco'}`;
    case 'connector': {
      const from = item.from.itemId ? labels.get(item.from.itemId) ?? 'objeto' : 'punto';
      const to = item.to.itemId ? labels.get(item.to.itemId) ?? 'objeto' : 'punto';
      const label = item.label ? ` · ${item.label}` : '';
      return `- ${from} → ${to}${label}`;
    }
    case 'file': {
      if (item.url) return `- [${item.name}](${item.url})`;
      return `- Archivo: **${item.name}** (${item.mime || 'binario'})`;
    }
    case 'image':
      return item.alt ? `![${item.alt}](${item.src.slice(0, 200)})` : '';
    case 'sticker':
      return item.symbol;
    case 'timer':
      return `⏱ ${item.label} · ${Math.round(item.duration / 60)} min`;
    case 'draw':
      return '';
    default:
      return '';
  }
}

/** Exporta el tablero a Markdown agrupado por marcos y secciones. */
export function boardToMarkdown(board: Board): string {
  const lines: string[] = [];
  lines.push(`# ${board.name || 'Tablero tiza'}`);
  lines.push('');
  lines.push(`> Exportado desde tiza el ${new Date().toLocaleDateString('es-ES')}.`);
  lines.push('');
  const labels = new Map<string, string>();
  for (const item of board.items) {
    const text = textOf(item).replace(/\s+/g, ' ').trim();
    if (text) labels.set(item.id, text.slice(0, 48));
  }
  const frames = board.items.filter((item): item is FrameItem => item.type === 'frame');
  const used = new Set<string>();
  const renderItems = (items: BoardItem[]) => {
    for (const item of items) {
      if (item.type === 'frame' || used.has(item.id)) continue;
      used.add(item.id);
      const markdown = itemToMarkdown(item, labels);
      if (!markdown) continue;
      lines.push(markdown);
      lines.push('');
    }
  };
  const ordered = [...frames].sort((a, b) => (Math.abs(a.y - b.y) > 80 ? a.y - b.y : a.x - b.x));
  for (const frame of ordered) {
    lines.push(`## ${frame.title || 'Marco'}`);
    lines.push('');
    const frameRect = itemRect(frame);
    const inside = board.items.filter((item) => {
      if (item.id === frame.id || item.type === 'frame') return false;
      const rect = itemRect(item);
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      return (
        cx >= frameRect.x &&
        cx <= frameRect.x + frameRect.w &&
        cy >= frameRect.y &&
        cy <= frameRect.y + frameRect.h
      );
    });
    used.add(frame.id);
    renderItems(inside);
  }
  const rest = board.items.filter((item) => !used.has(item.id));
  if (rest.length > 0) {
    lines.push('## Otros elementos');
    lines.push('');
    renderItems(rest);
  }
  if (board.comments.length > 0) {
    lines.push('## Comentarios');
    lines.push('');
    for (const comment of board.comments) {
      lines.push(
        `- ${comment.resolved ? '✓' : '○'} **${comment.author}**: ${comment.text}`,
      );
    }
    lines.push('');
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

export function downloadBoardMarkdown(board: Board): void {
  const markdown = boardToMarkdown(board);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(board.name)}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
