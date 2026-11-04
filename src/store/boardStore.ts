import { create } from 'zustand';
import type {
  AnyItemPatch,
  Board,
  BoardItem,
  CollabState,
  CommentPin,
  HistorySnapshot,
  Peer,
  Point,
  Rect,
  RemoteOp,
  SaveStatus,
  ShapeKind,
  TemplateId,
  Theme,
  ToastMessage,
  Tool,
  Viewport,
} from '../types';
import {
  boundsOfItems,
  fitViewport,
  formatRelativeTime,
  getFrameSlides,
  itemRect,
  isConnector,
  rectsIntersect,
  uid,
  wordCount,
} from '../lib/geometry';
import { userColor, applyTheme, loadTheme, saveTheme } from '../lib/theme';
import { createBoard, createWelcomeBoard, DEFAULT_BOARD_NAME } from '../lib/templates';
import { duplicateItems, newSticky } from '../lib/factory';
import {
  loadBoards,
  loadServerUrl,
  loadUserName,
  saveBoards,
  saveServerUrl,
  saveUserName,
} from '../lib/storage';
import { defaultServerBase, normalizeServerBase } from '../lib/net';
import type { CollabClient } from '../lib/collab';

const HISTORY_LIMIT = 60;

type OverlayKey = 'share' | 'templates' | 'shortcuts' | 'command' | 'newBoard' | 'about';

export interface UiState {
  share: boolean;
  templates: boolean;
  shortcuts: boolean;
  command: boolean;
  newBoard: boolean;
  about: boolean;
}

export interface PresentationState {
  slides: Rect[];
  index: number;
  returnViewport: Viewport;
}

interface LienzoState {
  ready: boolean;
  boards: Board[];
  boardId: string | null;
  tool: Tool;
  shapeKind: ShapeKind;
  viewport: Viewport;
  stageSize: { w: number; h: number };
  selected: string[];
  editingId: string | null;
  saveStatus: SaveStatus;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  userName: string;
  snapToGrid: boolean;
  theme: Theme;
  zen: boolean;
  gridSize: number;
  toast: ToastMessage | null;
  collab: CollabState;
  ui: UiState;
  presentation: PresentationState | null;

  init: () => Promise<void>;
  createBoard: (template?: TemplateId, name?: string) => string | null;
  openBoard: (id: string) => void;
  closeBoard: () => void;
  renameBoard: (id: string, name: string) => void;
  deleteBoard: (id: string) => void;
  duplicateBoard: (id: string) => void;
  toggleFavorite: (id: string) => void;
  importBoard: (board: Board) => void;

  setTool: (tool: Tool) => void;
  setShapeKind: (kind: ShapeKind) => void;
  setViewport: (viewport: Viewport) => void;
  setStageSize: (size: { w: number; h: number }) => void;
  fitToContent: (padding?: number, rightInset?: number) => void;
  focusRect: (rect: Rect, padding?: number, maxZoom?: number) => void;
  setSnapToGrid: (value: boolean) => void;
  setBackground: (background: Board['background']) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setZen: (value: boolean) => void;
  toggleZen: () => void;
  setGridSize: (size: number) => void;

