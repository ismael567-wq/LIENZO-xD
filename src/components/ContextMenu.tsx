import { useEffect, useRef } from 'react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Boxes,
  ClipboardCopy,
  Copy,
  Lock,
  Maximize2,
  MousePointerClick,
  Pencil,
  StickyNote,
  Trash2,
  Type,
  Ungroup,
  Unlock,
} from 'lucide-react';
import type { Board, BoardItem, Point } from '../types';
import { useLienzo } from '../store/boardStore';
import { newSticky, newText } from '../lib/factory';
import { copyBoardPNG } from '../lib/export';
import { STICKY_COLORS } from '../lib/theme';

export interface ContextMenuState {
  screen: Point;
  world: Point;
  item: BoardItem | null;
}

interface ContextMenuProps {
  board: Board;
  state: ContextMenuState | null;
  onClose: () => void;
}

export function ContextMenu({ board, state, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', onPointerDown);
    }, 40);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [state, onClose]);

  if (!state) return null;
  const store = useLienzo.getState();
  const selected = useLienzo.getState().selected;
  const theme = useLienzo.getState().theme;
  const items = board.items.filter((item) => selected.includes(item.id));
  const anyGrouped = items.some((item) => item.groupId);
  const single = state.item;
  const menuWidth = 232;
  const menuHeight = 380;
  const left = Math.min(state.screen.x, window.innerWidth - menuWidth - 12);
  const top = Math.min(state.screen.y, window.innerHeight - menuHeight - 12);

  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  const copyPng = async () => {
    try {
      await copyBoardPNG(board, {
        selected: selected.length > 0 ? selected : undefined,
        theme,
      });
      store.showToast('PNG copiado al portapapeles.', 'success');
    } catch (error) {
      store.showToast(
        error instanceof Error ? error.message : 'No se pudo copiar la imagen.',
        'error',
      );
    }
  };

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: Math.max(8, left), top: Math.max(8, top) }}
      role="menu"
      onContextMenu={(event) => event.preventDefault()}
    >
      {single && 'text' in single ? (
        <button type="button" role="menuitem" onClick={run(() => store.startEditing(single.id))}>
          <Pencil size={15} />
          <span>Editar texto</span>
          <kbd>↵</kbd>
        </button>
      ) : null}
      {single ? (
        <>
          <button type="button" role="menuitem" onClick={run(() => store.duplicateSelected())}>
            <Copy size={15} />
            <span>Duplicar</span>
            <kbd>⌘D</kbd>
          </button>
          <button type="button" role="menuitem" onClick={run(() => void copyPng())}>
            <ClipboardCopy size={15} />
            <span>Copiar como PNG</span>
          </button>
          <div className="menu-separator" />
          {selected.length > 1 ? (
            <button type="button" role="menuitem" onClick={run(() => store.groupSelected())}>
              <Boxes size={15} />
              <span>Agrupar selección</span>
            </button>
          ) : null}
          {anyGrouped ? (
            <button type="button" role="menuitem" onClick={run(() => store.ungroupSelected())}>
              <Ungroup size={15} />
              <span>Desagrupar</span>
            </button>
          ) : null}
          <button type="button" role="menuitem" onClick={run(() => store.bringToFront())}>
            <ArrowUpToLine size={15} />
            <span>Traer al frente</span>
          </button>
          <button type="button" role="menuitem" onClick={run(() => store.sendToBack())}>
            <ArrowDownToLine size={15} />
            <span>Enviar al fondo</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={run(() => store.updateItem(single.id, { locked: !single.locked }))}
          >
            {single.locked ? <Unlock size={15} /> : <Lock size={15} />}
            <span>{single.locked ? 'Desbloquear' : 'Bloquear'}</span>
          </button>
          <div className="menu-separator" />
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            onClick={run(() => store.deleteSelected())}
          >
            <Trash2 size={15} />
            <span>Eliminar</span>
            <kbd>Supr</kbd>
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={run(() => {
              const item = newSticky(
                state.world,
                board.items.filter((candidate) => candidate.type === 'sticky').length %
                  STICKY_COLORS.length,
              );
              store.addItem(item, { edit: true });
            })}
          >
            <StickyNote size={15} />
            <span>Nueva nota aquí</span>
            <kbd>N</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={run(() => {
              store.addItem(newText(state.world), { edit: true });
            })}
          >
            <Type size={15} />
            <span>Nuevo texto aquí</span>
            <kbd>T</kbd>
          </button>
          <div className="menu-separator" />
          <button type="button" role="menuitem" onClick={run(() => store.selectAll())}>
            <MousePointerClick size={15} />
            <span>Seleccionar todo</span>
            <kbd>⌘A</kbd>
          </button>
          <button type="button" role="menuitem" onClick={run(() => store.fitToContent())}>
            <Maximize2 size={15} />
            <span>Ajustar a todo</span>
            <kbd>⇧1</kbd>
          </button>
        </>
      )}
    </div>
  );
}
