import { useEffect, useRef } from 'react';
import type { Board } from '../types';
import { boundsOfItems, fitViewport } from '../lib/geometry';
import { renderBoard } from '../lib/canvasRenderer';

export function BoardPreview({
  board,
  className = '',
  padding = 28,
}: {
  board: Board;
  className?: string;
  padding?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const render = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = Math.max(1, canvas.clientWidth);
        const height = Math.max(1, canvas.clientHeight);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const bounds = boundsOfItems(board.items);
        const viewport = bounds
          ? fitViewport(bounds, width, height, padding, 1.1)
          : { x: width / 2, y: height / 2, zoom: 1 };
        renderBoard(ctx, board, {
          width,
          height,
          dpr,
          viewport,
          preview: true,
          selected: [],
          comments: true,
          onImageLoad: () => render(),
        });
      });
    };
    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [board, padding]);

  return <canvas ref={canvasRef} className={`board-preview ${className}`} aria-hidden="true" />;
}
