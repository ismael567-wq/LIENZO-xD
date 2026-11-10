import type {
  Board,
  ChatMessage,
  CollabStatus,
  Peer,
  Point,
  ReactionBurst,
  RemoteOp,
  RoomRole,
  Viewport,
} from '../types';
import { wsUrlFromBase } from './net';

interface CollabOptions {
  baseUrl: string;
  board: Board;
  user: { id: string; name: string; color: string };
  onStatus: (status: CollabStatus, error?: string) => void;
  onPeers: (peers: Peer[]) => void;
  onBoard: (board: Board) => void;
  onOps: (ops: RemoteOp[]) => void;
  onCursor: (peerId: string, point: Point) => void;
  onChat?: (message: ChatMessage) => void;
  onReaction?: (reaction: ReactionBurst) => void;
  onViewport?: (viewport: Viewport) => void;
}

interface ServerMessage {
  type: string;
  board?: Board;
  peers?: Peer[];
  peer?: Peer;
  peerId?: string;
  ops?: RemoteOp[];
  id?: string;
  x?: number;
  y?: number;
  zoom?: number;
  message?: string;
  from?: string;
  role?: RoomRole;
  emoji?: string;
  author?: string;
  authorId?: string;
  text?: string;
  at?: number;
}

function metaDiff(previous: Board, next: Board): Array<RemoteOp> {
  const meta: Extract<RemoteOp, { kind: 'meta' }> = { kind: 'meta' };
  if (previous.name !== next.name) meta.name = next.name;
  if (previous.background !== next.background) meta.background = next.background;
  const keys = [
    'pages',
    'currentPageId',
    'layers',
    'noteGrid',
    'ruler',
    'veil',
    'revealedFrames',
    'pdfPages',
    'locked',
  ] as const;
  for (const key of keys) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) {
      (meta as Record<string, unknown>)[key] = next[key];
    }
  }
  return Object.keys(meta).length > 1 ? [meta] : [];
}

function diffBoards(previous: Board, next: Board): RemoteOp[] {
  const ops: RemoteOp[] = [];
  const previousItems = new Map(previous.items.map((item) => [item.id, item]));
  const nextIds = new Set(next.items.map((item) => item.id));
  for (const item of next.items) {
    const old = previousItems.get(item.id);
    if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
      ops.push({ kind: 'upsert', item });
    }
  }
  for (const id of previousItems.keys()) {
    if (!nextIds.has(id)) ops.push({ kind: 'delete', id });
  }
  ops.push(...metaDiff(previous, next));
  if (JSON.stringify(previous.comments) !== JSON.stringify(next.comments)) {
    ops.push({ kind: 'comments', comments: next.comments });
  }
  return ops;
}

