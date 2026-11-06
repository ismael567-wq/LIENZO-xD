export const APP_NAME = 'tiza';
export const APP_TAGLINE = 'pizarras en vivo';

export type Theme = 'light' | 'dark';
export type ThemeMode = 'auto' | 'light' | 'dark';

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
  '"Space Grotesk Variable", "Space Grotesk", "Inter Variable", "Segoe UI", system-ui, sans-serif';
export const FONT_MONO =
  '"JetBrains Mono Variable", "JetBrains Mono", "SFMono-Regular", "Cascadia Code", Consolas, monospace';

const THEME_KEY = 'tiza:theme-mode';
const LEGACY_THEME_KEY = 'lienzo:theme';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark';
}

/**
 * Night is the default identity of tiza. We only honour a stored choice
 * (including the pre-rename `lienzo:theme` key) when it is valid.
 */
export function loadThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (isThemeMode(stored)) return stored;
    const legacy = window.localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === 'light' || legacy === 'dark') return legacy;
  } catch {
    // Storage may be unavailable in private mode; the UI still works.
  }
  return 'dark';
}

export function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(mode: ThemeMode): Theme {
  return mode === 'auto' ? systemTheme() : mode;
}

export function saveThemeMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_KEY, mode);
    window.localStorage.removeItem(LEGACY_THEME_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const changing = root.dataset.theme !== theme;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  if (changing) {
    root.classList.add('theme-anim');
    window.setTimeout(() => root.classList.remove('theme-anim'), 260);
  }
}

/** Notify when the OS preference changes so `auto` can re-resolve. */
export function watchSystemTheme(listener: (theme: Theme) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (event: MediaQueryListEvent) => listener(event.matches ? 'dark' : 'light');
  media.addEventListener('change', handler);
  return () => media.removeEventListener('change', handler);
}

/**
 * Keep authored ink colors readable on the dark canvas. Dark strokes and text
 * are lightened while keeping their hue; light colors pass through unchanged.
 */
export function readableInk(color: string, theme: Theme): string {
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
