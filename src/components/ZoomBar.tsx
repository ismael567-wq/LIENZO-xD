import { Grid3X3, Magnet, Maximize2, Minus, Plus } from 'lucide-react';
import type { Viewport } from '../types';
import { useLienzo } from '../store/boardStore';

interface ZoomBarProps {
  viewport: Viewport;
  onZoom: (factor: number) => void;
  onReset: () => void;
  onFit: () => void;
}

export function ZoomBar({ viewport, onZoom, onReset, onFit }: ZoomBarProps) {
  const snapToGrid = useLienzo((state) => state.snapToGrid);
  const setSnapToGrid = useLienzo((state) => state.setSnapToGrid);
  const gridSize = useLienzo((state) => state.gridSize);
  const setGridSize = useLienzo((state) => state.setGridSize);

  return (
    <div className="zoombar" aria-label="Zoom y ajustes del lienzo">
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
      <button
        type="button"
        className={snapToGrid ? 'is-active' : ''}
        onClick={() => setSnapToGrid(!snapToGrid)}
        aria-label={snapToGrid ? 'Desactivar ajuste a cuadrícula' : 'Activar ajuste a cuadrícula'}
        title={snapToGrid ? 'Ajuste a cuadrícula activo' : 'Ajustar a cuadrícula'}
        aria-pressed={snapToGrid}
      >
        <Magnet size={14} />
      </button>
      <button
        type="button"
        className="grid-size-button"
        onClick={() => setGridSize(gridSize >= 48 ? 16 : gridSize + 8)}
        title={`Cuadrícula de ${gridSize} px (clic para cambiar)`}
        aria-label={`Cuadrícula de ${gridSize} píxeles`}
      >
        <Grid3X3 size={13} />
        <span>{gridSize}</span>
      </button>
      <span className="zoombar-divider" />
      <button type="button" onClick={onFit} aria-label="Ajustar a todo" title="Ajustar a todo (Shift+1)">
        <Maximize2 size={14} />
      </button>
    </div>
  );
}