function applyOpsToBoard(board: Board, ops: RemoteOp[]): Board {
  let items = [...board.items];
  let comments = board.comments;
  let name = board.name;
  let background = board.background;
  let meta: Partial<Board> = {};
  for (const op of ops) {
    if (op.kind === 'upsert') {
      const index = items.findIndex((item) => item.id === op.item.id);
      if (index >= 0) items[index] = op.item;
      else items = [...items, op.item];
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
  return { ...board, ...meta, items, comments, name, background };
}

export class CollabClient {
  private options: CollabOptions;
  private socket: WebSocket | null = null;
  private shadow: Board;
  private joined = false;
  private intentionalClose = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingBoard: Board | null = null;
  private cursorTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCursorSent = 0;
  private lastCursor: Point = { x: 0, y: 0 };
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  constructor(options: CollabOptions) {
    this.options = options;
    this.shadow = structuredClone(options.board);
  }

  connect(): void {
    this.openSocket();
  }

  private openSocket(): void {
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Ignore close errors while replacing a socket.
      }
    }
    const url = wsUrlFromBase(this.options.baseUrl);
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (error) {
      this.options.onStatus(
        'error',
        error instanceof Error ? error.message : 'URL de sala inválida.',
      );
      return;
    }
    this.socket = socket;
    this.joined = false;
    socket.onopen = () => {
      this.options.onStatus('connecting');
      this.send({
        type: 'join',
        boardId: this.shadow.id,
        user: this.options.user,
        snapshot: this.shadow,
      });
      this.startHeartbeat();
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        this.handleMessage(message);
      } catch {
        // Ignore malformed frames.
      }
    };
    socket.onerror = () => {
      // onclose carries the actionable state.
    };
    socket.onclose = () => {
      this.stopHeartbeat();
      this.joined = false;
      if (this.intentionalClose) return;
      if (this.reconnectAttempts < 4) {
        this.reconnectAttempts += 1;
        this.options.onStatus(
          'connecting',
          `Reconectando (${this.reconnectAttempts}/4)…`,
        );
        this.reconnectTimer = setTimeout(
          () => this.openSocket(),
          700 * this.reconnectAttempts,
        );
      } else {
        this.options.onStatus(
          'error',
          'No se pudo conectar. Comprueba que el servidor de sala esté activo y en la misma red.',
        );
      }
    };
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome': {
        this.joined = true;
        this.reconnectAttempts = 0;
        if (message.board) {
          this.shadow = structuredClone(message.board);
          this.options.onBoard(this.shadow);
        }
        this.currentPeerList = message.peers ?? [];
        this.options.onPeers(this.currentPeerList);
        this.options.onStatus('on');
        break;
      }
      case 'peers': {
        this.currentPeerList = message.peers ?? [];
        this.options.onPeers(this.currentPeerList);
        break;
      }
      case 'joined': {
        if (message.peer) {
          this.currentPeerList = [
            ...this.currentPeerList.filter((peer) => peer.id !== message.peer?.id),
            message.peer,
          ];
          this.options.onPeers(this.currentPeerList);
        }
        break;
      }
      case 'left': {
        this.currentPeerList = this.currentPeerList.filter(
          (peer) => peer.id !== message.peerId,
        );
        this.options.onPeers(this.currentPeerList);
        break;
      }
      case 'ops': {
        const ops = message.ops ?? [];
        this.shadow = applyOpsToBoard(this.shadow, ops);
        this.options.onOps(ops);
        break;
      }
      case 'cursor': {
        if (message.id && typeof message.x === 'number' && typeof message.y === 'number') {
          this.options.onCursor(message.id, { x: message.x, y: message.y });
        }
        break;
      }
      case 'chat': {
        if (typeof message.text === 'string' && message.text.trim()) {
          this.options.onChat?.({
            id: message.id ?? `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            author: message.author ?? 'Compañero',
            authorId: message.authorId ?? message.from ?? 'peer',
            text: message.text.slice(0, 800),
            at: typeof message.at === 'number' ? message.at : Date.now(),
            kind: 'text',
          });
        }
        break;
      }
      case 'reaction': {
        if (typeof message.emoji === 'string') {
          this.options.onReaction?.({
            id: message.id ?? `reaction-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            emoji: message.emoji.slice(0, 8),
            x: typeof message.x === 'number' ? message.x : 0,
            y: typeof message.y === 'number' ? message.y : 0,
            at: typeof message.at === 'number' ? message.at : Date.now(),
            author: message.author ?? 'Compañero',
          });
        }
        break;
      }
      case 'viewport': {
        if (
          typeof message.x === 'number' &&
          typeof message.y === 'number' &&
          typeof message.zoom === 'number'
        ) {
          this.options.onViewport?.({ x: message.x, y: message.y, zoom: message.zoom });
        }
        break;
      }
      case 'error': {
        this.options.onStatus('error', message.message ?? 'Error de sala.');
        break;
      }
      default:
        break;
    }
  }

  private currentPeerList: Peer[] = [];

  setPeers(peers: Peer[]): void {
    this.currentPeerList = peers;
    this.options.onPeers(peers);
  }

  queueSync(board: Board): void {
    if (!this.joined) {
      this.shadow = structuredClone(board);
      return;
    }
    this.pendingBoard = board;
    if (this.syncTimer) return;
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      const pending = this.pendingBoard;
      this.pendingBoard = null;
      if (!pending) return;
      this.flush(pending);
    }, 55);
  }

  private flush(board: Board): void {
    if (!this.joined) return;
    const ops = diffBoards(this.shadow, board);
    this.shadow = structuredClone(board);
    if (ops.length === 0) return;
    this.send({ type: 'ops', ops });
  }

  sendCursor(point: Point): void {
    this.lastCursor = point;
    const now = Date.now();
    const elapsed = now - this.lastCursorSent;
    if (elapsed > 55) {
      this.lastCursorSent = now;
      this.send({ type: 'cursor', x: point.x, y: point.y });
      return;
    }
    if (this.cursorTimer) return;
    this.cursorTimer = setTimeout(() => {
      this.cursorTimer = null;
      this.lastCursorSent = Date.now();
      this.send({ type: 'cursor', x: this.lastCursor.x, y: this.lastCursor.y });
    }, 55 - elapsed);
  }

  updateProfile(name: string, color: string): void {
    this.options.user = { ...this.options.user, name, color };
    this.send({ type: 'profile', name, color });
  }

  sendChat(text: string): void {
    this.send({ type: 'chat', text });
  }

  sendReaction(emoji: string, x: number, y: number): void {
    this.send({ type: 'reaction', emoji, x, y });
  }

  setRole(role: RoomRole): void {
    this.send({ type: 'role', role });
  }

  shareViewport(viewport: Viewport): void {
    this.send({ type: 'viewport', x: viewport.x, y: viewport.y, zoom: viewport.zoom });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => this.send({ type: 'ping' }), 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private send(payload: unknown): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    try {
      this.socket.send(JSON.stringify(payload));
    } catch {
      // The close handler will report the failure.
    }
  }

  destroy(): void {
    this.intentionalClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.syncTimer) clearTimeout(this.syncTimer);
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
    this.reconnectTimer = null;
    this.syncTimer = null;
    this.cursorTimer = null;
    try {
      this.socket?.close();
    } catch {
      // Already closed.
    }
    this.socket = null;
  }
}
