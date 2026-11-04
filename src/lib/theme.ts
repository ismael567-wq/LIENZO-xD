export const APP_NAME = 'Lienzo';
export const APP_TAGLINE = 'Piensa sin bordes.';

export const STICKY_COLORS = [
  { name: 'Mantequilla', value: '#FFE58A', text: '#3D3418' },
  { name: 'Durazno', value: '#FFC9A3', text: '#4A2C1B' },
  { name: 'Rosa', value: '#FFB7C5', text: '#4A1F2A' },
  { name: 'Menta', value: '#BFE8D4', text: '#173D30' },
  { name: 'Cielo', value: '#B8DDF8', text: '#163247' },
  { name: 'Lila', value: '#D9C8F5', text: '#2E2347' },
  { name: 'Lima', value: '#E4F2A2', text: '#303A12' },
  { name: 'Nube', value: '#FFFDF7', text: '#24302C' },
] as const;

export const SHAPE_FILLS = [
  '#FFFDF7',
  '#E9F5EF',
  '#E8EEFB',
  '#FFF0E5',
  '#FDE8EC',
  '#F2ECFC',
  '#F4F1E8',
  '#16211E',
] as const;

export const SHAPE_STROKES = [
  '#16211E',
  '#0E5B4F',
  '#2563EB',
  '#C2410C',
  '#B03A5B',
  '#6D4AC2',
  '#8A8574',
  '#FFFFFF',
] as const;

export const DRAW_COLORS = [
  '#16211E',
  '#0E5B4F',
  '#2563EB',
  '#E04F2F',
  '#B03A5B',
  '#6D4AC2',
  '#CA8A04',
  '#FFFFFF',
] as const;

export const ACCENTS = [
  '#0E5B4F',
  '#2563EB',
  '#E04F2F',
  '#B03A5B',
  '#6D4AC2',
  '#CA8A04',
  '#16211E',
] as const;

export const USER_COLORS = [
  '#E04F2F',
  '#2563EB',
  '#0E5B4F',
  '#B03A5B',
  '#6D4AC2',
  '#CA8A04',
  '#0F766E',
  '#C2410C',
] as const;

export const FONT_UI =
  '"Inter Variable", "Inter", "Segoe UI", system-ui, -apple-system, sans-serif';
export const FONT_DISPLAY =
  '"Instrument Serif", "Iowan Old Style", Georgia, serif';
export const FONT_MONO =
  '"JetBrains Mono", "SFMono-Regular", "Cascadia Code", Consolas, monospace';

const THEME_KEY = 'lienzo:theme';

export function loadTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: 'light' | 'dark'): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage may be unavailable in private mode; the UI still works.
  }
}

export function applyTheme(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

/**
 * Keep authored ink colors readable on the dark canvas. Dark strokes and text
 * are lightened while keeping their hue; light colors pass through unchanged.
 */
export function readableInk(color: string, theme: 'light' | 'dark'): string {
  if (theme !== 'dark') return color;
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return color;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split('').map((part) => part + part).join('');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance >= 0.45) return color;
  const lift = (channel: number) => Math.round(channel + (255 - channel) * 0.68);
  return `rgb(${lift(r)}, ${lift(g)}, ${lift(b)})`;
}

export function userColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}
