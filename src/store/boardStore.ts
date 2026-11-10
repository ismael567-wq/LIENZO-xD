import { create } from 'zustand';
import type {
  AnyItemPatch,
  Board,
  BoardItem,
  ChatMessage,
  CollabState,
  CommentPin,
  HistorySnapshot,
  Peer,
  Piece,
  Point,
  ReactionBurst,
  Rect,
  RemoteOp,
  RoomRole,
  SaveStatus,
  ShapeKind,
  TemplateId,
  Theme,
  ThemeMode,
  ToastMessage,
  Tool,
  Viewport,
  VoiceNote,
} from '../types';
import {
  boundsOfItems,
  fitViewport,
  formatRelativeTime,
  getFrameSlides,
  itemRect,
  isConnector,
  rectsIntersect,
  screenToWorld,
  uid,
  wordCount,
} from '../lib/geometry';
import {
  userColor,
  applyTheme,
  loadThemeMode,
  resolveTheme,
  saveThemeMode,
} from '../lib/theme';
import { createBoard, createWelcomeBoard, DEFAULT_BOARD_NAME } from '../lib/templates';
import { duplicateItems, newSticky } from '../lib/factory';
import {
  loadBoards,
  loadFolders,
  loadServerUrl,
  loadUserName,
  saveBoards,
  saveFolders,
  saveServerUrl,
  saveUserName,
} from '../lib/storage';
import { defaultServerBase, normalizeServerBase } from '../lib/net';
import type { CollabClient } from '../lib/collab';

const HISTORY_LIMIT = 60;

type OverlayKey =
  | 'share'
  | 'templates'
  | 'shortcuts'
  | 'command'
  | 'newBoard'
  | 'about'
  | 'options'
  | 'search'
  | 'history';

export interface UiState {
  share: boolean;
  templates: boolean;
  shortcuts: boolean;
  command: boolean;
  newBoard: boolean;
  about: boolean;
  options: boolean;
  search: boolean;
  history: boolean;
}

export interface FocusTimerState {
  visible: boolean;
  /** Duración elegida, en minutos. */
  duration: number;
  /** Marca temporal de fin cuando está en marcha. */
  endsAt: number | null;
  /** Milisegundos restantes cuando está en pausa. */
  remaining: number;
  running: boolean;
}

export interface PresentationState {
  slides: Rect[];
  index: number;
  returnViewport: Viewport;
}

interface LienzoState {
  ready: boolean;
  boards: Board[];
  folders: string[];
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
  themeMode: ThemeMode;
  zen: boolean;
  gridSize: number;
  toast: ToastMessage | null;
  collab: CollabState;
  ui: UiState;
  presentation: PresentationState | null;
  timer: FocusTimerState;
  pieces: Piece[];
  mediaItemId: string | null;
  projector: boolean;
  study: { index: number; flipped: boolean } | null;
  offline: boolean;

  init: () => Promise<void>;
  createBoard: (template?: TemplateId, name?: string) => string | null;
  openBoard: (id: string) => void;
  closeBoard: () => void;
  renameBoard: (id: string, name: string) => void;
  deleteBoard: (id: string) => void;
  restoreBoard: (id: string) => void;
  purgeBoard: (id: string) => void;
  emptyTrash: () => void;
  duplicateBoard: (id: string) => void;
  toggleFavorite: (id: string) => void;
  moveBoardToFolder: (id: string, folder: string | null) => void;
  createFolder: (name: string) => string | null;
  renameFolder: (from: string, to: string) => void;
  deleteFolder: (name: string) => void;
  importBoard: (board: Board) => void;
  importWorkspace: (boards: Board[]) => void;

  setTool: (tool: Tool) => void;
  setShapeKind: (kind: ShapeKind) => void;
  setViewport: (viewport: Viewport) => void;
  setStageSize: (size: { w: number; h: number }) => void;
  fitToContent: (padding?: number, rightInset?: number) => void;
  focusRect: (rect: Rect, padding?: number, maxZoom?: number) => void;
  setSnapToGrid: (value: boolean) => void;
  setBackground: (background: Board['background']) => void;
  toggleBoardLock: () => void;
  restoreSnapshot: (snapshot: HistorySnapshot, label: string) => void;
  setTheme: (theme: Theme) => void;
  setThemeMode: (mode: ThemeMode) => void;
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

