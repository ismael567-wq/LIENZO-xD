import {
  ArrowDownToLine,
  ArrowUpToLine,
  Boxes,
  ClipboardCopy,
  Copy,
  Lock,
  Trash2,
  Ungroup,
  Unlock,
} from 'lucide-react';
import type { Board } from '../types';
import { useLienzo } from '../store/boardStore';
import { boundsOfItems, worldToScreen } from '../lib/geometry';
import { copyBoardPNG } from '../lib/export';

interface QuickActionsProps {
  board: Board;
  selected: string[];
  viewport: { x: number; y: number; zoom: number };
  stageSize: { w: number; h: number };
}

export function QuickActions({ board, selected, viewport, stageSize }: QuickActionsProps) {
  const theme = useLienzo((store) => store.theme);

  if (selected.length === 0) return null;
  const bounds = boundsOfItems(board.items, selected);
  if (!bounds) return null;

  const state = useLienzo.getState();
  const items = board.items.filter((item) => selected.includes(item.id));
  const anyGrouped = items.some((item) => item.groupId);
  const single = items.length === 1 ? items[0] : null;

  const topScreen = worldToScreen({ x: bounds.x + bounds.w / 2, y: bounds.y }, viewport);
  const bottomScreen = worldToScreen({ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h }, viewport);
  const width = 344;
  const left = Math.max(16, Math.min(stageSize.w - width - 16, topScreen.x - width / 2));
  const above = topScreen.y > 90;
  const top = above ? topScreen.y - 56 : bottomScreen.y + 16;

  const copyPng = async () => {
    try {
      await copyBoardPNG(board, { selected, theme });
      state.showToast('Selección copiada como PNG.', 'success');
    } catch (error) {
      state.showToast(
        error instanceof Error ? error.message : 'No se pudo copiar la imagen.',
        'error',
      );
    }
  };

  return (
    <div
      className="quick-actions"
      style={{ left, top }}
      role="toolbar"
      aria-label="Acciones de la selección"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className="quick-count">{selected.length}</span>
      <button type="button" onClick={() => state.duplicateSelected()} title="Duplicar (Ctrl+D)">
        <Copy size={15} />
      </button>
      <button type="button" onClick={() => void copyPng()} title="Copiar como PNG">
        <ClipboardCopy size={15} />
      </button>
      <span className="quick-divider" />
      {selected.length > 1 ? (
        <button type="button" onClick={() => state.groupSelected()} title="Agrupar">
          <Boxes size={15} />
        </button>
      ) : null}
      {anyGrouped ? (
        <button type="button" onClick={() => state.ungroupSelected()} title="Desagrupar">
          <Ungroup size={15} />
        </button>
      ) : null}
      <button type="button" onClick={() => state.bringToFront()} title="Traer al frente">
        <ArrowUpToLine size={15} />
      </button>
      <button type="button" onClick={() => state.sendToBack()} title="Enviar al fondo">
        <ArrowDownToLine size={15} />
      </button>
      {single ? (
        <button
          type="button"
          onClick={() => state.updateItem(single.id, { locked: !single.locked })}
          title={single.locked ? 'Desbloquear' : 'Bloquear'}
        >
          {single.locked ? <Unlock size={15} /> : <Lock size={15} />}
        </button>
      ) : null}
      <span className="quick-divider" />
      <button
        type="button"
        className="is-danger"
        onClick={() => state.deleteSelected()}
        title="Eliminar (Supr)"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
