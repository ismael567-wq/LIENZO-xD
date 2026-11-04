import { describe, expect, it } from 'vitest';
import { readableInk } from '../src/lib/theme';

describe('readableInk', () => {
  it('leaves light-theme colors untouched', () => {
    expect(readableInk('#16211E', 'light')).toBe('#16211E');
  });

  it('keeps already light colors in dark theme', () => {
    expect(readableInk('#E9EEE9', 'dark')).toBe('#E9EEE9');
  });

  it('lightens dark ink for the dark canvas', () => {
    const lifted = readableInk('#16211E', 'dark');
    expect(lifted).toMatch(/^rgb\(/);
    const [r, g, b] = lifted
      .slice(4, -1)
      .split(',')
      .map((part) => Number(part.trim()));
    expect(r).toBeGreaterThan(150);
    expect(g).toBeGreaterThan(150);
    expect(b).toBeGreaterThan(150);
  });

  it('preserves the hue of mid-dark colors', () => {
    const lifted = readableInk('#0E5B4F', 'dark');
    const [r, g, b] = lifted
      .slice(4, -1)
      .split(',')
      .map((part) => Number(part.trim()));
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('ignores non-hex colors', () => {
    expect(readableInk('rgba(0, 0, 0, 0.5)', 'dark')).toBe('rgba(0, 0, 0, 0.5)');
  });
});
