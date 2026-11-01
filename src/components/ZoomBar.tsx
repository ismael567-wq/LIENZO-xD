import { Maximize2, Minus, Plus } from 'lucide-react';
import type { Viewport } from '../types';

interface ZoomBarProps {
  viewport: Viewport;
  onZoom: (factor: number) => void;
  onReset: () => void;
  onFit: () => void;
}

export function ZoomBar({ viewport, onZoom, onReset, onFit }: ZoomBarProps) {
  return (
    <div className="zoombar" aria-label="Zoom del lienzo">
      <button type="button" onClick={() => onZoom(1 / 1.2)} aria-label="Alejar" title="Alejar">
        <Minus size={15} />
      </button>
      <button
        type="button"
        className="zoom-value"
        onClick={onReset}
        title="Restablecer al 100 %"
        aria-label="Restablecer zoom"
      >
        {Math.round(viewport.zoom * 100)}%
      </button>
      <button type="button" onClick={() => onZoom(1.2)} aria-label="Acercar" title="Acercar">
        <Plus size={15} />
      </button>
      <span className="zoombar-divider" />
      <button type="button" onClick={onFit} aria-label="Ajustar a todo" title="Ajustar a todo (Shift+1)">
        <Maximize2 size={14} />
      </button>
    </div>
  );
}
