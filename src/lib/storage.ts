import { get, set } from 'idb-keyval';
import type { Board } from '../types';

const BOARDS_KEY = 'lienzo:boards:v1';
const FOLDERS_KEY = 'lienzo:folders:v1';
const NAME_KEY = 'lienzo:user-name';
const SERVER_KEY = 'lienzo:server-url';

function localStorageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export async function loadBoards(): Promise<Board[] | null> {
  try {
    const stored = await get<Board[]>(BOARDS_KEY);
    if (Array.isArray(stored) && stored.length > 0) return stored;
  } catch {
    // IndexedDB can be unavailable in private modes; fall through.
  }
  if (!localStorageAvailable()) return null;
  try {
    const raw = localStorage.getItem(BOARDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Board[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function loadFolders(): string[] {
  if (!localStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  } catch {
    return [];
  }
}

export function saveFolders(folders: string[]): void {
  if (!localStorageAvailable()) return;
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  } catch {
    // Storage can be full or blocked; folders are optional.
  }
}

export async function saveBoards(boards: Board[]): Promise<void> {
  try {
    await set(BOARDS_KEY, boards);
    return;
  } catch {
    // Fall back to localStorage for small boards.
  }
  if (!localStorageAvailable()) return;
  try {
    localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
  } catch {
    // Quota exceeded: keep the in-memory board and let the user export.
  }
}

export function loadUserName(): string {
  if (!localStorageAvailable()) return 'Invitado';
  return localStorage.getItem(NAME_KEY)?.trim() || 'Invitado';
}

export function saveUserName(name: string): void {
  if (!localStorageAvailable()) return;
  localStorage.setItem(NAME_KEY, name);
}

export function loadServerUrl(): string | null {
  if (!localStorageAvailable()) return null;
  return localStorage.getItem(SERVER_KEY);
}

export function saveServerUrl(url: string | null): void {
  if (!localStorageAvailable()) return;
  if (url) localStorage.setItem(SERVER_KEY, url);
  else localStorage.removeItem(SERVER_KEY);
}

export type StoredBoardFile = {
  app: 'tiza' | 'lienzo';
  version: 1;
  exportedAt: string;
  board: Board;
};

export function boardToFile(board: Board): StoredBoardFile {
  return {
    app: 'tiza',
    version: 1,
    exportedAt: new Date().toISOString(),
    board,
  };
}

export function parseBoardFile(text: string): Board {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object') throw new Error('Archivo vacío o inválido.');
  const candidate =
    'board' in parsed && parsed.board && typeof parsed.board === 'object'
      ? (parsed as StoredBoardFile).board
      : (parsed as Board);
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    !Array.isArray(candidate.items)
  ) {
    throw new Error('El archivo no parece una pizarra de tiza.');
  }
  return {
    ...candidate,
    comments: Array.isArray(candidate.comments) ? candidate.comments : [],
    background: candidate.background ?? 'dots',
  };
}
