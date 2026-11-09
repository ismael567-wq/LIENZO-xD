export type Tool =
  | 'select'
  | 'hand'
  | 'sticky'
  | 'text'
  | 'shape'
  | 'connector'
  | 'pen'
  | 'highlighter'
  | 'laser'
  | 'image'
  | 'frame'
  | 'comment'
  | 'eraser';

export type ShapeKind = 'rect' | 'ellipse' | 'diamond';
export type BackgroundKind = 'dots' | 'grid' | 'plain';
export type Theme = 'light' | 'dark';
export type ThemeMode = 'auto' | 'light' | 'dark';
export type FillStyle = 'solid' | 'hachure' | 'cross-hatch' | 'dots';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type EdgeStyle = 'sharp' | 'round';
export type ConnectorLineType = 'straight' | 'elbow' | 'curve';
export type ConnectorCap = 'none' | 'arrow' | 'dot' | 'crowfoot' | 'crowfoot-many';
export type AnchorSide = 'top' | 'right' | 'bottom' | 'left';
export type FrameBackground = 'plain' | 'dots' | 'grid' | 'lines' | 'music' | 'axes';
export type FontFamily = 'sans' | 'serif' | 'mono';
export type TemplateId =
  | 'blank'
  | 'welcome'
  | 'brainstorm'
  | 'retro'
  | 'kanban'
  | 'mindmap'
  | 'flow'
  | 'journey'
  | 'week';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface ItemBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  updatedAt: number;
  locked?: boolean;
  opacity?: number;
  /** Elements sharing a group id are selected, moved and duplicated together. */
  groupId?: string;
  /** Capa lógica; permite ocultar y bloquear grupos de elementos. */
  layerId?: string;
  /** Oculto en el lienzo y en las exportaciones. */
  hidden?: boolean;
  /** Enlace a otro elemento o pizarra (portal). */
  linkTo?: string;
  /** Comentario o nota de voz adjunta al objeto. */
  voiceNote?: VoiceNote;
}

export interface VoiceNote {
  fileId: string;
  mime: string;
  duration: number;
  waveform: number[];
  author?: string;
  createdAt: number;
}

export interface FileItem extends ItemBase {
  type: 'file';
  name: string;
  mime: string;
  size: number;
  /** Clave del binario en OPFS / IndexedDB. */
  fileId: string;
  /** Miniatura compacta en data URL para pintar la tarjeta. */
  preview?: string;
  kind: 'file' | 'pdf' | 'video' | 'audio' | 'csv' | 'doc' | 'sheet';
  /** Página actual para documentos paginados. */
  page?: number;
  pages?: number;
  /** Texto extraído (CSV, TXT, código) para vista previa y búsqueda. */
  text?: string;
}

export interface TimerItem extends ItemBase {
  type: 'timer';
  label: string;
  /** Duración total en segundos. */
  duration: number;
  /** Fin previsto cuando corre; null si está en pausa. */
  endsAt: number | null;
  /** Segundos restantes cuando está en pausa. */
  remaining: number;
  running: boolean;
  sound: boolean;
}

export interface StickyItem extends ItemBase {
  type: 'sticky';
  text: string;
  fill: string;
  textColor: string;
  fontSize: number;
  author?: string;
}

export interface ShapeItem extends ItemBase {
  type: 'shape';
  shape: ShapeKind;
  text: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  fontSize: number;
  textColor: string;
  fillStyle?: FillStyle;
  strokeStyle?: StrokeStyle;
  edge?: EdgeStyle;
}

export interface TextItem extends ItemBase {
  type: 'text';
  text: string;
  fontSize: number;
  color: string;
  align: 'left' | 'center';
  fontWeight: 400 | 500 | 600 | 700;
  fontFamily?: FontFamily;
  italic?: boolean;
}

export interface DrawItem extends ItemBase {
  type: 'draw';
  points: Point[];
  color: string;
  strokeWidth: number;
  highlighter?: boolean;
}

