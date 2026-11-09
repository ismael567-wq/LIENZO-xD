import { describe, expect, it } from 'vitest';
import type { Board, StickyItem } from '../src/types';
import { parseWorkspaceFile, workspaceToFile } from '../src/lib/export';
import { buildPdfBlob } from '../src/lib/pdf';
import { renderBoardSVG } from '../src/lib/svg';

const sticky = (id: string, text: string, hidden = false): StickyItem => ({
  id,
  type: 'sticky',
  x: 10,
  y: 20,
  w: 180,
  h: 180,
  text,
  fill: '#FFF3B0',
  textColor: '#16211E',
  fontSize: 16,
  author: 'Tú',
  updatedAt: 1,
  hidden,
});

const board = (name = 'Aula'): Board => ({
  id: 'board-1',
  name,
  createdAt: 1,
  updatedAt: 2,
  items: [sticky('s1', 'Visible'), sticky('s2', 'Oculto', true)],
  comments: [],
  background: 'dots',
});

describe('workspace .tiza', () => {
  it('exports and reimports every board', () => {
    const file = workspaceToFile([board('Aula'), board('Equipo')]);
    expect(file.app).toBe('tiza');
    expect(file.kind).toBe('workspace');
    const parsed = parseWorkspaceFile(JSON.stringify(file));
    expect(parsed).toHaveLength(2);
    expect(parsed.map((entry) => entry.name)).toEqual(['Aula', 'Equipo']);
    expect(parsed[0].items).toHaveLength(2);
  });

  it('accepts a bare board array and rejects unrelated files', () => {
    expect(parseWorkspaceFile(JSON.stringify([board()]))).toHaveLength(1);
    expect(() => parseWorkspaceFile('{"hello":"world"}')).toThrow();
    expect(() => parseWorkspaceFile('null')).toThrow();
  });
});

describe('pdf writer', () => {
  it('writes one page per supplied image with a valid xref and EOF', async () => {
    const blob = buildPdfBlob([
      { jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 100, height: 80 },
      { jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 120, height: 90 },
    ]);
    const text = await blob.text();
    expect(blob.type).toBe('application/pdf');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text).toContain('xref');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(2);
  });
});

describe('svg export', () => {
  it('draws visible items and skips hidden ones', () => {
    const svg = renderBoardSVG(board(), { theme: 'light' });
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Visible');
    expect(svg).not.toContain('Oculto');
  });
});
