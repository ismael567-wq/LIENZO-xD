import { describe, expect, it } from 'vitest';
import {
  boundsOfItems,
  connectorLabelPoint,
  connectorPathPoints,
  distanceToConnector,
  edgePoint,
  fitViewport,
  getConnectorEndpoints,
  getFrameSlides,
  getHandleAt,
  hitTest,
  resizeRectFromHandle,
  screenToWorld,
  worldToScreen,
} from '../src/lib/geometry';
import type { ConnectorItem, FrameItem, ShapeItem } from '../src/types';

const shape = (id: string, x: number, y: number): ShapeItem => ({
  id,
  type: 'shape',
  shape: 'rect',
  x,
  y,
  w: 100,
  h: 80,
  text: '',
  fill: '#fff',
  stroke: '#000',
  strokeWidth: 1,
  radius: 8,
  fontSize: 14,
  textColor: '#000',
  updatedAt: 1,
});

const connector = (fromId: string, toId: string): ConnectorItem => ({
  id: 'c1',
  type: 'connector',
  from: { itemId: fromId, x: 0, y: 0 },
  to: { itemId: toId, x: 0, y: 0 },
  color: '#000',
  strokeWidth: 2,
  dashed: false,
  arrowStart: false,
  arrowEnd: true,
  label: '',
  updatedAt: 1,
  x: 0,
  y: 0,
  w: 0,
  h: 0,
});

describe('geometry', () => {
  it('round-trips screen and world coordinates', () => {
    const viewport = { x: 120, y: -40, zoom: 1.5 };
    const world = { x: 42, y: 90 };
    expect(screenToWorld(worldToScreen(world, viewport), viewport)).toEqual(world);
  });

  it('fits content centered with the requested padding', () => {
    const viewport = fitViewport({ x: 0, y: 0, w: 1000, h: 500 }, 1200, 800, 100);
    expect(viewport.zoom).toBeCloseTo(1);
    expect(viewport.x).toBeCloseTo(100);
    expect(viewport.y).toBeCloseTo(150);
  });

  it('computes edge points toward another point', () => {
    const item = shape('a', 0, 0);
    expect(edgePoint(item, { x: 400, y: 40 })).toEqual({ x: 100, y: 40 });
  });

  it('attaches connector endpoints to shape edges', () => {
    const a = shape('a', 0, 0);
    const b = shape('b', 400, 0);
    const c = connector('a', 'b');
    const endpoints = getConnectorEndpoints(c, [a, b]);
    expect(endpoints.a.x).toBeCloseTo(100);
    expect(endpoints.b.x).toBeCloseTo(400);
    expect(endpoints.a.y).toBeCloseTo(40);
    expect(endpoints.b.y).toBeCloseTo(40);
  });

  it('hits shapes, connectors, and frames', () => {
    const a = shape('a', 0, 0);
    const b = shape('b', 400, 0);
    const c = connector('a', 'b');
    const frame: FrameItem = {
      id: 'frame',
      type: 'frame',
      x: 250,
      y: 250,
      w: 300,
      h: 300,
      title: 'Marco',
      fill: '#fff',
      updatedAt: 1,
    };
    const items = [a, b, c, frame];
    expect(hitTest(items, { x: 50, y: 40 })?.id).toBe('a');
    expect(hitTest(items, { x: 250, y: 40 })?.id).toBe('c1');
    expect(hitTest(items, { x: 300, y: 300 })?.id).toBe('frame');
    expect(hitTest(items, { x: 900, y: 900 })).toBeNull();
  });

  it('finds handles and resizes from the north-west corner', () => {
    const rect = { x: 10, y: 20, w: 100, h: 80 };
    expect(getHandleAt(rect, { x: 10, y: 20 }, 1)).toBe('nw');
    expect(getHandleAt(rect, { x: 50, y: 50 }, 1)).toBeNull();
    const resized = resizeRectFromHandle(rect, 'nw', 25, 10, 20);
    expect(resized).toEqual({ x: 35, y: 30, w: 75, h: 70 });
  });

  it('builds bounds for mixed selections and frame slides', () => {
    const a = shape('a', 0, 0);
    const b = shape('b', 200, 100);
    const bounds = boundsOfItems([a, b], ['a', 'b']);
    expect(bounds).toEqual({ x: 0, y: 0, w: 300, h: 180 });
    const frames: FrameItem[] = [
      { ...a, id: 'f2', type: 'frame', x: 500, y: 100, title: 'B', updatedAt: 1 },
      { ...a, id: 'f1', type: 'frame', x: 0, y: 100, title: 'A', updatedAt: 1 },
    ];
    expect(getFrameSlides(frames).map((slide) => slide.x)).toEqual([0, 500]);
  });

  it('builds straight, elbow and curved connector paths', () => {
    const a = shape('a', 0, 0);
    const b = shape('b', 400, 300);
    const c = connector('a', 'b');
    const straight = connectorPathPoints(c, [a, b]);
    expect(straight).toHaveLength(2);
    // Sin lados explícitos el codo resuelve con un único quiebre.
    const elbow = connectorPathPoints({ ...c, lineType: 'elbow' }, [a, b]);
    expect(elbow).toHaveLength(3);
    // Con anclajes laterales añade stubs y tramo central (6 vértices).
    const sided: ConnectorItem = {
      ...c,
      lineType: 'elbow',
      from: { ...c.from, side: 'right', offset: 0.5 },
      to: { ...c.to, side: 'left', offset: 0.5 },
    };
    const sidedElbow = connectorPathPoints(sided, [a, b]);
    expect(sidedElbow).toHaveLength(6);
    expect(sidedElbow[0]).toEqual({ x: 100, y: 40 });
    expect(sidedElbow[sidedElbow.length - 1]).toEqual({ x: 400, y: 340 });
    const curve = connectorPathPoints({ ...c, lineType: 'curve' }, [a, b]);
    expect(curve).toHaveLength(25);
    expect(connectorLabelPoint({ ...c, lineType: 'curve' }, [a, b]).x).toBeGreaterThan(0);
  });

  it('hit-tests connector paths away from the straight line', () => {
    const a = shape('a', 0, 0);
    const b = shape('b', 400, 300);
    const c = connector('a', 'b');
    const curve = { ...c, lineType: 'curve' as const };
    const straightDistance = distanceToConnector(c, [a, b], { x: 250, y: 150 });
    const curveDistance = distanceToConnector(curve, [a, b], { x: 250, y: 150 });
    expect(straightDistance).toBeGreaterThan(20);
    expect(curveDistance).toBeGreaterThan(straightDistance + 20);
  });
});