  select: (ids: string[], additive?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectInRect: (rect: Rect, additive?: boolean) => void;

  addItem: (
    item: BoardItem,
    options?: { select?: boolean; edit?: boolean; history?: boolean },
  ) => void;
  updateItem: (id: string, patch: AnyItemPatch) => void;
  updateItems: (updates: Array<{ id: string; patch: AnyItemPatch }>) => void;
  updateSelected: (patch: AnyItemPatch) => void;
  deleteSelected: () => void;
  deleteItem: (id: string) => void;
  duplicateSelected: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  alignSelected: (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  distributeSelected: (axis: 'x' | 'y') => void;
  groupSelected: () => void;
  ungroupSelected: () => void;

  startEditing: (id: string) => void;
  finishEditing: () => void;

  addComment: (point: Point, text: string) => void;
  toggleComment: (id: string) => void;
  deleteComment: (id: string) => void;

  pushHistory: (snapshot?: HistorySnapshot) => void;
  undo: () => void;
  redo: () => void;

  applyTemplate: (template: TemplateId) => void;
  setUserName: (name: string) => void;
  showToast: (text: string, kind?: ToastMessage['kind']) => void;
  dismissToast: (id: string) => void;
  setUi: (key: OverlayKey, open: boolean) => void;

  startPresentation: () => void;
  nextSlide: () => void;
  prevSlide: () => void;
  exitPresentation: () => void;

  connectCollab: (baseUrl?: string) => Promise<void>;
  disconnectCollab: () => void;
  refreshServerInfo: () => Promise<void>;
  autoConnectIfServed: () => Promise<void>;
  sendCursor: (point: Point) => void;
  applyRemoteOps: (ops: RemoteOp[]) => void;
}

export function currentBoardOf(state: { boards: Board[]; boardId: string | null }): Board | null {
  if (!state.boardId) return null;
  return state.boards.find((board) => board.id === state.boardId) ?? null;
}

function snapshotOf(board: Board): HistorySnapshot {
  return structuredClone({
    items: board.items,
    comments: board.comments,
    name: board.name,
    background: board.background,
  });
}

/** Expand a set of ids so every member of a shared group is included. */
function expandGroupSelection(board: Board | null, ids: string[]): string[] {
  if (!board || ids.length === 0) return ids;
  const groups = new Set<string>();
  for (const item of board.items) {
    if (item.groupId && ids.includes(item.id)) groups.add(item.groupId);
  }
  if (groups.size === 0) return ids;
  const next = new Set(ids);
  for (const item of board.items) {
    if (item.groupId && groups.has(item.groupId)) next.add(item.id);
  }
  return [...next];
}

const INITIAL_THEME = loadTheme();
applyTheme(INITIAL_THEME);

function cloneBoardDeep(board: Board): Board {
  const clone = structuredClone(board);
  const idMap = new Map<string, string>();
  for (const item of clone.items) {
    const nextId = uid(9);
    idMap.set(item.id, nextId);
    item.id = nextId;
    item.updatedAt = Date.now();
  }
  for (const item of clone.items) {
    if (item.type === 'connector') {
      if (item.from.itemId && idMap.has(item.from.itemId)) {
        item.from.itemId = idMap.get(item.from.itemId);
      }
      if (item.to.itemId && idMap.has(item.to.itemId)) {
        item.to.itemId = idMap.get(item.to.itemId);
      }
    }
  }
  for (const comment of clone.comments) comment.id = uid(9);
  clone.id = uid(12);
  clone.name = `${board.name} (copia)`;
  clone.createdAt = Date.now();
  clone.updatedAt = Date.now();
  clone.favorite = false;
  return clone;
}

function seedBoards(): Board[] {
  const welcome = createWelcomeBoard();
  const kanban = createBoard('kanban', 'Lanzamiento Q4');
  const journey = createBoard('journey', 'Viaje del cliente · app móvil');
  const now = Date.now();
  welcome.updatedAt = now;
  welcome.createdAt = now - 1000 * 60 * 60 * 24;
  kanban.updatedAt = now - 1000 * 60 * 60 * 4;
  kanban.createdAt = now - 1000 * 60 * 60 * 72;
  journey.updatedAt = now - 1000 * 60 * 60 * 30;
  journey.createdAt = now - 1000 * 60 * 60 * 96;
  return [welcome, kanban, journey];
}

function syncHash(boardId: string | null): void {
  if (typeof window === 'undefined') return;
  const target = boardId ? `#/b/${boardId}` : '#/';
  if (window.location.hash !== target) {
    window.history.replaceState(null, '', target);
  }
}

function makeInitialCollab(): CollabState {
  const selfId =
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('lienzo:client-id')) ||
    uid(10);
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('lienzo:client-id', selfId);
  }
  const storedServer = loadServerUrl();
  const desktop = typeof window !== 'undefined' ? window.lienzoDesktop : undefined;
  return {
    status: 'off',
    url: null,
    error: null,
    peers: [],
    selfId,
    selfName: 'Invitado',
    selfColor: userColor(selfId),
    localServerUrl: desktop?.serverUrl ?? storedServer ?? null,
    lanUrls: desktop?.lanUrl ? [desktop.lanUrl] : [],
  };
}

let collabClient: CollabClient | null = null;
let collabUnsubscribe: (() => void) | null = null;

