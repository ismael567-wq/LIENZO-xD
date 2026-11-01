export type Tool =
  | 'select'
  | 'hand'
  | 'sticky'
  | 'text'
  | 'shape'
  | 'connector'
  | 'pen'
  | 'highlighter'
  | 'image'
  | 'frame'
  | 'comment'
  | 'eraser';

export type ShapeKind = 'rect' | 'ellipse' | 'diamond';
export type BackgroundKind = 'dots' | 'grid' | 'plain';
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
}

export interface TextItem extends ItemBase {
  type: 'text';
  text: string;
  fontSize: number;
  color: string;
  align: 'left' | 'center';
  fontWeight: 400 | 500 | 600 | 700;
  fontFamily?: 'sans' | 'serif';
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
}

export interface Anchor {
  itemId?: string;
  x: number;
  y: number;
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
  updatedAt: number;
  opacity?: number;
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
  favorite?: boolean;
}

export interface HistorySnapshot {
  items: BoardItem[];
  comments: CommentPin[];
  name: string;
  background: BackgroundKind;
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
    Omit<ConnectorItem, 'type' | 'id'>
>;
