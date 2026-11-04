import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Anchor,
  Board,
  BoardItem,
  ConnectorItem,
  DrawItem,
  Point,
  Rect,
  ShapeKind,
  Tool,
  Viewport,
} from '../types';
import { useLienzo } from '../store/boardStore';
import {
  HANDLE_CURSORS,
  clamp,
  getHandleAt,
  hitTest,
  normalizeRect,
  screenToWorld,
  snap as snapValue,
  type Handle,
  resizeRectFromHandle,
  scalePoints,
  zoomAtPoint,
} from '../lib/geometry';
import { renderBoard } from '../lib/canvasRenderer';
import {
  newConnector,
  newDraw,
  newFrame,
  newShape,
  newSticky,
  newStickyRect,
  newText,
} from '../lib/factory';
import { STICKY_COLORS } from '../lib/theme';

interface CanvasStageProps {
  board: Board;
  viewport: Viewport;
  tool: Tool;
  shapeKind: ShapeKind;
  selected: string[];
  editingId: string | null;
  snapToGrid: boolean;
  readOnly?: boolean;
  clip?: Rect | null;
  onCommentPoint: (point: Point) => void;
  onContextMenu?: (point: Point, item: BoardItem | null, screen: Point) => void;
}

type MoveTarget = { id: string; x: number; y: number };

type Gesture =
  | {
      kind: 'pan';
      pointerId: number;
      start: Point;
      startViewport: Viewport;
    }
  | {
      kind: 'move';
      pointerId: number;
      start: Point;
      targets: MoveTarget[];
      pushed: boolean;
      bounds: Rect;
    }
  | {
      kind: 'resize';
      pointerId: number;
      start: Point;
      item: BoardItem;
      handle: Handle;
      startRect: Rect;
      pushed: boolean;
    }
  | {
      kind: 'marquee';
      pointerId: number;
      start: Point;
      additive: boolean;
    }
  | {
      kind: 'create';
      pointerId: number;
      start: Point;
      tool: 'sticky' | 'shape' | 'frame';
      colorIndex: number;
    }
  | {
      kind: 'draw';
      pointerId: number;
      points: Point[];
      highlighter: boolean;
    }
  | {
      kind: 'connector';
      pointerId: number;
      start: Point;
      from: Anchor;
      fromId?: string;
    }
  | {
      kind: 'erase';
      pointerId: number;
      erased: Set<string>;
    }
  | {
      kind: 'laser';
      pointerId: number;
    }
  | {
      kind: 'pinch';
      startDistance: number;
      startMid: Point;
      startViewport: Viewport;
      worldAtMid: Point;
    };

