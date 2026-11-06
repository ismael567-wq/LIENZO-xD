import { get, set } from 'idb-keyval';
import type { Board, HistorySnapshot } from '../types';
import { uid } from './geometry';

export interface BoardVersion {
  id: string;
  at: number;
  label: string;
  snapshot: HistorySnapshot;
}

const KEY_PREFIX = 'tiza:versions:v1:';
const MAX_VERSIONS = 24;
const AUTO_INTERVAL = 3 * 60 * 1000;
const lastAuto = new Map<string, number>();

function keyFor(boardId: string): string {
  return `${KEY_PREFIX}${boardId}`;
}

export function snapshotOfBoard(board: Board): HistorySnapshot {
  return structuredClone({
    items: board.items,
    comments: board.comments,
    name: board.name,
    background: board.background,
    locked: board.locked,
  });
}

export async function loadVersions(boardId: string): Promise<BoardVersion[]> {
  try {
    const stored = await get<BoardVersion[]>(keyFor(boardId));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export async function saveVersion(
  board: Board,
  label: string,
  options: { force?: boolean } = {},
): Promise<BoardVersion[]> {
  const previous = await loadVersions(board.id);
  const now = Date.now();
  const last = lastAuto.get(board.id) ?? previous[0]?.at ?? 0;
  if (!options.force && now - last < AUTO_INTERVAL) return previous;

  const entry: BoardVersion = {
    id: uid(9),
    at: now,
    label,
    snapshot: snapshotOfBoard(board),
  };
  const next = [entry, ...previous].slice(0, MAX_VERSIONS);
  lastAuto.set(board.id, now);
  try {
    await set(keyFor(board.id), next);
  } catch {
    // IndexedDB may be unavailable; version history is best-effort.
  }
  return next;
}

/** Called after an autosave; only records when the throttle window elapsed. */
export async function autoSnapshot(board: Board): Promise<void> {
  await saveVersion(board, 'Guardado automático');
}

export function formatVersionTime(at: number): string {
  const diff = Date.now() - at;
  if (diff < 60_000) return 'hace unos segundos';
  if (diff < 3_600_000) return `hace ${Math.round(diff / 60_000)} min`;
  if (diff < 86_400_000) return `hace ${Math.round(diff / 3_600_000)} h`;
  return new Date(at).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