  addComment: (point: Point, text: string, audio?: VoiceNote) => void;
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

  openTimer: () => void;
  startTimer: (minutes?: number) => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  finishTimer: () => void;
  closeTimer: () => void;

  connectCollab: (baseUrl?: string) => Promise<void>;
  disconnectCollab: () => void;
  refreshServerInfo: () => Promise<void>;
  autoConnectIfServed: () => Promise<void>;
  sendCursor: (point: Point) => void;
  applyRemoteOps: (ops: RemoteOp[]) => void;

  /* v1.4: estructura del tablero */
  toggleNoteGrid: () => void;
  toggleRuler: () => void;
  toggleVeil: () => void;
  revealFrame: (id: string) => void;
  addPage: () => void;
  renamePage: (id: string, name: string) => void;
  deletePage: (id: string) => void;
  setCurrentPage: (id: string) => void;
  addLayer: () => void;
  renameLayer: (id: string, name: string) => void;
  toggleLayerHidden: (id: string) => void;
  toggleLayerLocked: (id: string) => void;
  assignSelectionToLayer: (layerId: string | null) => void;

  /* v1.4: objetos interactivos */
  addVote: (id: string) => void;
  clearVotes: (id: string) => void;
  flipFlashcard: (id: string) => void;
  linkSelected: (targetId: string | null, label?: string) => void;
  zoomToFrame: (id: string) => void;

  /* v1.4: sala */
  sendChat: (text: string) => void;
  sendReaction: (emoji: string, point?: Point) => void;
  setRole: (role: RoomRole) => void;
  followPeer: (id: string | null) => void;
  bringAllPeers: () => void;

  /* v1.4: medios y estudio */
  openMedia: (id: string) => void;
  closeMedia: () => void;
  setPdfPage: (fileId: string, page: number) => void;
  toggleProjector: () => void;
  setStudy: (value: { index: number; flipped: boolean } | null) => void;
  setOffline: (value: boolean) => void;

  /* v1.4: biblioteca de piezas */
  loadPieces: () => void;
  savePiece: (name: string) => void;
  deletePiece: (id: string) => void;
  insertPiece: (id: string) => void;
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

const INITIAL_THEME_MODE = loadThemeMode();
const INITIAL_THEME = resolveTheme(INITIAL_THEME_MODE);
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
  clone.deletedAt = undefined;
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
    role: 'editor',
    chat: [],
    reactions: [],
    followId: null,
  };
}

const PIECES_KEY = 'lienzo:pieces:v1';

function loadPieces(): Piece[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PIECES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Piece[];
    return Array.isArray(parsed) ? parsed.filter((piece) => Array.isArray(piece.items)) : [];
  } catch {
    return [];
  }
}

function savePieces(pieces: Piece[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PIECES_KEY, JSON.stringify(pieces));
  } catch {
    // A full quota should never break the board.
  }
}

let collabClient: CollabClient | null = null;
let collabUnsubscribe: (() => void) | null = null;

