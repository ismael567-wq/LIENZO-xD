import { describe, expect, it } from 'vitest';
import { boardToFile, parseBoardFile } from '../src/lib/storage';
import { createBoard } from '../src/lib/templates';

describe('board files', () => {
  it('round-trips an exported board', () => {
    const board = createBoard('retro');
    const file = boardToFile(board);
    const parsed = parseBoardFile(JSON.stringify(file));
    expect(parsed.id).toBe(board.id);
    expect(parsed.name).toBe(board.name);
    expect(parsed.items).toHaveLength(board.items.length);
  });

  it('accepts a raw board payload', () => {
    const board = createBoard('blank');
    expect(parseBoardFile(JSON.stringify(board)).id).toBe(board.id);
  });

  it('rejects unrelated JSON', () => {
    expect(() => parseBoardFile(JSON.stringify({ hello: 'world' }))).toThrow();
    expect(() => parseBoardFile('not json')).toThrow();
  });
});
