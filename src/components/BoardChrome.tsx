import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Frame,
  Grid2X2,
  Layers,
  Lock,
  Map as MapIcon,
  MessageCircle,
  Plus,
  Presentation,
  RotateCcw,
  Sparkles,
  Trash2,
  Unlock,
  WifiOff,
  X,
  GraduationCap,
  Beaker,
} from 'lucide-react';
import type { Board } from '../types';
import { useLienzo } from '../store/boardStore';
import { worldToScreen } from '../lib/geometry';
import { playSound } from '../lib/sound';

type Panel = 'pages' | 'layers' | 'frames' | 'reactions' | null;

const EMOJIS = ['👏', '🎉', '❤️', '💡', '🙌', '🔥'];

export function BoardChrome({
  board,
  onRoom,
  onLab,
}: {
  board: Board;
  onRoom: () => void;
  onLab: () => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const pages = board.pages ?? [];
  const currentPageId = board.currentPageId ?? pages[0]?.id;
  const layers = board.layers ?? [];
  const frames = useMemo(
    () => board.items.filter((item) => item.type === 'frame'),
    [board.items],
  );
  const reactions = useLienzo((state) => state.collab.reactions);
  const role = useLienzo((state) => state.collab.role);
  const viewport = useLienzo((state) => state.viewport);
  const study = useLienzo((state) => state.study);
  const offline = useLienzo((state) => state.offline);
  const projector = useLienzo((state) => state.projector);
  const selected = useLienzo((state) => state.selected);
  const cards = useMemo(
    () => board.items.filter((item) => item.type === 'flashcard'),
    [board.items],
  );

  const setOffline = useLienzo((state) => state.setOffline);

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, [setOffline]);

  useEffect(() => {
    if (reactions.length > 0) playSound('pop');
    // Solo suena cuando llega una reacción nueva a la sala.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactions.length]);

  const toggle = (next: Panel) => setPanel((current) => (current === next ? null : next));

  return (
    <>
      {offline ? (
        <div className="offline-banner" role="status">
          <WifiOff size={13} /> Sin conexión: sigues trabajando en local y se guardará al volver.
        </div>
      ) : null}

      {pages.length > 0 && !projector ? (
        <div className="pages-bar" role="tablist" aria-label="Páginas del tablero">
          <button
            type="button"
            className="pages-arrow"
            onClick={() => {
              const index = pages.findIndex((page) => page.id === currentPageId);
              const target = pages[(index - 1 + pages.length) % pages.length];
              if (target) useLienzo.getState().setCurrentPage(target.id);
            }}
            aria-label="Página anterior"
          >
            <ChevronLeft size={13} />
          </button>
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              role="tab"
              aria-selected={page.id === currentPageId}
              className={`page-chip ${page.id === currentPageId ? 'is-active' : ''}`}
              onClick={() => useLienzo.getState().setCurrentPage(page.id)}
              onDoubleClick={() => {
                const name = window.prompt('Nombre de la página', page.name);
                if (name) useLienzo.getState().renamePage(page.id, name);
              }}
              title="Doble clic para renombrar"
            >
              {page.name}
            </button>
          ))}
          <button
            type="button"
            className="pages-arrow"
            onClick={() => useLienzo.getState().addPage()}
            aria-label="Añadir página"
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            className="pages-arrow is-danger"
            onClick={() => currentPageId && useLienzo.getState().deletePage(currentPageId)}
            aria-label="Eliminar página actual"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ) : null}

      <div className="classroom-dock" role="toolbar" aria-label="Herramientas de aula">
        <button
          type="button"
          className={panel === 'pages' ? 'is-active' : ''}
          onClick={() => {
            if (pages.length === 0) useLienzo.getState().addPage();
            else toggle('pages');
          }}
          title="Páginas"
        >
          <Grid2X2 size={16} />
          <span>Páginas</span>
        </button>
        <button
          type="button"
          className={panel === 'layers' ? 'is-active' : ''}
          onClick={() => toggle('layers')}
          title="Capas"
        >
          <Layers size={16} />
          <span>Capas</span>
        </button>
        <button
          type="button"
          className={panel === 'frames' ? 'is-active' : ''}
          onClick={() => toggle('frames')}
          title="Marcos y mini-mapa"
        >
          <MapIcon size={16} />
          <span>Mapa</span>
        </button>
        <button
          type="button"
          className={board.veil ? 'is-active' : ''}
          onClick={() => useLienzo.getState().toggleVeil()}
          title="Velo de aula"
        >
          {board.veil ? <EyeOff size={16} /> : <Eye size={16} />}
          <span>Velo</span>
        </button>
        <button
          type="button"
          className={board.ruler ? 'is-active' : ''}
          onClick={() => useLienzo.getState().toggleRuler()}
          title="Regla y ejes"
        >
          <Frame size={16} />
          <span>Regla</span>
        </button>
        <button
          type="button"
          className={board.noteGrid ? 'is-active' : ''}
          onClick={() => useLienzo.getState().toggleNoteGrid()}
          title="Rejilla de notas"
        >
          <Layers size={16} />
          <span>Rejilla</span>
        </button>
        <button
          type="button"
          className={projector ? 'is-active' : ''}
          onClick={() => useLienzo.getState().toggleProjector()}
          title="Modo proyector"
        >
          <Presentation size={16} />
          <span>Proyector</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (cards.length === 0) {
              useLienzo.getState().showToast('Crea una flashcard para estudiar.', 'info');
              return;
            }
            useLienzo.getState().setStudy({ index: 0, flipped: false });
          }}
          title="Modo estudio"
        >
          <GraduationCap size={16} />
          <span>Estudio</span>
        </button>
        <button
          type="button"
          className={panel === 'reactions' ? 'is-active' : ''}
          onClick={() => toggle('reactions')}
          title="Reacciones"
        >
          <Sparkles size={16} />
          <span>Reacción</span>
        </button>
        <button type="button" onClick={onRoom} title="Sala y chat">
          <MessageCircle size={16} />
          <span>Sala</span>
          {role === 'viewer' ? <em className="role-dot" title="Modo lector" /> : null}
        </button>
        <button type="button" onClick={onLab} title="Laboratorio v2.0">
          <Beaker size={16} />
          <span>Lab</span>
        </button>
      </div>

      {panel === 'pages' ? (
        <div className="chrome-panel pages-panel">
          <header>
            <strong>Páginas</strong>
            <button
              type="button"
              className="icon-btn"
              onClick={() => useLienzo.getState().addPage()}
              title="Añadir página"
            >
              <Plus size={14} />
            </button>
            <button type="button" className="icon-btn" onClick={() => setPanel(null)}>
              <X size={14} />
            </button>
          </header>
          {(pages.length > 0 ? pages : []).map((page) => (
            <div
              key={page.id}
              className={`chrome-row ${page.id === currentPageId ? 'is-active' : ''}`}
            >
              <button
                type="button"
                className="chrome-row-main"
                onClick={() => useLienzo.getState().setCurrentPage(page.id)}
              >
                {page.name}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  const name = window.prompt('Nombre de la página', page.name);
                  if (name) useLienzo.getState().renamePage(page.id, name);
                }}
                title="Renombrar"
              >
                ✎
              </button>
              <button
                type="button"
                className="icon-btn is-danger"
                onClick={() => useLienzo.getState().deletePage(page.id)}
                title="Eliminar página"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {pages.length === 0 ? <p className="chrome-empty">Aún no hay páginas.</p> : null}
        </div>
      ) : null}

      {panel === 'layers' ? (
        <div className="chrome-panel layers-panel">
          <header>
            <strong>Capas</strong>
            <button
              type="button"
              className="icon-btn"
              onClick={() => useLienzo.getState().addLayer()}
              title="Añadir capa"
            >
              <Plus size={14} />
            </button>
            <button type="button" className="icon-btn" onClick={() => setPanel(null)}>
              <X size={14} />
            </button>
          </header>
          {layers.length === 0 ? (
            <p className="chrome-empty">Crea una capa para agrupar elementos.</p>
          ) : null}
          {layers.map((layer) => (
            <div key={layer.id} className={`chrome-row ${layer.hidden ? 'is-muted' : ''}`}>
              <button
                type="button"
                className="chrome-row-main"
                onClick={() => {
                  if (selected.length === 0) {
                    useLienzo.getState().showToast('Selecciona elementos para moverlos de capa.', 'info');
                    return;
                  }
                  useLienzo.getState().assignSelectionToLayer(layer.id);
                }}
                title="Asignar selección a esta capa"
              >
                {layer.name}
                <em>
                  {board.items.filter((item) => item.layerId === layer.id).length} objetos
                </em>
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => useLienzo.getState().toggleLayerHidden(layer.id)}
                title={layer.hidden ? 'Mostrar capa' : 'Ocultar capa'}
              >
                {layer.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => useLienzo.getState().toggleLayerLocked(layer.id)}
                title={layer.locked ? 'Desbloquear capa' : 'Bloquear capa'}
              >
                {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  const name = window.prompt('Nombre de la capa', layer.name);
                  if (name) useLienzo.getState().renameLayer(layer.id, name);
                }}
                title="Renombrar capa"
              >
                ✎
              </button>
            </div>
          ))}
          {selected.length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => useLienzo.getState().assignSelectionToLayer(null)}
            >
              <RotateCcw size={13} /> Quitar de la capa
            </button>
          ) : null}
        </div>
      ) : null}

      {panel === 'frames' ? (
        <div className="chrome-panel frames-panel">
          <header>
            <strong>Marcos</strong>
            <span className="chrome-count">{frames.length}</span>
            <button type="button" className="icon-btn" onClick={() => setPanel(null)}>
              <X size={14} />
            </button>
          </header>
          {frames.length === 0 ? (
            <p className="chrome-empty">Crea marcos para organizar el tablero.</p>
          ) : null}
          {frames.map((frame) => (
            <button
              key={frame.id}
              type="button"
              className="frame-item"
              onClick={() => {
                useLienzo.getState().zoomToFrame(frame.id);
                setPanel(null);
              }}
            >
              <span className="frame-swatch" />
              <span>
                <strong>{frame.title || 'Marco'}</strong>
                <em>
                  {Math.round(frame.w)} × {Math.round(frame.h)}
                  {frame.veiled ? ' · velado' : ''}
                </em>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {panel === 'reactions' ? (
        <div className="chrome-panel reactions-panel">
          <header>
            <strong>Enviar reacción</strong>
            <button type="button" className="icon-btn" onClick={() => setPanel(null)}>
              <X size={14} />
            </button>
          </header>
          <div className="reaction-row">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  useLienzo.getState().sendReaction(emoji);
                  setPanel(null);
                }}
                aria-label={`Reaccionar con ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <p className="chrome-empty">Las reacciones aparecen en el lienzo y en la sala.</p>
        </div>
      ) : null}

      {!projector ? (
        <div className="reaction-layer" aria-hidden="true">
          {reactions.map((reaction) => {
            const screen = worldToScreen({ x: reaction.x, y: reaction.y }, viewport);
            return (
              <span
                key={reaction.id}
                className="reaction-burst"
                style={{ left: screen.x, top: screen.y }}
              >
                {reaction.emoji}
                <em>{reaction.author}</em>
              </span>
            );
          })}
        </div>
      ) : null}

      {study ? <StudyOverlay /> : null}
    </>
  );
}

function StudyOverlay() {
  const study = useLienzo((state) => state.study);
  const setStudy = useLienzo((state) => state.setStudy);
  const board = useLienzo((state) =>
    state.boards.find((candidate) => candidate.id === state.boardId),
  );
  if (!study || !board) return null;
  const cards = board.items.filter((item) => item.type === 'flashcard');
  if (cards.length === 0) {
    return (
      <div className="study-overlay" role="dialog" aria-modal="true" aria-label="Modo estudio">
        <div className="study-card">
          <p>No quedan flashcards en este tablero.</p>
        </div>
        <div className="study-controls">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setStudy(null)}>
            Salir
          </button>
        </div>
      </div>
    );
  }
  const index = Math.min(study.index, cards.length - 1);
  const card = cards[index];
  if (card.type !== 'flashcard') return null;

  return (
    <div className="study-overlay" role="dialog" aria-modal="true" aria-label="Modo estudio">
      <div className="study-card" onClick={() => setStudy({ index, flipped: !study.flipped })}>
        <span className="study-tag">
          {study.flipped ? 'Respuesta' : 'Pregunta'} · {index + 1}/{cards.length}
        </span>
        <p>{study.flipped ? card.back || 'Sin respuesta' : card.front || 'Sin pregunta'}</p>
        <em>Haz clic para voltear</em>
      </div>
      <div className="study-controls">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setStudy({ index: (index - 1 + cards.length) % cards.length, flipped: false })}
          aria-label="Anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setStudy({ index, flipped: !study.flipped })}
        >
          Voltear
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setStudy({ index: (index + 1) % cards.length, flipped: false })}
          aria-label="Siguiente"
        >
          <ChevronRight size={18} />
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setStudy(null)}>
          Salir
        </button>
      </div>
    </div>
  );
}
