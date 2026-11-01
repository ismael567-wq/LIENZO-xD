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

export function userColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}
