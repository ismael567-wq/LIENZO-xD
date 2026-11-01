import { describe, expect, it } from 'vitest';
import { createBoard, TEMPLATES } from '../src/lib/templates';
import { duplicateItems } from '../src/lib/factory';
import type { ConnectorItem } from '../src/types';

describe('templates', () => {
  it('creates every advertised template with unique ids', () => {
    for (const template of TEMPLATES) {
      const board = createBoard(template.id);
      expect(board.id).toBeTruthy();
      expect(board.name).toBeTruthy();
      const ids = board.items.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('builds a rich welcome board with frames', () => {
    const board = createBoard('welcome');
    expect(board.items.length).toBeGreaterThan(15);
    expect(board.items.filter((item) => item.type === 'frame')).toHaveLength(2);
    expect(board.items.some((item) => item.type === 'sticky')).toBe(true);
  });

  it('keeps connector references valid', () => {
    const board = createBoard('mindmap');
    const ids = new Set(board.items.map((item) => item.id));
    const connectors = board.items.filter(
      (item): item is ConnectorItem => item.type === 'connector',
    );
    expect(connectors.length).toBeGreaterThan(0);
    for (const connector of connectors) {
      expect(ids.has(connector.from.itemId ?? '')).toBe(true);
      expect(ids.has(connector.to.itemId ?? '')).toBe(true);
    }
  });

  it('remaps connector endpoints when duplicating a selection', () => {
    const board = createBoard('flow');
    const connectors = board.items.filter(
      (item): item is ConnectorItem => item.type === 'connector',
    );
    const connector = connectors[0];
    const selected = board.items.filter(
      (item) => item.id === connector.from.itemId || item.id === connector.to.itemId || item.id === connector.id,
    );
    const result = duplicateItems(board.items, selected.map((item) => item.id));
    const clone = result.items.find(
      (item): item is ConnectorItem => item.type === 'connector',
    );
    expect(clone).toBeTruthy();
    expect(result.newIds).toContain(clone?.from.itemId);
    expect(result.newIds).toContain(clone?.to.itemId);
    expect(clone?.from.itemId).not.toBe(connector.from.itemId);
  });
});