export const useLienzo = create<LienzoState>()((set, get) => {
  const mutateBoard = (
    updater: (board: Board) => Board,
    options: { history?: boolean; snapshot?: HistorySnapshot } = {},
  ): Board | null => {
    const state = get();
    const board = currentBoardOf(state);
    if (!board) return null;
    const past = options.history
      ? [...state.past, options.snapshot ?? snapshotOf(board)].slice(-HISTORY_LIMIT)
      : state.past;
    const next = updater(board);
    const withTimestamp = { ...next, updatedAt: Date.now() };
    set({
      boards: state.boards.map((candidate) =>
        candidate.id === board.id ? withTimestamp : candidate,
      ),
      past,
      future: options.history ? [] : state.future,
      saveStatus: 'dirty',
    });
    return withTimestamp;
  };

  return {
    ready: false,
    boards: [],
    boardId: null,
    tool: 'select',
    shapeKind: 'rect',
    viewport: { x: 0, y: 0, zoom: 1 },
    stageSize: { w: 1200, h: 800 },
    selected: [],
    editingId: null,
    saveStatus: 'saved',
    past: [],
    future: [],
    userName: 'Invitado',
    snapToGrid: false,
    theme: INITIAL_THEME,
    zen: false,
    gridSize: 24,
    toast: null,
    collab: makeInitialCollab(),
    ui: {
      share: false,
      templates: false,
      shortcuts: false,
      command: false,
      newBoard: false,
      about: false,
    },
    presentation: null,

    init: async () => {
      if (get().ready) return;
      const stored = await loadBoards();
      let boards = stored ?? seedBoards();
      const userName = loadUserName();
      const collab = get().collab;
      const match =
        typeof window !== 'undefined'
          ? window.location.hash.match(/^#\/b\/([A-Za-z0-9_-]+)$/)
          : null;
      let deepLinked = match
        ? boards.find((board) => board.id === match[1])
        : undefined;
      let sharedFromRoom = false;
      if (match && !deepLinked) {
        const port = typeof window !== 'undefined' ? window.location.port : '';
        const base =
          port && port !== '5173' && port !== '4173'
            ? window.location.origin
            : defaultServerBase();
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2800);
          const response = await fetch(`${base}/api/boards/${match[1]}`, {
            cache: 'no-store',
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (response.ok) {
            const candidate = (await response.json()) as Board;
            if (
              candidate &&
              candidate.id === match[1] &&
              Array.isArray(candidate.items) &&
              Array.isArray(candidate.comments)
            ) {
              candidate.comments = candidate.comments ?? [];
              deepLinked = candidate;
              boards = [candidate, ...boards.filter((board) => board.id !== candidate.id)];
              sharedFromRoom = true;
            }
          }
        } catch {
          // The room server may not be running; the dashboard is still usable.
        }
      }
      if (!stored || sharedFromRoom) await saveBoards(boards);
      set({
        boards,
        ready: true,
        userName,
        boardId: deepLinked?.id ?? null,
        collab: {
          ...collab,
          selfName: userName,
          selfColor: userColor(userName + collab.selfId),
        },
      });
      if (deepLinked) {
        set({ selected: [], editingId: null, tool: 'select' });
      }
      if (sharedFromRoom) {
        get().showToast('Tablero compartido abierto desde la sala local.', 'success');
      }
      syncHash(deepLinked?.id ?? null);
    },

    createBoard: (template = 'blank', name) => {
      if (!get().ready) return null;
      if (get().collab.status !== 'off') get().disconnectCollab();
      const board = createBoard(template, name ?? DEFAULT_BOARD_NAME[template]);
      const state = get();
      set({
        boards: [board, ...state.boards],
        boardId: board.id,
        selected: [],
        editingId: null,
        tool: 'select',
        past: [],
        future: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        gridSize: board.gridSize ?? 24,
        saveStatus: 'dirty',
        ui: { ...state.ui, newBoard: false },
      });
      syncHash(board.id);
      if (board.items.length > 0) {
        setTimeout(() => get().fitToContent(110), 40);
      }
      return board.id;
    },

    openBoard: (id) => {
      const board = get().boards.find((candidate) => candidate.id === id);
      if (!board) return;
      if (get().collab.status !== 'off') get().disconnectCollab();
      set({
        boardId: id,
        selected: [],
        editingId: null,
        tool: 'select',
        past: [],
        future: [],
        presentation: null,
        gridSize: board.gridSize ?? 24,
        ui: {
          ...get().ui,
          share: false,
          templates: false,
          command: false,
          newBoard: false,
          about: false,
        },
      });
      syncHash(id);
      setTimeout(() => {
        if (get().boardId === id) get().fitToContent(90);
      }, 40);
    },

    closeBoard: () => {
      if (get().collab.status !== 'off') get().disconnectCollab();
      set({
        boardId: null,
        selected: [],
        editingId: null,
        tool: 'select',
        past: [],
        future: [],
        presentation: null,
        ui: { ...get().ui, share: false, templates: false, command: false },
      });
      syncHash(null);
    },

    renameBoard: (id, name) => {
      const clean = name.trim();
      if (!clean) return;
      const state = get();
      set({
        boards: state.boards.map((board) =>
          board.id === id ? { ...board, name: clean, updatedAt: Date.now() } : board,
        ),
        saveStatus: 'dirty',
      });
    },

    deleteBoard: (id) => {
      const state = get();
      const remaining = state.boards.filter((board) => board.id !== id);
      if (remaining.length === 0) {
        const fresh = createWelcomeBoard();
        set({
          boards: [fresh],
          boardId: state.boardId === id ? null : state.boardId,
          selected: [],
          saveStatus: 'dirty',
        });
        if (state.boardId === id) syncHash(null);
        get().showToast('Creamos un tablero nuevo para que no te quedes sin espacio.', 'info');
        return;
      }
      set({
        boards: remaining,
        boardId: state.boardId === id ? null : state.boardId,
        selected: [],
        saveStatus: 'dirty',
      });
      if (state.boardId === id) {
        get().disconnectCollab();
        syncHash(null);
      }
      get().showToast('Tablero eliminado.', 'info');
    },

    duplicateBoard: (id) => {
      const source = get().boards.find((board) => board.id === id);
      if (!source) return;
      const clone = cloneBoardDeep(source);
      set((state) => ({
        boards: [clone, ...state.boards],
        saveStatus: 'dirty',
      }));
      get().showToast('Tablero duplicado.', 'success');
    },

    toggleFavorite: (id) => {
      set((state) => ({
        boards: state.boards.map((board) =>
          board.id === id ? { ...board, favorite: !board.favorite } : board,
        ),
        saveStatus: 'dirty',
      }));
    },

    importBoard: (board) => {
      const imported = structuredClone(board);
      imported.id = uid(12);
      imported.name = board.name || 'Tablero importado';
      imported.createdAt = Date.now();
      imported.updatedAt = Date.now();
      imported.favorite = false;
      set((state) => ({
        boards: [imported, ...state.boards],
        boardId: imported.id,
        selected: [],
        past: [],
        future: [],
        saveStatus: 'dirty',
      }));
      syncHash(imported.id);
      setTimeout(() => get().fitToContent(90), 40);
      get().showToast('Tablero importado correctamente.', 'success');
    },

    setTool: (tool) => {
      set({ tool, editingId: null });
      if (tool !== 'select' && tool !== 'hand') set({ selected: [] });
    },

    setShapeKind: (shapeKind) => set({ shapeKind }),

    setViewport: (viewport) => set({ viewport }),

    setStageSize: (stageSize) => {
      set({ stageSize });
    },

    fitToContent: (padding = 90, rightInset = 0) => {
      const state = get();
      const board = currentBoardOf(state);
      const { w, h } = state.stageSize;
      if (!board) return;
      const bounds = boundsOfItems(board.items);
      const availableWidth = Math.max(240, w - rightInset);
      if (!bounds || bounds.w < 1 || bounds.h < 1) {
        set({ viewport: { x: availableWidth / 2, y: h / 2, zoom: 1 } });
        return;
      }
      set({ viewport: fitViewport(bounds, availableWidth, h, padding) });
    },

    focusRect: (rect, padding = 70, maxZoom = 1.4) => {
      const { stageSize } = get();
      set({ viewport: fitViewport(rect, stageSize.w, stageSize.h, padding, maxZoom) });
    },

    setSnapToGrid: (snapToGrid) => set({ snapToGrid }),

    setBackground: (background) => {
      mutateBoard((board) => ({ ...board, background }), { history: true });
    },

    setTheme: (theme) => {
      saveTheme(theme);
      applyTheme(theme);
      set({ theme });
    },

    toggleTheme: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
      get().setTheme(next);
    },

    setZen: (zen) => set({ zen }),

    toggleZen: () => {
      const zen = !get().zen;
      set({ zen });
      setTimeout(() => get().fitToContent(120), 60);
    },

    setGridSize: (size) => {
      const gridSize = Math.max(8, Math.min(80, Math.round(size)));
      mutateBoard((board) => ({ ...board, gridSize }));
      set({ gridSize });
    },

    select: (ids, additive = false) => {
      const board = currentBoardOf(get());
      const existing = new Set(board?.items.map((item) => item.id) ?? []);
      const valid = expandGroupSelection(
        board,
        ids.filter((id) => existing.has(id)),
      );
      if (!additive) {
        set({ selected: valid });
        return;
      }
      const current = get().selected;
      const next = new Set(current);
      for (const id of valid) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      set({ selected: [...next] });
    },

    selectAll: () => {
      const board = currentBoardOf(get());
      if (!board) return;
      set({
        selected: board.items.filter((item) => !item.locked).map((item) => item.id),
      });
    },

    clearSelection: () => set({ selected: [], editingId: null }),

    selectInRect: (rect, additive = false) => {
      const board = currentBoardOf(get());
      if (!board) return;
      const ids = expandGroupSelection(
        board,
        board.items
          .filter((item) => item.type !== 'frame' && !item.locked)
          .filter((item) => rectsIntersect(itemRect(item), rect))
          .map((item) => item.id),
      );
      if (additive) get().select(ids, true);
      else set({ selected: ids });
    },

    addItem: (item, options = {}) => {
      const { select = true, edit = false, history = true } = options;
      mutateBoard((board) => ({ ...board, items: [...board.items, item] }), {
        history,
      });
      set({
        selected: select ? [item.id] : get().selected,
        editingId: edit ? item.id : null,
        tool: edit || item.type !== 'connector' ? 'select' : get().tool,
      });
    },

    updateItem: (id, patch) => {
      mutateBoard((board) => ({
        ...board,
        items: board.items.map((item) =>
          item.id === id
            ? ({ ...item, ...patch, updatedAt: Date.now() } as BoardItem)
            : item,
        ),
      }));
    },

    updateItems: (updates) => {
      const map = new Map(updates.map((entry) => [entry.id, entry.patch]));
      mutateBoard((board) => ({
        ...board,
        items: board.items.map((item) => {
          const patch = map.get(item.id);
          return patch
            ? ({ ...item, ...patch, updatedAt: Date.now() } as BoardItem)
            : item;
        }),
      }));
    },

    updateSelected: (patch) => {
      const ids = get().selected;
      if (ids.length === 0) return;
      get().pushHistory();
      get().updateItems(ids.map((id) => ({ id, patch })));
    },

    deleteSelected: () => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board || state.selected.length === 0) return;
      const removed = new Set(state.selected);
      const items = board.items.filter((item) => {
        if (removed.has(item.id)) return false;
        if (
          item.type === 'connector' &&
          ((item.from.itemId && removed.has(item.from.itemId)) ||
            (item.to.itemId && removed.has(item.to.itemId)))
        ) {
          return false;
        }
        return true;
      });
      mutateBoard((current) => ({ ...current, items }), { history: true });
      set({ selected: [], editingId: null });
    },

    deleteItem: (id) => {
      const board = currentBoardOf(get());
      if (!board) return;
      const items = board.items.filter((item) => {
        if (item.id === id) return false;
        if (
          item.type === 'connector' &&
          (item.from.itemId === id || item.to.itemId === id)
        ) {
          return false;
        }
        return true;
      });
      mutateBoard((current) => ({ ...current, items }), { history: true });
      set({ selected: get().selected.filter((selectedId) => selectedId !== id) });
    },

    duplicateSelected: () => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board || state.selected.length === 0) return;
      const { items, newIds } = duplicateItems(board.items, state.selected);
      mutateBoard((current) => ({ ...current, items: [...current.items, ...items] }), {
        history: true,
      });
      set({ selected: newIds });
      get().showToast('Elementos duplicados.', 'success');
    },

    bringToFront: () => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board || state.selected.length === 0) return;
      const selected = new Set(state.selected);
      const rest = board.items.filter((item) => !selected.has(item.id));
      const front = board.items.filter((item) => selected.has(item.id));
      mutateBoard((current) => ({ ...current, items: [...rest, ...front] }), {
        history: true,
      });
    },

    sendToBack: () => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board || state.selected.length === 0) return;
      const selected = new Set(state.selected);
      const back = board.items.filter((item) => selected.has(item.id));
      const rest = board.items.filter((item) => !selected.has(item.id));
      mutateBoard((current) => ({ ...current, items: [...back, ...rest] }), {
        history: true,
      });
    },

    alignSelected: (mode) => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board || state.selected.length < 2) return;
      const selected = board.items.filter(
        (item) => state.selected.includes(item.id) && item.type !== 'connector',
      );
      if (selected.length < 2) return;
      const bounds = boundsOfItems(board.items, selected.map((item) => item.id));
      if (!bounds) return;
      const updates = selected.map((item) => {
        let x = item.x;
        let y = item.y;
        if (mode === 'left') x = bounds.x;
        if (mode === 'center') x = bounds.x + (bounds.w - item.w) / 2;
        if (mode === 'right') x = bounds.x + bounds.w - item.w;
        if (mode === 'top') y = bounds.y;
        if (mode === 'middle') y = bounds.y + (bounds.h - item.h) / 2;
        if (mode === 'bottom') y = bounds.y + bounds.h - item.h;
        return { id: item.id, patch: { x: Math.round(x), y: Math.round(y) } };
      });
      get().pushHistory();
      get().updateItems(updates);
    },

    distributeSelected: (axis) => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board || state.selected.length < 3) return;
      const selected = board.items.filter(
        (item) => state.selected.includes(item.id) && item.type !== 'connector',
      );
      if (selected.length < 3) return;
      const sorted = [...selected].sort((a, b) =>
        axis === 'x' ? a.x - b.x : a.y - b.y,
      );
      const bounds = boundsOfItems(board.items, sorted.map((item) => item.id));
      if (!bounds) return;
      const totalSize = sorted.reduce(
        (sum, item) => sum + (axis === 'x' ? item.w : item.h),
        0,
      );
      const gap = (axis === 'x' ? bounds.w : bounds.h) - totalSize;
      const step = gap / (sorted.length - 1);
      let cursor = axis === 'x' ? bounds.x : bounds.y;
      const updates = sorted.map((item) => {
        const patch =
          axis === 'x'
            ? { x: Math.round(cursor) }
            : { y: Math.round(cursor) };
        cursor += (axis === 'x' ? item.w : item.h) + step;
        return { id: item.id, patch };
      });
      get().pushHistory();
      get().updateItems(updates);
    },

    groupSelected: () => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board || state.selected.length < 2) {
        state.showToast('Selecciona al menos dos elementos para agrupar.', 'info');
        return;
      }
      const groupId = uid(9);
      const selected = new Set(state.selected);
      state.pushHistory();
      state.updateItems(
        board.items
          .filter((item) => selected.has(item.id))
          .map((item) => ({ id: item.id, patch: { groupId } })),
      );
      state.showToast('Elementos agrupados.', 'success');
    },

    ungroupSelected: () => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board) return;
      const selected = new Set(state.selected);
      const grouped = board.items.filter(
        (item) => selected.has(item.id) && item.groupId,
      );
      if (grouped.length === 0) {
        state.showToast('La selección no contiene grupos.', 'info');
        return;
      }
      state.pushHistory();
      state.updateItems(
        grouped.map((item) => ({ id: item.id, patch: { groupId: undefined } })),
      );
      state.showToast('Grupo deshecho.', 'success');
    },

    startEditing: (id) => {
      const board = currentBoardOf(get());
      const item = board?.items.find((candidate) => candidate.id === id);
      if (!item || !('text' in item)) return;
      get().pushHistory();
      set({ editingId: id, selected: [id], tool: 'select' });
    },

    finishEditing: () => set({ editingId: null }),

    addComment: (point, text) => {
      const clean = text.trim();
      if (!clean) return;
      const author = get().userName;
      const comment: CommentPin = {
        id: uid(9),
        x: point.x,
        y: point.y,
        text: clean,
        author,
        createdAt: Date.now(),
        resolved: false,
      };
      mutateBoard(
        (board) => ({ ...board, comments: [...board.comments, comment] }),
        { history: true },
      );
      get().showToast('Comentario añadido.', 'success');
    },

    toggleComment: (id) => {
      mutateBoard((board) => ({
        ...board,
        comments: board.comments.map((comment) =>
          comment.id === id ? { ...comment, resolved: !comment.resolved } : comment,
        ),
      }));
    },

    deleteComment: (id) => {
      mutateBoard((board) => ({
        ...board,
        comments: board.comments.filter((comment) => comment.id !== id),
      }));
    },

    pushHistory: (snapshot) => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board) return;
      set({
        past: [...state.past, snapshot ?? snapshotOf(board)].slice(-HISTORY_LIMIT),
        future: [],
      });
    },

    undo: () => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board || state.past.length === 0) {
        get().showToast('No hay más pasos para deshacer.', 'info');
        return;
      }
      const previous = state.past[state.past.length - 1];
      const current = snapshotOf(board);
      set({
        boards: state.boards.map((candidate) =>
          candidate.id === board.id
            ? {
                ...candidate,
                ...structuredClone(previous),
                updatedAt: Date.now(),
              }
            : candidate,
        ),
        past: state.past.slice(0, -1),
        future: [current, ...state.future].slice(0, HISTORY_LIMIT),
        selected: state.selected.filter((id) =>
          previous.items.some((item) => item.id === id),
        ),
        editingId: null,
        saveStatus: 'dirty',
      });
    },

    redo: () => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board || state.future.length === 0) {
        get().showToast('No hay pasos para rehacer.', 'info');
        return;
      }
      const next = state.future[0];
      const current = snapshotOf(board);
      set({
        boards: state.boards.map((candidate) =>
          candidate.id === board.id
            ? {
                ...candidate,
                ...structuredClone(next),
                updatedAt: Date.now(),
              }
            : candidate,
        ),
        past: [...state.past, current].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        selected: state.selected.filter((id) =>
          next.items.some((item) => item.id === id),
        ),
        editingId: null,
        saveStatus: 'dirty',
      });
    },

    applyTemplate: (template) => {
      if (template === 'blank') return;
      const state = get();
      const board = currentBoardOf(state);
      if (!board) return;
      const templateBoard = createBoard(template, DEFAULT_BOARD_NAME[template]);
      const templateBounds = boundsOfItems(templateBoard.items);
      if (!templateBounds) return;
      const existingBounds = boundsOfItems(board.items);
      let offsetX: number;
      let offsetY: number;
      if (existingBounds) {
        offsetX = existingBounds.x + existingBounds.w + 260 - templateBounds.x;
        offsetY = existingBounds.y - templateBounds.y;
      } else {
        const centerWorld = {
          x: (state.stageSize.w / 2 - state.viewport.x) / state.viewport.zoom,
          y: (state.stageSize.h / 2 - state.viewport.y) / state.viewport.zoom,
        };
        offsetX = centerWorld.x - (templateBounds.x + templateBounds.w / 2);
        offsetY = centerWorld.y - (templateBounds.y + templateBounds.h / 2);
      }
      const items = templateBoard.items.map((item) => {
        if (item.type === 'connector') return item;
        return {
          ...item,
          x: item.x + offsetX,
          y: item.y + offsetY,
        };
      });
      mutateBoard(
        (currentBoard) => ({
          ...currentBoard,
          items: [...currentBoard.items, ...items],
        }),
        { history: true },
      );
      const inserted = boundsOfItems(items);
      if (inserted) setTimeout(() => get().focusRect(inserted, 100), 30);
      get().showToast('Plantilla añadida al tablero.', 'success');
    },

    setUserName: (name) => {
      const clean = name.trim() || 'Invitado';
      saveUserName(clean);
      const collab = get().collab;
      const color = userColor(clean + collab.selfId);
      set({
        userName: clean,
        collab: { ...collab, selfName: clean, selfColor: color },
      });
      collabClient?.updateProfile(clean, color);
    },

    showToast: (text, kind = 'info') => {
      set({ toast: { id: uid(6), text, kind } });
    },

    dismissToast: (id) => {
      if (get().toast?.id === id) set({ toast: null });
    },

    setUi: (key, open) => {
      const ui = { ...get().ui };
      for (const candidate of Object.keys(ui) as OverlayKey[]) {
        ui[candidate] = candidate === key ? open : false;
      }
      set({ ui });
    },

    startPresentation: () => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board) return;
      const frames = getFrameSlides(board.items);
      const bounds = boundsOfItems(board.items);
      const slides =
        frames.length > 0
          ? frames
          : bounds
            ? [{ x: bounds.x - 60, y: bounds.y - 60, w: bounds.w + 120, h: bounds.h + 120 }]
            : [{ x: 0, y: 0, w: 1600, h: 900 }];
      set({
        presentation: { slides, index: 0, returnViewport: state.viewport },
        selected: [],
        editingId: null,
        toast: null,
        ui: { ...state.ui, share: false, templates: false, command: false },
      });
      get().focusRect(slides[0], frames.length > 0 ? 60 : 48, 2.2);
    },

    nextSlide: () => {
      const presentation = get().presentation;
      if (!presentation) return;
      const index = Math.min(presentation.slides.length - 1, presentation.index + 1);
      set({ presentation: { ...presentation, index } });
      get().focusRect(presentation.slides[index], 60, 2.2);
    },

    prevSlide: () => {
      const presentation = get().presentation;
      if (!presentation) return;
      const index = Math.max(0, presentation.index - 1);
      set({ presentation: { ...presentation, index } });
      get().focusRect(presentation.slides[index], 60, 2.2);
    },

    exitPresentation: () => {
      const presentation = get().presentation;
      if (!presentation) return;
      set({
        presentation: null,
        viewport: presentation.returnViewport,
      });
    },

    connectCollab: async (baseUrl) => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board) return;
      const base = normalizeServerBase(
        baseUrl ?? state.collab.localServerUrl ?? defaultServerBase(),
      );
      if (!base) {
        get().showToast('No pudimos detectar un servidor de sala.', 'error');
        return;
      }
      collabClient?.destroy();
      collabUnsubscribe?.();
      collabClient = null;
      collabUnsubscribe = null;
      sessionStorage.setItem('lienzo:server-url', base);
      saveServerUrl(base);
      set({
        collab: {
          ...state.collab,
          status: 'connecting',
          url: base,
          localServerUrl: base,
          error: null,
        },
      });
      try {
        const { CollabClient } = await import('../lib/collab');
        const client = new CollabClient({
          baseUrl: base,
          board,
          user: {
            id: state.collab.selfId,
            name: state.userName,
            color: userColor(state.userName + state.collab.selfId),
          },
          onStatus: (status, error) => {
            set((current) => ({
              collab: {
                ...current.collab,
                status,
                error: error ?? null,
                peers: status === 'off' ? [] : current.collab.peers,
              },
            }));
          },
          onPeers: (peers: Peer[]) => {
            set((current) => ({ collab: { ...current.collab, peers } }));
          },
          onBoard: (incoming) => {
            const current = get();
            const existing = currentBoardOf(current);
            if (!existing) return;
            const nextBoard: Board = {
              ...incoming,
              id: existing.id,
              name: incoming.name || existing.name,
              updatedAt: Date.now(),
            };
            set({
              boards: current.boards.map((candidate) =>
                candidate.id === existing.id ? nextBoard : candidate,
              ),
              past: [],
              future: [],
              selected: current.selected.filter((id) =>
                nextBoard.items.some((item) => item.id === id),
              ),
              editingId: null,
              saveStatus: 'dirty',
            });
            get().showToast('Sala sincronizada. Ya puedes colaborar.', 'success');
          },
          onOps: (ops) => get().applyRemoteOps(ops),
          onCursor: (peerId, point) => {
            set((current) => ({
              collab: {
                ...current.collab,
                peers: current.collab.peers.map((peer) =>
                  peer.id === peerId ? { ...peer, cursor: point, lastSeen: Date.now() } : peer,
                ),
              },
            }));
          },
        });
        collabClient = client;
        collabUnsubscribe = useLienzo.subscribe((next, previous) => {
          if (next.collab.status !== 'on') return;
          const nextBoard = currentBoardOf(next);
          const previousBoard = currentBoardOf(previous);
          if (nextBoard && nextBoard !== previousBoard) {
            client.queueSync(nextBoard);
          }
        });
        client.connect();
      } catch (error) {
        set({
          collab: {
            ...get().collab,
            status: 'error',
            error: error instanceof Error ? error.message : 'No se pudo abrir la sala.',
          },
        });
      }
    },

    disconnectCollab: () => {
      collabClient?.destroy();
      collabClient = null;
      collabUnsubscribe?.();
      collabUnsubscribe = null;
      set((state) => ({
        collab: { ...state.collab, status: 'off', peers: [], error: null },
      }));
    },

    refreshServerInfo: async () => {
      const state = get();
      const base =
        state.collab.localServerUrl ??
        (typeof window !== 'undefined' ? defaultServerBase() : null);
      if (!base) return;
      try {
        const response = await fetch(`${base}/api/info`, { cache: 'no-store' });
        if (!response.ok) return;
        const info = (await response.json()) as { lan?: string[]; port?: number };
        set((current) => ({
          collab: {
            ...current.collab,
            localServerUrl: base,
            lanUrls: Array.isArray(info.lan) ? info.lan : [],
          },
        }));
      } catch {
        // The room server is optional; local mode keeps working.
      }
    },

    autoConnectIfServed: async () => {
      if (typeof window === 'undefined') return;
      if (get().collab.status !== 'off' || !get().boardId) return;
      if (!/^https?:$/.test(window.location.protocol)) return;
      if (window.location.port === '5173' || window.location.port === '4173') return;
      try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as { status?: string; lan?: string[] };
        if (payload.status !== 'ok') return;
        set((current) => ({
          collab: {
            ...current.collab,
            localServerUrl: window.location.origin,
            lanUrls: Array.isArray(payload.lan) ? payload.lan : [],
          },
        }));
        await get().connectCollab(window.location.origin);
      } catch {
        // Served statically without a room server: stay local.
      }
    },

    sendCursor: (point) => {
      collabClient?.sendCursor(point);
    },

    applyRemoteOps: (ops) => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board) return;
      let items = [...board.items];
      let comments = [...board.comments];
      let name = board.name;
      let background = board.background;
      for (const op of ops) {
        if (op.kind === 'upsert') {
          const index = items.findIndex((item) => item.id === op.item.id);
          if (index >= 0) {
            items[index] = op.item;
          } else {
            items.push(op.item);
          }
        } else if (op.kind === 'delete') {
          items = items.filter((item) => item.id !== op.id);
          items = items.filter(
            (item) =>
              !(
                item.type === 'connector' &&
                (item.from.itemId === op.id || item.to.itemId === op.id)
              ),
          );
        } else if (op.kind === 'meta') {
          if (op.name) name = op.name;
          if (op.background) background = op.background;
        } else if (op.kind === 'comments') {
          comments = op.comments;
        }
      }
      const nextBoard: Board = {
        ...board,
        items,
        comments,
        name,
        background,
        updatedAt: Date.now(),
      };
      set({
        boards: state.boards.map((candidate) =>
          candidate.id === board.id ? nextBoard : candidate,
        ),
        saveStatus: 'dirty',
      });
    },
  };
});

export function getBoardStats(board: Board): {
  items: number;
  notes: number;
  connectors: number;
  comments: number;
  words: number;
  updated: string;
} {
  const notes = board.items.filter((item) => item.type === 'sticky').length;
  const connectors = board.items.filter(isConnector).length;
  const words = board.items.reduce((total, item) => {
    if ('text' in item && typeof item.text === 'string') return total + wordCount(item.text);
    return total;
  }, 0);
  return {
    items: board.items.length,
    notes,
    connectors,
    comments: board.comments.length,
    words,
    updated: formatRelativeTime(board.updatedAt),
  };
}