interface SnapResult {
  dx: number;
  dy: number;
  guides: { x: number[]; y: number[] };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function unionRect(rects: Rect[]): Rect {
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function computeSnap(
  initialBounds: Rect,
  dx: number,
  dy: number,
  others: Rect[],
  zoom: number,
  grid: boolean,
  disabled: boolean,
  gridSize = 8,
): SnapResult {
  if (disabled) return { dx, dy, guides: { x: [], y: [] } };
  let nextDx = dx;
  let nextDy = dy;
  const guidesX: number[] = [];
  const guidesY: number[] = [];
  const threshold = 6 / zoom;
  const moving = {
    x: initialBounds.x + dx,
    y: initialBounds.y + dy,
    w: initialBounds.w,
    h: initialBounds.h,
  };
  const movingXs = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const movingYs = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];
  let bestX: { delta: number; guide: number } | null = null;
  let bestY: { delta: number; guide: number } | null = null;
  for (const rect of others) {
    const targetXs = [rect.x, rect.x + rect.w / 2, rect.x + rect.w];
    const targetYs = [rect.y, rect.y + rect.h / 2, rect.y + rect.h];
    for (const target of targetXs) {
      for (const candidate of movingXs) {
        const delta = target - candidate;
        if (Math.abs(delta) <= threshold) {
          if (!bestX || Math.abs(delta) < Math.abs(bestX.delta)) {
            bestX = { delta, guide: target };
          }
        }
      }
    }
    for (const target of targetYs) {
      for (const candidate of movingYs) {
        const delta = target - candidate;
        if (Math.abs(delta) <= threshold) {
          if (!bestY || Math.abs(delta) < Math.abs(bestY.delta)) {
            bestY = { delta, guide: target };
          }
        }
      }
    }
  }
  if (bestX) {
    nextDx += bestX.delta;
    guidesX.push(bestX.guide);
  } else if (grid) {
    const snapped = snapValue(moving.x, gridSize);
    nextDx += snapped - moving.x;
  }
  if (bestY) {
    nextDy += bestY.delta;
    guidesY.push(bestY.guide);
  } else if (grid) {
    const snapped = snapValue(moving.y, gridSize);
    nextDy += snapped - moving.y;
  }
  return { dx: nextDx, dy: nextDy, guides: { x: guidesX, y: guidesY } };
}

export function CanvasStage({
  board,
  viewport,
  tool,
  shapeKind,
  selected,
  editingId,
  snapToGrid,
  readOnly = false,
  clip = null,
  onCommentPoint,
  onContextMenu,
}: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const spaceRef = useRef(false);
  const rafRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [draft, setDraft] = useState<BoardItem | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({
    x: [],
    y: [],
  });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [cursor, setCursor] = useState('default');
  const [spaceDown, setSpaceDown] = useState(false);
  const theme = useLienzo((state) => state.theme);
  const laserRef = useRef<Array<{ x: number; y: number; at: number }>>([]);
  const laserRafRef = useRef(0);

  const stickyCount = useMemo(
    () => board.items.filter((item) => item.type === 'sticky').length,
    [board.items],
  );

  const requestDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      drawRef.current();
    });
  }, []);

  drawRef.current = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.floor(size.w * dpr));
    const pixelHeight = Math.max(1, Math.floor(size.h * dpr));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderBoard(ctx, board, {
      width: size.w,
      height: size.h,
      dpr,
      viewport,
      theme,
      selected,
      editingId,
      marquee,
      draft,
      hoveredId,
      guides,
      comments: false,
      clip,
      onImageLoad: requestDraw,
    });
    const laser = laserRef.current;
    if (laser.length > 0) {
      const now = performance.now();
      const alive = laser.filter((point) => now - point.at < 1100);
      laserRef.current = alive;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let index = 1; index < alive.length; index += 1) {
        const previous = alive[index - 1];
        const point = alive[index];
        const age = Math.min(1, (now - point.at) / 1100);
        const alpha = (1 - age) * 0.9;
        if (alpha <= 0.02) continue;
        const from = {
          x: previous.x * viewport.zoom + viewport.x,
          y: previous.y * viewport.zoom + viewport.y,
        };
        const to = {
          x: point.x * viewport.zoom + viewport.x,
          y: point.y * viewport.zoom + viewport.y,
        };
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = theme === 'dark' ? '#63D6BE' : '#E04F2F';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
      const tip = alive[alive.length - 1];
      if (tip) {
        const screen = {
          x: tip.x * viewport.zoom + viewport.x,
          y: tip.y * viewport.zoom + viewport.y,
        };
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = theme === 'dark' ? '#63D6BE' : '#E04F2F';
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  const tickLaser = useCallback(() => {
    if (laserRafRef.current) return;
    laserRafRef.current = requestAnimationFrame(function tick() {
      laserRafRef.current = 0;
      const now = performance.now();
      const alive = laserRef.current.filter((point) => now - point.at < 1100);
      laserRef.current = alive;
      requestDraw();
      if (alive.length > 0) {
        laserRafRef.current = requestAnimationFrame(tick);
      }
    });
  }, [requestDraw]);

  useEffect(() => {
    requestDraw();
  }, [board, viewport, selected, editingId, marquee, draft, hoveredId, guides, size, clip, theme, requestDraw]);

  useEffect(
    () => () => {
      if (laserRafRef.current) cancelAnimationFrame(laserRafRef.current);
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.max(1, Math.round(entry.contentRect.width));
      const height = Math.max(1, Math.round(entry.contentRect.height));
      setSize({ w: width, h: height });
      useLienzo.getState().setStageSize({ w: width, h: height });
      requestDraw();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [requestDraw]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) requestDraw();
    });
    return () => {
      cancelled = true;
    };
  }, [requestDraw]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      spaceRef.current = true;
      setSpaceDown(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      spaceRef.current = false;
      setSpaceDown(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const getScreenPoint = (event: { clientX: number; clientY: number }): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const getWorldPoint = (screen: Point): Point =>
    screenToWorld(screen, useLienzo.getState().viewport);

  const baseCursor = (): string => {
    if (readOnly) return 'grab';
    if (spaceDown || tool === 'hand') return 'grab';
    if (tool === 'text') return 'text';
    if (
      tool === 'sticky' ||
      tool === 'shape' ||
      tool === 'frame' ||
      tool === 'connector' ||
      tool === 'pen' ||
      tool === 'highlighter' ||
      tool === 'laser' ||
      tool === 'comment' ||
      tool === 'eraser'
    ) {
      return 'crosshair';
    }
    return 'default';
  };

  const eraseAt = (world: Point, gesture: Extract<Gesture, { kind: 'erase' }>) => {
    const state = useLienzo.getState();
    const hit = hitTest(board.items, world, useLienzo.getState().viewport.zoom);
    if (!hit || hit.locked || gesture.erased.has(hit.id)) return;
    gesture.erased.add(hit.id);
    state.deleteItem(hit.id);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail if the pointer was already released.
    }
    const screen = getScreenPoint(event);
    pointersRef.current.set(event.pointerId, screen);
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      const state = useLienzo.getState();
      gestureRef.current = {
        kind: 'pinch',
        startDistance: Math.max(1, distance(a, b)),
        startMid: midpoint(a, b),
        startViewport: state.viewport,
        worldAtMid: screenToWorld(midpoint(a, b), state.viewport),
      };
      setDraft(null);
      setMarquee(null);
      return;
    }
    if (pointersRef.current.size > 2) return;
    const world = getWorldPoint(screen);
    const state = useLienzo.getState();
    const zoom = state.viewport.zoom;
    if (readOnly || event.button === 1 || spaceRef.current || state.tool === 'hand') {
      gestureRef.current = {
        kind: 'pan',
        pointerId: event.pointerId,
        start: screen,
        startViewport: state.viewport,
      };
      setCursor('grabbing');
      return;
    }
    if (state.tool === 'eraser') {
      const gesture: Extract<Gesture, { kind: 'erase' }> = {
        kind: 'erase',
        pointerId: event.pointerId,
        erased: new Set(),
      };
      gestureRef.current = gesture;
      eraseAt(world, gesture);
      return;
    }
    if (state.tool === 'laser') {
      laserRef.current = [{ x: world.x, y: world.y, at: performance.now() }];
      gestureRef.current = { kind: 'laser', pointerId: event.pointerId };
      tickLaser();
      return;
    }
    if (state.tool === 'pen' || state.tool === 'highlighter') {
      const gesture: Extract<Gesture, { kind: 'draw' }> = {
        kind: 'draw',
        pointerId: event.pointerId,
        points: [world],
        highlighter: state.tool === 'highlighter',
      };
      gestureRef.current = gesture;
      setDraft(newDraw(gesture.points, gesture.highlighter));
      return;
    }
    if (state.tool === 'connector') {
      const hit = hitTest(board.items, world, zoom);
      gestureRef.current = {
        kind: 'connector',
        pointerId: event.pointerId,
        start: world,
        from: hit
          ? { itemId: hit.id, x: world.x, y: world.y }
          : { x: world.x, y: world.y },
        fromId: hit?.id,
      };
      return;
    }
    if (state.tool === 'sticky' || state.tool === 'shape' || state.tool === 'frame') {
      const colorIndex = stickyCount % STICKY_COLORS.length;
      gestureRef.current = {
        kind: 'create',
        pointerId: event.pointerId,
        start: world,
        tool: state.tool,
        colorIndex,
      };
      if (state.tool === 'sticky') {
        setDraft(newSticky(world, colorIndex));
      } else if (state.tool === 'shape') {
        setDraft(
          newShape(
            { x: world.x - 110, y: world.y - 70, w: 220, h: 140 },
            shapeKind,
          ),
        );
      } else {
        setDraft(newFrame({ x: world.x, y: world.y, w: 560, h: 400 }));
      }
      return;
    }
    if (state.tool === 'text') {
      const item = newText(world);
      state.addItem(item, { edit: true });
      return;
    }
    if (state.tool === 'comment') {
      event.stopPropagation();
      onCommentPoint(world);
      return;
    }
    if (state.tool === 'image') {
      return;
    }

    if (selected.length === 1) {
      const item = board.items.find((candidate) => candidate.id === selected[0]);
      if (item && item.type !== 'connector' && !item.locked) {
        const handle = getHandleAt(
          { x: item.x, y: item.y, w: item.w, h: item.h },
          world,
          zoom,
        );
        if (handle) {
          gestureRef.current = {
            kind: 'resize',
            pointerId: event.pointerId,
            start: world,
            item,
            handle,
            startRect: { x: item.x, y: item.y, w: item.w, h: item.h },
            pushed: false,
          };
          setCursor(HANDLE_CURSORS[handle]);
          return;
        }
      }
    }

    const hit = hitTest(board.items, world, zoom);
    if (hit) {
      const alreadySelected = selected.includes(hit.id);
      if (event.shiftKey) {
        state.select([hit.id], true);
        return;
      }
      if (!alreadySelected) state.select([hit.id]);
      const currentSelected = useLienzo.getState().selected;
      const ids = new Set(currentSelected);
      if (hit.type === 'frame') {
        for (const candidate of board.items) {
          if (candidate.type === 'connector' || candidate.id === hit.id) continue;
          const cx = candidate.x + candidate.w / 2;
          const cy = candidate.y + candidate.h / 2;
          if (
            cx >= hit.x &&
            cx <= hit.x + hit.w &&
            cy >= hit.y &&
            cy <= hit.y + hit.h
          ) {
            ids.add(candidate.id);
          }
        }
      }
      const targets = board.items
        .filter(
          (candidate) =>
            ids.has(candidate.id) &&
            candidate.type !== 'connector' &&
            !candidate.locked,
        )
        .map((candidate) => ({
          id: candidate.id,
          x: candidate.x,
          y: candidate.y,
        }));
      if (targets.length === 0) return;
      const bounds = unionRect(
        board.items
          .filter((candidate) => ids.has(candidate.id) && candidate.type !== 'connector')
          .map((candidate) => ({
            x: candidate.x,
            y: candidate.y,
            w: candidate.w,
            h: candidate.h,
          })),
      );
      gestureRef.current = {
        kind: 'move',
        pointerId: event.pointerId,
        start: world,
        targets,
        pushed: false,
        bounds,
      };
      setCursor('grabbing');
      return;
    }

    if (event.pointerType === 'touch') {
      gestureRef.current = {
        kind: 'pan',
        pointerId: event.pointerId,
        start: screen,
        startViewport: state.viewport,
      };
      setCursor('grabbing');
      return;
    }

    if (!event.shiftKey) state.clearSelection();
    gestureRef.current = {
      kind: 'marquee',
      pointerId: event.pointerId,
      start: world,
      additive: event.shiftKey,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const screen = getScreenPoint(event);
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, screen);
    }
    const gesture = gestureRef.current;
    const state = useLienzo.getState();
    const world = getWorldPoint(screen);

    if (!gesture && pointersRef.current.size === 0) {
      state.sendCursor(world);
      if (!readOnly && state.tool === 'select') {
        if (state.selected.length === 1) {
          const item = board.items.find((candidate) => candidate.id === state.selected[0]);
          if (item && item.type !== 'connector') {
            const handle = getHandleAt(
              { x: item.x, y: item.y, w: item.w, h: item.h },
              world,
              state.viewport.zoom,
            );
            if (handle) {
              setCursor(HANDLE_CURSORS[handle]);
              return;
            }
          }
        }
        const hit = hitTest(board.items, world, state.viewport.zoom);
        setHoveredId(hit?.id ?? null);
        setCursor(hit ? 'move' : baseCursor());
      } else {
        setHoveredId(null);
        setCursor(baseCursor());
      }
      return;
    }
    if (!gesture) return;

    if (gesture.kind === 'pinch') {
      if (pointersRef.current.size < 2) return;
      const [a, b] = [...pointersRef.current.values()];
      const currentMid = midpoint(a, b);
      const currentDistance = Math.max(1, distance(a, b));
      const zoom = clamp(
        gesture.startViewport.zoom * (currentDistance / gesture.startDistance),
        0.06,
        4,
      );
      state.setViewport({
        zoom,
        x: currentMid.x - gesture.worldAtMid.x * zoom,
        y: currentMid.y - gesture.worldAtMid.y * zoom,
      });
      return;
    }

    if (gesture.kind === 'pan') {
      state.setViewport({
        ...gesture.startViewport,
        x: gesture.startViewport.x + (screen.x - gesture.start.x),
        y: gesture.startViewport.y + (screen.y - gesture.start.y),
      });
      return;
    }

    if (gesture.kind === 'move') {
      let dx = world.x - gesture.start.x;
      let dy = world.y - gesture.start.y;
      const others = board.items
        .filter(
          (item) =>
            item.type !== 'connector' &&
            !gesture.targets.some((target) => target.id === item.id),
        )
        .map((item) => ({ x: item.x, y: item.y, w: item.w, h: item.h }));
      const snapped = computeSnap(
        gesture.bounds,
        dx,
        dy,
        others,
        state.viewport.zoom,
        snapToGrid,
        event.altKey,
        state.gridSize,
      );
      dx = snapped.dx;
      dy = snapped.dy;
      setGuides(snapped.guides);
      if (!gesture.pushed && Math.abs(dx) + Math.abs(dy) > 0.5) {
        state.pushHistory();
        gesture.pushed = true;
      }
      state.updateItems(
        gesture.targets.map((target) => ({
          id: target.id,
          patch: { x: Math.round(target.x + dx), y: Math.round(target.y + dy) },
        })),
      );
      return;
    }

    if (gesture.kind === 'resize') {
      const dx = world.x - gesture.start.x;
      const dy = world.y - gesture.start.y;
      const rect = resizeRectFromHandle(
        gesture.startRect,
        gesture.handle,
        dx,
        dy,
        gesture.item.type === 'text' ? 40 : 32,
      );
      if (!gesture.pushed) {
        state.pushHistory();
        gesture.pushed = true;
      }
      if (gesture.item.type === 'draw') {
        const item = gesture.item as DrawItem;
        state.updateItem(gesture.item.id, {
          ...rect,
          points: scalePoints(
            item.points,
            gesture.startRect.w,
            gesture.startRect.h,
            rect.w,
            rect.h,
          ),
        });
      } else {
        state.updateItem(gesture.item.id, rect);
      }
      return;
    }

    if (gesture.kind === 'marquee') {
      setMarquee(normalizeRect(gesture.start.x, gesture.start.y, world.x, world.y));
      return;
    }

    if (gesture.kind === 'create') {
      const dx = Math.abs(world.x - gesture.start.x);
      const dy = Math.abs(world.y - gesture.start.y);
      const dragged = dx > 6 || dy > 6;
      if (gesture.tool === 'sticky') {
        const rect = dragged
          ? normalizeRect(gesture.start.x, gesture.start.y, world.x, world.y)
          : {
              x: gesture.start.x - 90,
              y: gesture.start.y - 90,
              w: 180,
              h: 180,
            };
        setDraft(
          newStickyRect(
            {
              x: rect.x,
              y: rect.y,
              w: Math.max(100, rect.w),
              h: Math.max(100, rect.h),
            },
            gesture.colorIndex,
          ),
        );
      } else if (gesture.tool === 'shape') {
        const rect = dragged
          ? normalizeRect(gesture.start.x, gesture.start.y, world.x, world.y)
          : {
              x: gesture.start.x - 110,
              y: gesture.start.y - 70,
              w: 220,
              h: 140,
            };
        setDraft(
          newShape(
            { x: rect.x, y: rect.y, w: Math.max(60, rect.w), h: Math.max(48, rect.h) },
            shapeKind,
          ),
        );
      } else {
        const rect = dragged
          ? normalizeRect(gesture.start.x, gesture.start.y, world.x, world.y)
          : { x: gesture.start.x, y: gesture.start.y, w: 560, h: 400 };
        setDraft(
          newFrame({
            x: rect.x,
            y: rect.y,
            w: Math.max(240, rect.w),
            h: Math.max(180, rect.h),
          }),
        );
      }
      return;
    }

    if (gesture.kind === 'draw') {
      const last = gesture.points[gesture.points.length - 1];
      if (distance(last, world) < 1.4) return;
      gesture.points.push(world);
      setDraft(newDraw(gesture.points, gesture.highlighter));
      return;
    }

    if (gesture.kind === 'laser') {
      const last = laserRef.current[laserRef.current.length - 1];
      if (last && distance(last, world) < 1.2) return;
      laserRef.current = [
        ...laserRef.current.slice(-120),
        { x: world.x, y: world.y, at: performance.now() },
      ];
      tickLaser();
      return;
    }

    if (gesture.kind === 'connector') {
      const hit = hitTest(board.items, world, state.viewport.zoom);
      const to: Anchor = hit
        ? { itemId: hit.id, x: world.x, y: world.y }
        : { x: world.x, y: world.y };
      setDraft(newConnector(gesture.from, to));
      return;
    }

    if (gesture.kind === 'erase') {
      eraseAt(world, gesture);
    }
  };

  const finishGesture = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const gesture = gestureRef.current;
    pointersRef.current.delete(event.pointerId);
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (!gesture) {
      setCursor(baseCursor());
      return;
    }
    if (gesture.kind === 'pinch') {
      gestureRef.current = null;
      setCursor(baseCursor());
      return;
    }
    if (gesture.pointerId !== event.pointerId) return;
    const state = useLienzo.getState();
    const world = getWorldPoint(getScreenPoint(event));

    if (gesture.kind === 'create') {
      const created =
        draft ??
        (gesture.tool === 'sticky'
          ? newSticky(gesture.start, gesture.colorIndex)
          : gesture.tool === 'shape'
            ? newShape(
                { x: gesture.start.x - 110, y: gesture.start.y - 70, w: 220, h: 140 },
                shapeKind,
              )
            : newFrame({
                x: gesture.start.x,
                y: gesture.start.y,
                w: 560,
                h: 400,
              }));
      state.addItem(created, { edit: gesture.tool === 'sticky' });
    } else if (gesture.kind === 'draw' && gesture.points.length > 0) {
      const colors = gesture.highlighter ? '#FFD66B' : '#16211E';
      state.addItem(
        newDraw(
          gesture.points,
          gesture.highlighter,
          colors,
          gesture.highlighter ? 24 : 2.5,
        ),
      );
    } else if (gesture.kind === 'connector') {
      if (distance(gesture.start, world) > 12) {
        const hit = hitTest(board.items, world, state.viewport.zoom);
        const to: Anchor = hit
          ? { itemId: hit.id, x: world.x, y: world.y }
          : { x: world.x, y: world.y };
        if (hit?.id !== gesture.fromId || !gesture.fromId) {
          state.addItem(newConnector(gesture.from, to));
        }
      }
    } else if (gesture.kind === 'marquee' && marquee) {
      state.selectInRect(marquee, gesture.additive);
    } else if (gesture.kind === 'laser') {
      tickLaser();
    }

    gestureRef.current = null;
    setDraft(null);
    setMarquee(null);
    setGuides({ x: [], y: [] });
    setCursor(baseCursor());
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    finishGesture(event);
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    gestureRef.current = null;
    pointersRef.current.delete(event.pointerId);
    setDraft(null);
    setMarquee(null);
    setGuides({ x: [], y: [] });
    setCursor(baseCursor());
  };

  const onContextMenuEvent = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (readOnly) return;
    const screen = getScreenPoint(event);
    const world = getWorldPoint(screen);
    const state = useLienzo.getState();
    const hit = hitTest(board.items, world, state.viewport.zoom);
    if (hit) {
      if (!state.selected.includes(hit.id)) state.select([hit.id]);
    } else {
      state.clearSelection();
    }
    onContextMenu?.(world, hit, { x: event.clientX, y: event.clientY });
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const world = getWorldPoint(getScreenPoint(event));
    const hit = hitTest(board.items, world, viewport.zoom);
    if (hit) {
      if (hit.type === 'frame') {
        useLienzo.getState().select([hit.id]);
        return;
      }
      if ('text' in hit) {
        useLienzo.getState().startEditing(hit.id);
        return;
      }
    } else {
      const item = newSticky(world, stickyCount % STICKY_COLORS.length);
      useLienzo.getState().addItem(item, { edit: true });
    }
  };

  const onWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const state = useLienzo.getState();
    if (event.ctrlKey || event.metaKey) {
      const factor = Math.exp(-event.deltaY * 0.0028);
      state.setViewport(zoomAtPoint(state.viewport, factor, point));
      return;
    }
    if (event.shiftKey) {
      state.setViewport({
        ...state.viewport,
        x: state.viewport.x - event.deltaY,
      });
      return;
    }
    state.setViewport({
      ...state.viewport,
      x: state.viewport.x - event.deltaX,
      y: state.viewport.y - event.deltaY,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  return (
    <div className="canvas-stage" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="canvas-surface"
        style={{ width: `${size.w}px`, height: `${size.h}px`, cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenuEvent}
      />
    </div>
  );
}
