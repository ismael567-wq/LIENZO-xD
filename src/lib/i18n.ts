/**
 * i18n mínima con catálogos comunitarios.
 * Español primero; los textos usan marcadores tipo ICU ({nombre}) y plurales
 * sencillos para que la comunidad pueda traducir sin tocar el código.
 */

export type Locale = 'es' | 'en';

export interface Catalog {
  [key: string]: string;
}

const STORAGE_LOCALE = 'lienzo:locale:v1';
const STORAGE_CATALOG = 'lienzo:i18n:v1';

export const BASE_CATALOGS: Record<Locale, Catalog> = {
  es: {
    'lab.title': 'Laboratorio',
    'lab.note':
      'Herramientas locales de la fase v2.0: datos, aula, sesión y accesibilidad.',
    'lab.groupData': 'Datos y prototipos',
    'lab.groupClass': 'Aula y personas',
    'lab.groupSession': 'Sesión y documentos',
    'lab.groupLook': 'Apariencia',
    'lab.language': 'Idioma y comunidad',
    'lab.languageHint': 'Catálogo editable e importable',
    'lab.preview': 'Hola, {name}. Hay {count} personas en la sala.',
    'lab.exportCatalog': 'Descargar plantilla',
    'lab.importCatalog': 'Instalar catálogo',
    'lab.localeEs': 'Español',
    'lab.localeEn': 'English',
    'lab.catalogInstalled': 'Catálogo comunitario instalado: {count} claves.',
    'lab.catalogError': 'El catálogo no es un JSON de claves y textos.',
    'board.pages': 'Páginas',
    'board.layers': 'Capas',
    'board.map': 'Mapa',
    'board.veil': 'Velo',
    'board.ruler': 'Regla',
    'board.grid': 'Rejilla',
    'board.projector': 'Proyector',
    'board.study': 'Estudio',
    'board.reaction': 'Reacción',
    'board.room': 'Sala',
    'board.lab': 'Lab',
    'board.undo': 'Deshacer',
    'board.redo': 'Rehacer',
    'board.present': 'Presentar',
    'board.share': 'Compartir',
    'board.saved': 'Guardado',
    'board.saving': 'Guardando…',
  },
  en: {
    'lab.title': 'Laboratory',
    'lab.note':
      'Local tools from the v2.0 phase: data, classroom, session and accessibility.',
    'lab.groupData': 'Data and prototypes',
    'lab.groupClass': 'Classroom and people',
    'lab.groupSession': 'Session and documents',
    'lab.groupLook': 'Appearance',
    'lab.language': 'Language and community',
    'lab.languageHint': 'Editable and importable catalog',
    'lab.preview': 'Hello, {name}. There are {count} people in the room.',
    'lab.exportCatalog': 'Download template',
    'lab.importCatalog': 'Install catalog',
    'lab.localeEs': 'Español',
    'lab.localeEn': 'English',
    'lab.catalogInstalled': 'Community catalog installed: {count} keys.',
    'lab.catalogError': 'The catalog must be a JSON object of keys and texts.',
    'board.pages': 'Pages',
    'board.layers': 'Layers',
    'board.map': 'Map',
    'board.veil': 'Veil',
    'board.ruler': 'Ruler',
    'board.grid': 'Grid',
    'board.projector': 'Projector',
    'board.study': 'Study',
    'board.reaction': 'React',
    'board.room': 'Room',
    'board.lab': 'Lab',
    'board.undo': 'Undo',
    'board.redo': 'Redo',
    'board.present': 'Present',
    'board.share': 'Share',
    'board.saved': 'Saved',
    'board.saving': 'Saving…',
  },
};

function readCommunity(): Catalog {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_CATALOG);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

export function getLocale(): Locale {
  if (typeof localStorage === 'undefined') return 'es';
  return localStorage.getItem(STORAGE_LOCALE) === 'en' ? 'en' : 'es';
}

export function setLocale(locale: Locale): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_LOCALE, locale);
}

export function installCatalog(raw: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('invalid_json');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid_catalog');
  }
  const entries = Object.entries(parsed as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  if (entries.length === 0) throw new Error('invalid_catalog');
  const merged = { ...readCommunity(), ...Object.fromEntries(entries) };
  localStorage.setItem(STORAGE_CATALOG, JSON.stringify(merged));
  return entries.length;
}

export function catalogTemplate(): string {
  const merged = { ...BASE_CATALOGS.es, ...BASE_CATALOGS.en, ...readCommunity() };
  return JSON.stringify(merged, null, 2);
}

function applyVars(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/** Traducción con respaldo en español y catálogo comunitario por encima. */
export function t(
  key: string,
  vars?: Record<string, string | number>,
  locale: Locale = getLocale(),
): string {
  const template =
    readCommunity()[key] ??
    BASE_CATALOGS[locale]?.[key] ??
    BASE_CATALOGS.es[key] ??
    key;
  return applyVars(template, vars);
}