export interface ImageItem extends ItemBase {
  type: 'image';
  src: string;
  alt: string;
  radius: number;
}

export interface FrameItem extends ItemBase {
  type: 'frame';
  title: string;
  fill: string;
  /** Fondo propio del marco; si falta, hereda el del tablero. */
  background?: FrameBackground;
}

export interface Anchor {
  itemId?: string;
  x: number;
  y: number;
  /** Lado magnético del objeto al que se ancla. */
  side?: AnchorSide;
  /** Posición 0–1 a lo largo del lado elegido. */
  offset?: number;
}

export interface ConnectorItem {
  id: string;
  type: 'connector';
  from: Anchor;
  to: Anchor;
  color: string;
  strokeWidth: number;
  dashed: boolean;
  arrowStart: boolean;
  arrowEnd: boolean;
  label: string;
  lineType?: ConnectorLineType;
  /**terminales decorativos; si faltan se derivan de arrowStart/arrowEnd. */
  startCap?: ConnectorCap;
  endCap?: ConnectorCap;
  updatedAt: number;
  opacity?: number;
  groupId?: string;
  layerId?: string;
  hidden?: boolean;
  linkTo?: string;
  voiceNote?: VoiceNote;
  /** Connectors are positioned by their anchors; these keep the union uniform. */
  x: number;
  y: number;
  w: number;
  h: number;
  locked?: boolean;
}

export type BoardItem =
  | StickyItem
  | ShapeItem
  | TextItem
  | DrawItem
  | ImageItem
  | FrameItem
  | FileItem
  | TimerItem
  | ConnectorItem;

export type ItemType = BoardItem['type'];

export interface CommentPin {
  id: string;
  x: number;
  y: number;
  text: string;
  author: string;
  createdAt: number;
  resolved: boolean;
}

export interface Board {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: BoardItem[];
  comments: CommentPin[];
  background: BackgroundKind;
  gridSize?: number;
  favorite?: boolean;
  /** Carpeta lógica del tablero en el home. */
  folder?: string;
  /** Marca de borrado suave; la papelera permite restaurarlo. */
  deletedAt?: number;
  /** Bloquea la edición del lienzo sin impedir mover la vista. */
  locked?: boolean;
}

export interface HistorySnapshot {
  items: BoardItem[];
  comments: CommentPin[];
  name: string;
  background: BackgroundKind;
  locked?: boolean;
}

export interface Peer {
  id: string;
  name: string;
  color: string;
  cursor?: Point;
  lastSeen: number;
}

export type CollabStatus = 'off' | 'connecting' | 'on' | 'error';

export interface CollabState {
  status: CollabStatus;
  url: string | null;
  error: string | null;
  peers: Peer[];
  selfId: string;
  selfName: string;
  selfColor: string;
  localServerUrl: string | null;
  lanUrls: string[];
}

export type SaveStatus = 'saved' | 'saving' | 'dirty';

export interface ToastMessage {
  id: string;
  text: string;
  kind: 'info' | 'success' | 'error';
}

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  description: string;
  tag: string;
}

export interface ServerInfo {
  port: number;
  lan: string[];
  rooms: number;
  version: string;
}

export type RemoteOp =
  | { kind: 'upsert'; item: BoardItem }
  | { kind: 'delete'; id: string }
  | { kind: 'meta'; name?: string; background?: BackgroundKind }
  | { kind: 'comments'; comments: CommentPin[] };

export type AnyItemPatch = Partial<
  Omit<StickyItem, 'type' | 'id'> &
    Omit<ShapeItem, 'type' | 'id'> &
    Omit<TextItem, 'type' | 'id'> &
    Omit<DrawItem, 'type' | 'id'> &
    Omit<ImageItem, 'type' | 'id'> &
    Omit<FrameItem, 'type' | 'id'> &
    Omit<FileItem, 'type' | 'id'> &
    Omit<TimerItem, 'type' | 'id'> &
    Omit<ConnectorItem, 'type' | 'id'>
>;