export const useLienzo = create<LienzoState>()((set, get) => {
  const mutateBoard = (
    updater: (board: Board) => Board,
    options: { history?: boolean; snapshot?: HistorySnapshot; allowViewer?: boolean } = {},
  ): Board | null => {
    const state = get();
    if (!options.allowViewer && state.collab.role === 'viewer') return null;
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
    folders: [],
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
    themeMode: INITIAL_THEME_MODE,
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
      options: false,
      search: false,
      history: false,
    },
    presentation: null,
    pieces: [],
    mediaItemId: null,
    projector: false,
    study: null,
    offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    timer: {
      visible: false,
      duration: 25,
      endsAt: null,
      remaining: 25 * 60 * 1000,
      running: false,
    },

    init: async () => {
      if (get().ready) return;
      const stored = await loadBoards();
      let boards = stored ?? seedBoards();
      const savedFolders = loadFolders();
      const folders = Array.from(
        new Set([
          ...savedFolders,
          ...boards
            .map((board) => board.folder?.trim())
            .filter((value): value is string => Boolean(value)),
        ]),
      );
      const userName = loadUserName();
      const collab = get().collab;
      const match =
        typeof window !== 'undefined'
          ? window.location.hash.match(/^#\/b\/([A-Za-z0-9_-]+)$/)
          : null;
      let deepLinked = match
        ? boards.find((board) => board.id === match[1] && !board.deletedAt)
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
      saveFolders(folders);
      set({
        boards,
        folders,
        ready: true,
        userName,
        pieces: loadPieces(),
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
      if (!board || board.deletedAt) return;
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
          options: false,
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
      const target = state.boards.find((board) => board.id === id);
      if (!target) return;
      const nextBoards = state.boards.map((board) =>
        board.id === id
          ? { ...board, deletedAt: Date.now(), updatedAt: Date.now() }
          : board,
      );
      const activeCount = nextBoards.filter((board) => !board.deletedAt).length;
      const boards =
        activeCount === 0 ? [createWelcomeBoard(), ...nextBoards] : nextBoards;
      set({
        boards,
        boardId: state.boardId === id ? null : state.boardId,
        selected: [],
        saveStatus: 'dirty',
      });
      if (state.boardId === id) {
        get().disconnectCollab();
        syncHash(null);
      }
      get().showToast('Movido a la papelera. Puedes restaurarlo cuando quieras.', 'info');
    },

    restoreBoard: (id) => {
      set((state) => ({
        boards: state.boards.map((board) =>
          board.id === id
            ? { ...board, deletedAt: undefined, updatedAt: Date.now() }
            : board,
        ),
        saveStatus: 'dirty',
      }));
      get().showToast('Tablero restaurado.', 'success');
    },

    purgeBoard: (id) => {
      const state = get();
      const remaining = state.boards.filter((board) => board.id !== id);
      const boards = remaining.length === 0 ? [createWelcomeBoard()] : remaining;
      set({
        boards,
        boardId: state.boardId === id ? null : state.boardId,
        selected: [],
        saveStatus: 'dirty',
      });
      if (state.boardId === id) {
        get().disconnectCollab();
        syncHash(null);
      }
      get().showToast('Tablero eliminado definitivamente.', 'info');
    },

    emptyTrash: () => {
      const state = get();
      const trashed = state.boards.filter((board) => board.deletedAt);
      if (trashed.length === 0) return;
      const remaining = state.boards.filter((board) => !board.deletedAt);
      const boards = remaining.length === 0 ? [createWelcomeBoard()] : remaining;
      set({
        boards,
        boardId: state.boardId && trashed.some((board) => board.id === state.boardId)
          ? null
          : state.boardId,
        selected: [],
        saveStatus: 'dirty',
      });
      if (state.boardId && trashed.some((board) => board.id === state.boardId)) {
        get().disconnectCollab();
        syncHash(null);
      }
      get().showToast(
        `${trashed.length} tablero${trashed.length === 1 ? '' : 's'} eliminado${
          trashed.length === 1 ? '' : 's'
        } definitivamente.`,
        'info',
      );
    },

    moveBoardToFolder: (id, folder) => {
      const clean = folder?.trim() || null;
      set((state) => {
        const folders =
          clean && !state.folders.includes(clean)
            ? [...state.folders, clean]
            : state.folders;
        return {
          folders,
          boards: state.boards.map((board) =>
            board.id === id
              ? { ...board, folder: clean ?? undefined, updatedAt: Date.now() }
              : board,
          ),
          saveStatus: 'dirty',
        };
      });
      get().showToast(
        clean ? `Tablero movido a «${clean}».` : 'Tablero movido fuera de las carpetas.',
        'success',
      );
    },

    createFolder: (name) => {
      const clean = name.trim();
      if (!clean) return null;
      if (get().folders.includes(clean)) {
        get().showToast('Ya existe una carpeta con ese nombre.', 'error');
        return clean;
      }
      set((state) => ({
        folders: [...state.folders, clean],
        saveStatus: 'dirty',
      }));
      get().showToast(`Carpeta «${clean}» creada.`, 'success');
      return clean;
    },

    renameFolder: (from, to) => {
      const clean = to.trim();
      if (!clean || clean === from) return;
      set((state) => ({
        folders: state.folders.map((folder) => (folder === from ? clean : folder)),
        boards: state.boards.map((board) =>
          board.folder === from ? { ...board, folder: clean } : board,
        ),
        saveStatus: 'dirty',
      }));
      get().showToast(`Carpeta renombrada a «${clean}».`, 'success');
    },

    deleteFolder: (name) => {
      set((state) => ({
        folders: state.folders.filter((folder) => folder !== name),
        boards: state.boards.map((board) =>
          board.folder === name ? { ...board, folder: undefined } : board,
        ),
        saveStatus: 'dirty',
      }));
      get().showToast(`Carpeta «${name}» eliminada. Los tableros siguen en «Todos».`, 'info');
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
      imported.folder = undefined;
      imported.deletedAt = undefined;
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

    importWorkspace: (boards) => {
      if (boards.length === 0) return;
      const existingIds = new Set(get().boards.map((board) => board.id));
      const now = Date.now();
      const imported = boards.map((board, index) => {
        const clone = structuredClone(board);
        if (!clone.id || existingIds.has(clone.id)) clone.id = uid(12);
        existingIds.add(clone.id);
        clone.createdAt = clone.createdAt || now;
        clone.updatedAt = now;
        clone.favorite = false;
        clone.deletedAt = undefined;
        if (index === 0) clone.name = clone.name || 'Workspace importado';
        return clone;
      });
      set((state) => ({
        boards: [...imported, ...state.boards],
        folders: Array.from(
          new Set([
            ...state.folders,
            ...imported
              .map((board) => board.folder?.trim())
              .filter((value): value is string => Boolean(value)),
          ]),
        ),
        boardId: imported[0]?.id ?? state.boardId,
        selected: [],
        past: [],
        future: [],
        saveStatus: 'dirty',
      }));
      if (imported[0]) syncHash(imported[0].id);
      setTimeout(() => get().fitToContent(90), 40);
      get().showToast(
        `Workspace importado: ${imported.length} tablero${imported.length === 1 ? '' : 's'}.`,
        'success',
      );
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

    toggleBoardLock: () => {
      const board = currentBoardOf(get());
      if (!board) return;
      const locked = !board.locked;
      mutateBoard((current) => ({ ...current, locked }), { history: true });
      set({ selected: [], editingId: null, tool: locked ? 'hand' : 'select' });
      get().showToast(
        locked
          ? 'Pizarra bloqueada: puedes moverte por ella, pero no editarla.'
          : 'Pizarra desbloqueada. Ya puedes editar.',
        'info',
      );
    },

    restoreSnapshot: (snapshot, label) => {
      const board = currentBoardOf(get());
      if (!board) return;
      mutateBoard(
        (current) => ({ ...current, ...structuredClone(snapshot) }),
        { history: true },
      );
      set({
        selected: [],
        editingId: null,
        saveStatus: 'dirty',
      });
      get().showToast(`Versión restaurada: ${label}.`, 'success');
    },

    setTheme: (theme) => {
      saveThemeMode(theme);
      applyTheme(theme);
      set({ theme, themeMode: theme });
    },

    setThemeMode: (mode) => {
      const theme = resolveTheme(mode);
      saveThemeMode(mode);
      applyTheme(theme);
      set({ theme, themeMode: mode });
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
      const current = currentBoardOf(get());
      const placed =
        current && current.pages && current.pages.length > 0 && item.type !== 'connector'
          ? {
              ...item,
              pageId:
                (item as { pageId?: string }).pageId ?? current.currentPageId,
            }
          : item;
      mutateBoard((board) => ({ ...board, items: [...board.items, placed] }), {
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

    addComment: (point, text, audio) => {
      const clean = text.trim();
      if (!clean && !audio) return;
      const author = get().userName;
      const comment: CommentPin = {
        id: uid(9),
        x: point.x,
        y: point.y,
        text: clean,
        author,
        createdAt: Date.now(),
        resolved: false,
        ...(audio ? { audio } : {}),
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

    openTimer: () => {
      const timer = get().timer;
      set({ timer: { ...timer, visible: true } });
    },

    startTimer: (minutes) => {
      const duration = Math.max(1, Math.min(180, Math.round(minutes ?? get().timer.duration)));
      const ms = duration * 60 * 1000;
      set({
        timer: {
          visible: true,
          duration,
          endsAt: Date.now() + ms,
          remaining: ms,
          running: true,
        },
      });
    },

    toggleTimer: () => {
      const timer = get().timer;
      if (timer.running) {
        const remaining = Math.max(0, (timer.endsAt ?? Date.now()) - Date.now());
        set({
          timer: { ...timer, running: false, endsAt: null, remaining },
        });
        return;
      }
      const remaining = timer.remaining > 0 ? timer.remaining : timer.duration * 60 * 1000;
      set({
        timer: {
          ...timer,
          visible: true,
          running: true,
          endsAt: Date.now() + remaining,
          remaining,
        },
      });
    },

    resetTimer: () => {
      const timer = get().timer;
      set({
        timer: {
          ...timer,
          running: false,
          endsAt: null,
          remaining: timer.duration * 60 * 1000,
        },
      });
    },

    finishTimer: () => {
      const timer = get().timer;
      set({
        timer: {
          ...timer,
          running: false,
          endsAt: null,
          remaining: 0,
        },
      });
      get().showToast('Tiempo de foco completado. Tómate una pausa.', 'success');
    },

    closeTimer: () => {
      const timer = get().timer;
      set({ timer: { ...timer, visible: false } });
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
            if (get().collab.followId === peerId) {
              get().focusRect(
                { x: point.x - 380, y: point.y - 280, w: 760, h: 560 },
                40,
                1.15,
              );
            }
          },
          onChat: (message) => {
            set((current) => ({
              collab: {
                ...current.collab,
                chat: [...current.collab.chat, message].slice(-200),
              },
            }));
          },
          onReaction: (reaction) => {
            set((current) => ({
              collab: {
                ...current.collab,
                reactions: [...current.collab.reactions, reaction].slice(-40),
              },
            }));
            window.setTimeout(() => {
              set((current) => ({
                collab: {
                  ...current.collab,
                  reactions: current.collab.reactions.filter(
                    (entry) => entry.id !== reaction.id,
                  ),
                },
              }));
            }, 2600);
          },
          onViewport: (nextViewport) => {
            if (get().collab.followId) return;
            set({ viewport: nextViewport });
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

    /* v1.4: estructura del tablero */
    toggleNoteGrid: () => {
      mutateBoard((board) => ({ ...board, noteGrid: !board.noteGrid }), { history: true });
      get().showToast(
        currentBoardOf(get())?.noteGrid
          ? 'Rejilla de notas activada.'
          : 'Rejilla de notas desactivada.',
        'info',
      );
    },

    toggleRuler: () => {
      mutateBoard((board) => ({ ...board, ruler: !board.ruler }), { history: true });
      get().showToast(
        currentBoardOf(get())?.ruler ? 'Regla y ejes activados.' : 'Regla y ejes ocultos.',
        'info',
      );
    },

    toggleVeil: () => {
      const board = currentBoardOf(get());
      if (!board) return;
      const veil = !board.veil;
      mutateBoard((current) => ({ ...current, veil }), { history: true });
      get().showToast(
        veil
          ? 'Velo activado: los marcos ocultos se revelan con un clic.'
          : 'Velo desactivado.',
        'info',
      );
    },

    revealFrame: (id) => {
      mutateBoard(
        (board) => ({
          ...board,
          revealedFrames: Array.from(new Set([...(board.revealedFrames ?? []), id])),
        }),
        { allowViewer: true },
      );
    },

    addPage: () => {
      const board = currentBoardOf(get());
      if (!board) return;
      const pages =
        board.pages && board.pages.length > 0
          ? board.pages
          : [{ id: board.currentPageId ?? uid(8), name: 'Página 1' }];
      const page = { id: uid(8), name: `Página ${pages.length + 1}` };
      mutateBoard(
        (current) => ({
          ...current,
          pages: [...pages, page],
          currentPageId: page.id,
        }),
        { history: true },
      );
      set({ selected: [], editingId: null });
      get().showToast(`${page.name} añadida.`, 'success');
    },

    renamePage: (id, name) => {
      const clean = name.trim();
      if (!clean) return;
      mutateBoard((board) => ({
        ...board,
        pages: (board.pages ?? []).map((page) =>
          page.id === id ? { ...page, name: clean } : page,
        ),
      }));
    },

    deletePage: (id) => {
      const board = currentBoardOf(get());
      if (!board) return;
      const pages = board.pages ?? [];
      if (pages.length <= 1) {
        get().showToast('El tablero necesita al menos una página.', 'info');
        return;
      }
      const nextPages = pages.filter((page) => page.id !== id);
      const nextCurrent =
        board.currentPageId === id ? nextPages[0]?.id : board.currentPageId;
      mutateBoard(
        (current) => ({
          ...current,
          pages: nextPages,
          currentPageId: nextCurrent,
          items: current.items.filter(
            (item) => (item as { pageId?: string }).pageId !== id,
          ),
        }),
        { history: true },
      );
      set({ selected: [], editingId: null });
      get().showToast('Página eliminada con sus elementos.', 'info');
    },

    setCurrentPage: (id) => {
      mutateBoard((board) => ({ ...board, currentPageId: id }), { allowViewer: true });
      set({ selected: [], editingId: null });
    },

    addLayer: () => {
      const board = currentBoardOf(get());
      if (!board) return;
      const layers =
        board.layers && board.layers.length > 0
          ? board.layers
          : [{ id: 'base', name: 'Capa 1' }];
      const layer = { id: uid(8), name: `Capa ${layers.length + 1}` };
      mutateBoard((current) => ({ ...current, layers: [...layers, layer] }), {
        history: true,
      });
      get().showToast(`${layer.name} creada.`, 'success');
    },

    renameLayer: (id, name) => {
      const clean = name.trim();
      if (!clean) return;
      mutateBoard((board) => ({
        ...board,
        layers: (board.layers ?? []).map((layer) =>
          layer.id === id ? { ...layer, name: clean } : layer,
        ),
      }));
    },

    toggleLayerHidden: (id) => {
      mutateBoard((board) => ({
        ...board,
        layers: (board.layers ?? []).map((layer) =>
          layer.id === id ? { ...layer, hidden: !layer.hidden } : layer,
        ),
      }));
      setTimeout(() => {
        const board = currentBoardOf(get());
        if (!board) return;
        const layer = (board.layers ?? []).find((candidate) => candidate.id === id);
        if (layer?.hidden) {
          set({
            selected: get().selected.filter(
              (selectedId) =>
                board.items.find((item) => item.id === selectedId)?.layerId !== id,
            ),
          });
        }
      }, 0);
    },

    toggleLayerLocked: (id) => {
      const board = currentBoardOf(get());
      if (!board) return;
      const layer = (board.layers ?? []).find((candidate) => candidate.id === id);
      if (!layer) return;
      const locked = !layer.locked;
      mutateBoard(
        (current) => ({
          ...current,
          layers: (current.layers ?? []).map((candidate) =>
            candidate.id === id ? { ...candidate, locked } : candidate,
          ),
          items: current.items.map((item) =>
            item.layerId === id ? { ...item, locked } : item,
          ),
        }),
        { history: true },
      );
      get().showToast(
        locked ? `Capa «${layer.name}» bloqueada.` : `Capa «${layer.name}» desbloqueada.`,
        'info',
      );
    },

    assignSelectionToLayer: (layerId) => {
      const state = get();
      if (state.selected.length === 0) return;
      state.pushHistory();
      state.updateItems(
        state.selected.map((id) => ({ id, patch: { layerId: layerId ?? undefined } })),
      );
      get().showToast(
        layerId ? 'Elementos movidos de capa.' : 'Elementos sin capa.',
        'success',
      );
    },

    /* v1.4: objetos interactivos */
    addVote: (id) => {
      const voter = get().userName;
      mutateBoard((board) => ({
        ...board,
        items: board.items.map((item) => {
          if (item.id !== id) return item;
          const votes: string[] = (item as { votes?: string[] }).votes ?? [];
          return {
            ...item,
            votes: votes.includes(voter)
              ? votes.filter((entry) => entry !== voter)
              : [...votes, voter],
            updatedAt: Date.now(),
          } as BoardItem;
        }),
      }));
    },

    clearVotes: (id) => {
      mutateBoard((board) => ({
        ...board,
        items: board.items.map((item) =>
          item.id === id ? ({ ...item, votes: [] } as BoardItem) : item,
        ),
      }));
    },

    flipFlashcard: (id) => {
      mutateBoard((board) => ({
        ...board,
        items: board.items.map((item) =>
          item.id === id && item.type === 'flashcard'
            ? { ...item, flipped: !item.flipped, updatedAt: Date.now() }
            : item,
        ),
      }));
    },

    linkSelected: (targetId, label) => {
      const state = get();
      if (state.selected.length === 0) return;
      state.pushHistory();
      state.updateItems(
        state.selected.map((id) => ({
          id,
          patch: {
            linkTo: targetId ?? undefined,
            linkLabel: targetId ? label?.trim() || targetId : undefined,
          },
        })),
      );
      get().showToast(
        targetId ? 'Portal creado. Doble clic en el objeto para viajar.' : 'Portal eliminado.',
        targetId ? 'success' : 'info',
      );
    },

    zoomToFrame: (id) => {
      const board = currentBoardOf(get());
      const frame = board?.items.find((item) => item.id === id && item.type === 'frame');
      if (!frame) return;
      get().focusRect(
        { x: frame.x - 30, y: frame.y - 50, w: frame.w + 60, h: frame.h + 80 },
        60,
        2.2,
      );
    },

    /* v1.4: sala */
    sendChat: (text) => {
      const clean = text.trim();
      if (!clean) return;
      const state = get();
      const message: ChatMessage = {
        id: uid(8),
        author: state.userName,
        authorId: state.collab.selfId,
        text: clean.slice(0, 800),
        at: Date.now(),
        kind: 'text',
      };
      set((current) => ({
        collab: { ...current.collab, chat: [...current.collab.chat, message].slice(-200) },
      }));
      collabClient?.sendChat(message.text);
    },

    sendReaction: (emoji, point) => {
      const state = get();
      const world =
        point ??
        screenToWorld(
          { x: state.stageSize.w / 2, y: state.stageSize.h / 2 },
          state.viewport,
        );
      const reaction: ReactionBurst = {
        id: uid(8),
        emoji,
        x: world.x,
        y: world.y,
        at: Date.now(),
        author: state.userName,
      };
      set((current) => ({
        collab: {
          ...current.collab,
          reactions: [...current.collab.reactions, reaction].slice(-40),
        },
      }));
      collabClient?.sendReaction(emoji, world.x, world.y);
      window.setTimeout(() => {
        set((current) => ({
          collab: {
            ...current.collab,
            reactions: current.collab.reactions.filter((entry) => entry.id !== reaction.id),
          },
        }));
      }, 2600);
    },

    setRole: (role) => {
      set((current) => ({
        collab: { ...current.collab, role },
        ...(role === 'viewer'
          ? { selected: [], editingId: null, tool: 'hand' as Tool }
          : {}),
      }));
      collabClient?.setRole(role);
      get().showToast(
        role === 'viewer'
          ? 'Ahora estás en modo lector: no se envían cambios.'
          : 'Ahora puedes editar y compartir cambios.',
        'info',
      );
    },

    followPeer: (id) => {
      set((current) => ({ collab: { ...current.collab, followId: id } }));
      const peer = get().collab.peers.find((candidate) => candidate.id === id);
      if (peer?.cursor) {
        get().focusRect(
          { x: peer.cursor.x - 400, y: peer.cursor.y - 300, w: 800, h: 600 },
          40,
          1.2,
        );
      }
      if (id) get().showToast(`Siguiendo a ${peer?.name ?? 'un compañero'}.`, 'info');
    },

    bringAllPeers: () => {
      const state = get();
      collabClient?.shareViewport(state.viewport);
      get().showToast('Vista compartida con la sala.', 'success');
    },

    /* v1.4: medios y estudio */
    openMedia: (id) => set({ mediaItemId: id }),
    closeMedia: () => set({ mediaItemId: null }),

    setPdfPage: (fileId, page) => {
      mutateBoard(
        (board) => ({
          ...board,
          pdfPages: { ...(board.pdfPages ?? {}), [fileId]: Math.max(1, Math.round(page)) },
        }),
        { allowViewer: true },
      );
    },

    toggleProjector: () => {
      const next = !get().projector;
      if (next) {
        get().startPresentation();
        set({ projector: true, zen: true });
      } else {
        get().exitPresentation();
        set({ projector: false, zen: false });
      }
    },

    setStudy: (value) => set({ study: value }),

    setOffline: (value) => set({ offline: value }),

    /* v1.4: biblioteca de piezas */
    loadPieces: () => set({ pieces: loadPieces() }),

    savePiece: (name) => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board) return;
      const items = board.items.filter((item) => state.selected.includes(item.id));
      if (items.length === 0) {
        state.showToast('Selecciona uno o varios elementos para guardarlos.', 'info');
        return;
      }
      const piece: Piece = {
        id: uid(10),
        name: name.trim() || 'Pieza sin nombre',
        items: structuredClone(items),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const pieces = [piece, ...get().pieces].slice(0, 60);
      set({ pieces });
      savePieces(pieces);
      get().showToast(`Pieza «${piece.name}» guardada.`, 'success');
    },

    deletePiece: (id) => {
      const pieces = get().pieces.filter((piece) => piece.id !== id);
      set({ pieces });
      savePieces(pieces);
      get().showToast('Pieza eliminada.', 'info');
    },

    insertPiece: (id) => {
      const state = get();
      const board = currentBoardOf(state);
      const piece = state.pieces.find((candidate) => candidate.id === id);
      if (!board || !piece) return;
      const { items } = duplicateItems(piece.items, piece.items.map((item) => item.id));
      const bounds = boundsOfItems(items);
      const center = screenToWorld(
        { x: state.stageSize.w / 2, y: state.stageSize.h / 2 },
        state.viewport,
      );
      const offsetX = center.x - (bounds ? bounds.x + bounds.w / 2 : 0);
      const offsetY = center.y - (bounds ? bounds.y + bounds.h / 2 : 0);
      const placed = items.map((item) =>
        item.type === 'connector'
          ? item
          : {
              ...item,
              x: item.x + offsetX,
              y: item.y + offsetY,
              pageId: board.currentPageId,
            },
      );
      mutateBoard((current) => ({ ...current, items: [...current.items, ...placed] }), {
        history: true,
      });
      set({ selected: placed.map((item) => item.id), editingId: null });
      get().showToast(`Pieza «${piece.name}» insertada.`, 'success');
    },

    applyRemoteOps: (ops) => {
      const state = get();
      const board = currentBoardOf(state);
      if (!board) return;
      let items = [...board.items];
      let comments = [...board.comments];
      let name = board.name;
      let background = board.background;
      let meta: Partial<Board> = {};
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
          const {
            kind: _kind,
            name: nextName,
            background: nextBackground,
            ...rest
          } = op;
          if (nextName) name = nextName;
          if (nextBackground) background = nextBackground;
          meta = { ...meta, ...rest };
        } else if (op.kind === 'comments') {
          comments = op.comments;
        }
      }
      const nextBoard: Board = {
        ...board,
        ...meta,
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
