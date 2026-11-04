import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  MessageSquarePlus,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { Board, Point } from '../types';
import { currentBoardOf, useLienzo } from '../store/boardStore';
import { CanvasStage } from './CanvasStage';
import { TopBar } from './TopBar';
import { MobileDock, Toolbar } from './Toolbar';
import { Inspector } from './Inspector';
import { ZoomBar } from './ZoomBar';
import { TextEditor } from './TextEditor';
import { QuickActions } from './QuickActions';
import { ContextMenu, type ContextMenuState } from './ContextMenu';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
  boundsOfItems,
  screenToWorld,
  worldToScreen,
  zoomAtPoint,
} from '../lib/geometry';
import { newImage } from '../lib/factory';
import { fileToImage } from '../lib/export';

function PresentationOverlay({ board }: { board: Board }) {
  const presentation = useLienzo((state) => state.presentation);
  const nextSlide = useLienzo((state) => state.nextSlide);
  const prevSlide = useLienzo((state) => state.prevSlide);
  const exitPresentation = useLienzo((state) => state.exitPresentation);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!presentation) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        nextSlide();
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        prevSlide();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        exitPresentation();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presentation, nextSlide, prevSlide, exitPresentation]);

  if (!presentation) return null;
  return (
    <>
      <div className="presentation-scrim" aria-hidden="true" />
      <div className="presentation-bar">
        <div className="presentation-brand">
          <span className="presentation-dot" />
          <strong>{board.name}</strong>
        </div>
        <div className="presentation-controls">
          <button
            type="button"
            onClick={prevSlide}
            disabled={presentation.index === 0}
            aria-label="Diapositiva anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {presentation.index + 1} / {presentation.slides.length}
          </span>
          <button
            type="button"
            onClick={nextSlide}
            disabled={presentation.index === presentation.slides.length - 1}
            aria-label="Diapositiva siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button type="button" className="presentation-exit" onClick={exitPresentation}>
          Salir <kbd>Esc</kbd>
        </button>
      </div>
      <div className="presentation-hint">Usa ← → para moverte por los marcos</div>
    </>
  );
}

interface CommentComposerProps {
  point: Point;
  onClose: () => void;
}

function CommentComposer({ point, onClose }: CommentComposerProps) {
  const [text, setText] = useState('');
  const viewport = useLienzo((state) => state.viewport);
  const stageSize = useLienzo((state) => state.stageSize);
  const addComment = useLienzo((state) => state.addComment);
  const userName = useLienzo((state) => state.userName);
  const ref = useRef<HTMLDivElement>(null);
  const screen = worldToScreen(point, viewport);
  const left = Math.max(16, Math.min(screen.x + 18, stageSize.w - 330));
  const top = Math.max(84, Math.min(screen.y + 18, stageSize.h - 240));

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    // Wait for the click that opened the composer to finish bubbling.
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', onPointerDown);
    }, 160);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  const publish = () => {
    if (!text.trim()) return;
    addComment(point, text);
    useLienzo.getState().setTool('select');
    onClose();
  };

  return (
    <div className="comment-composer" style={{ left, top }} ref={ref}>
      <div className="comment-composer-head">
        <span>
          <MessageSquarePlus size={15} /> Nuevo comentario
        </span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
          <X size={14} />
        </button>
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Una idea, una pregunta, un acuerdo…"
        rows={3}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            publish();
          }
          if (event.key === 'Escape') onClose();
        }}
      />
      <div className="comment-composer-foot">
        <span>{userName}</span>
        <button type="button" className="btn btn-primary btn-sm" onClick={publish} disabled={!text.trim()}>
          Publicar
        </button>
      </div>
    </div>
  );
}

export function BoardView() {
  const board = useLienzo((state) => currentBoardOf(state));
  const viewport = useLienzo((state) => state.viewport);
  const stageSize = useLienzo((state) => state.stageSize);
  const tool = useLienzo((state) => state.tool);
  const shapeKind = useLienzo((state) => state.shapeKind);
  const selected = useLienzo((state) => state.selected);
  const editingId = useLienzo((state) => state.editingId);
  const snapToGrid = useLienzo((state) => state.snapToGrid);
  const presentation = useLienzo((state) => state.presentation);
  const peers = useLienzo((state) => state.collab.peers);
  const isMobile = useMediaQuery('(max-width: 820px)');
  const zen = useLienzo((state) => state.zen);
  const theme = useLienzo((state) => state.theme);
  const saveStatus = useLienzo((state) => state.saveStatus);
  const setZen = useLienzo((state) => state.setZen);
  const [panelOpen, setPanelOpen] = useState(!isMobile);
  const [pendingComment, setPendingComment] = useState<Point | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceIdRef = useRef<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isMobile) setPanelOpen(selected.length > 0);
    else if (selected.length > 0) setPanelOpen(true);
  }, [selected.length, isMobile]);

  useEffect(() => {
    if (!board) return;
    const timer = setTimeout(() => {
      const state = useLienzo.getState();
      if (state.boardId !== board.id) return;
      const mobile = window.matchMedia('(max-width: 820px)').matches;
      const rightInset = mobile ? 0 : 300;
      if (board.items.length === 0) {
        state.setViewport({
          x: (state.stageSize.w - rightInset) / 2,
          y: state.stageSize.h / 2,
          zoom: 1,
        });
        return;
      }
      if (mobile) {
        const bounds = boundsOfItems(board.items);
        if (bounds) {
          const zoom = Math.min(0.62, Math.max(0.38, 720 / Math.max(bounds.w, 1)));
          state.setViewport({
            zoom,
            x: 16 - bounds.x * zoom,
            y: 18 - bounds.y * zoom,
          });
          return;
        }
      }
      state.fitToContent(90, rightInset);
    }, 110);
    return () => clearTimeout(timer);
    // Only reset the camera when switching boards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id]);

  const addImageFiles = useCallback(async (files: File[], worldPoint?: Point) => {
    const state = useLienzo.getState();
    const current = currentBoardOf(state);
    if (!current) return;
    const replaceId = replaceIdRef.current;
    replaceIdRef.current = null;
    const center = worldPoint ?? screenToWorld(
      { x: state.stageSize.w / 2, y: state.stageSize.h / 2 },
      state.viewport,
    );
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (!file.type.startsWith('image/')) continue;
      try {
        const image = await fileToImage(file);
        if (replaceId) {
          const target = current.items.find((item) => item.id === replaceId);
          if (target && target.type === 'image') {
            state.pushHistory();
            state.updateItem(replaceId, {
              src: image.src,
              w: image.width,
              h: image.height,
            });
          }
          break;
        }
        const item = newImage(image.src, image.width, image.height, {
          x: center.x + index * 28,
          y: center.y + index * 28,
        });
        state.addItem(item);
      } catch (error) {
        state.showToast(
          error instanceof Error ? error.message : 'No se pudo insertar la imagen.',
          'error',
        );
      }
    }
  }, []);

  const openImagePicker = (replaceId?: string) => {
    replaceIdRef.current = replaceId ?? null;
    fileInputRef.current?.click();
  };

  const onDragOver = (event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDropActive(true);
  };

  const onDragLeave = (event: React.DragEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDropActive(false);
  };

  const onDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDropActive(false);
    const files = Array.from(event.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/'),
    );
    if (files.length === 0) return;
    const rect = mainRef.current?.getBoundingClientRect();
    const screen = rect
      ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
      : { x: 0, y: 0 };
    const world = screenToWorld(screen, useLienzo.getState().viewport);
    void addImageFiles(files, world);
  };

  const zoomBy = (factor: number) => {
    const state = useLienzo.getState();
    state.setViewport(
      zoomAtPoint(state.viewport, factor, {
        x: state.stageSize.w / 2,
        y: state.stageSize.h / 2,
      }),
    );
  };

  const resetZoom = () => {
    const state = useLienzo.getState();
    const center = { x: state.stageSize.w / 2, y: state.stageSize.h / 2 };
    const world = screenToWorld(center, state.viewport);
    state.setViewport({ x: center.x - world.x, y: center.y - world.y, zoom: 1 });
  };

  useEffect(() => {
    if (!board) return;
    const onPaste = async (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const files: File[] = [];
      if (event.clipboardData?.files?.length) {
        files.push(...Array.from(event.clipboardData.files));
      } else if (event.clipboardData?.items) {
        for (const item of Array.from(event.clipboardData.items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
      }
      if (files.length === 0) return;
      event.preventDefault();
      await addImageFiles(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [board, addImageFiles]);

  useEffect(() => {
    if (!board) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const state = useLienzo.getState();
      if (state.presentation || state.editingId) return;
      const current = currentBoardOf(state);
      if (!current) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && key === 'y') {
        event.preventDefault();
        state.redo();
        return;
      }
      if (mod && key === 'k') {
        event.preventDefault();
        state.setUi('command', true);
        return;
      }
      if (mod && key === 'd') {
        event.preventDefault();
        state.duplicateSelected();
        return;
      }
      if (mod && key === 'a') {
        event.preventDefault();
        state.selectAll();
        return;
      }
      if (mod && key === 's') {
        event.preventDefault();
        state.showToast('Lienzo guarda automáticamente en este dispositivo.', 'success');
        return;
      }
      if (mod && key === 'g') {
        event.preventDefault();
        if (event.shiftKey) state.ungroupSelected();
        else state.groupSelected();
        return;
      }
      if (mod && key === '0') {
        event.preventDefault();
        resetZoom();
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        if (state.selected.length > 0) {
          event.preventDefault();
          state.deleteSelected();
        }
        return;
      }
      if (key === 'escape') {
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        if (zen) {
          setZen(false);
          return;
        }
        if (pendingComment) {
          setPendingComment(null);
          return;
        }
        if (state.selected.length > 0) {
          state.clearSelection();
          return;
        }
        if (panelOpen && isMobile) setPanelOpen(false);
        return;
      }
      if (key === 'enter' && state.selected.length === 1) {
        const item = current.items.find((candidate) => candidate.id === state.selected[0]);
        if (item && (item.type === 'sticky' || item.type === 'text' || item.type === 'shape')) {
          event.preventDefault();
          state.startEditing(item.id);
        }
        return;
      }
      if (event.key === '?' || (key === '/' && event.shiftKey)) {
        event.preventDefault();
        state.setUi('shortcuts', true);
        return;
      }
      if (key === '+' || key === '=') {
        event.preventDefault();
        zoomBy(1.2);
        return;
      }
      if (key === '-') {
        event.preventDefault();
        zoomBy(1 / 1.2);
        return;
      }
      if (event.shiftKey && key === '1') {
        event.preventDefault();
        state.fitToContent();
        return;
      }
      if (!mod && (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright')) {
        if (state.selected.length === 0) return;
        event.preventDefault();
        const amount = event.shiftKey ? 10 : 1;
        const dx = key === 'arrowleft' ? -amount : key === 'arrowright' ? amount : 0;
        const dy = key === 'arrowup' ? -amount : key === 'arrowdown' ? amount : 0;
        const items = current.items.filter(
          (item) =>
            state.selected.includes(item.id) &&
            item.type !== 'connector' &&
            !item.locked,
        );
        if (items.length === 0) return;
        state.pushHistory();
        state.updateItems(
          items.map((item) => ({
            id: item.id,
            patch: { x: item.x + dx, y: item.y + dy },
          })),
        );
        return;
      }
      if (mod) return;

      const tools: Record<string, () => void> = {
        v: () => state.setTool('select'),
        h: () => state.setTool('hand'),
        n: () => state.setTool('sticky'),
        t: () => state.setTool('text'),
        r: () => state.setTool('shape'),
        o: () => {
          state.setShapeKind('ellipse');
          state.setTool('shape');
        },
        d: () => {
          state.setShapeKind('diamond');
          state.setTool('shape');
        },
        c: () => state.setTool('connector'),
        p: () => state.setTool('pen'),
        l: () => state.setTool('highlighter'),
        k: () => state.setTool('laser'),
        g: () => state.setSnapToGrid(!state.snapToGrid),
        f: () => state.setTool('frame'),
        m: () => state.setTool('comment'),
        e: () => state.setTool('eraser'),
        i: () => openImagePicker(),
      };
      if (tools[key]) {
        event.preventDefault();
        tools[key]();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [board, pendingComment, panelOpen, isMobile, addImageFiles, contextMenu, zen, setZen]);

  if (!board) return null;

  const showInspector = panelOpen && (selected.length > 0 || !isMobile);
  const activeSlide = presentation?.slides[presentation.index];
  const presentationClip = activeSlide
    ? {
        x: activeSlide.x - 24,
        y: activeSlide.y - 46,
        w: activeSlide.w + 48,
        h: activeSlide.h + 58,
      }
    : null;

  return (
    <div className={`board-shell ${zen ? 'is-zen' : ''} theme-${theme}`}>
      {!presentation && !zen ? <TopBar board={board} /> : null}
      <main
        ref={mainRef}
        className={`canvas-area ${presentation ? 'is-presenting' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <CanvasStage
          board={board}
          viewport={viewport}
          tool={tool}
          shapeKind={shapeKind}
          selected={selected}
          editingId={editingId}
          snapToGrid={snapToGrid}
          readOnly={Boolean(presentation)}
          clip={presentationClip}
          onContextMenu={(world, item, screen) => {
            setContextMenu({ world, item, screen });
          }}
          onCommentPoint={(point) => {
            setPendingComment(point);
            setPanelOpen(false);
          }}
        />

        <TextEditor board={board} viewport={viewport} />

        {!presentation && !zen ? (
          <>
            <div className="comment-pins">
              {board.comments.map((comment, index) => {
                const screen = worldToScreen(comment, viewport);
                if (
                  screen.x < -30 ||
                  screen.y < -30 ||
                  screen.x > stageSize.w + 30 ||
                  screen.y > stageSize.h + 30
                ) {
                  return null;
                }
                return (
                  <button
                    key={comment.id}
                    type="button"
                    className={`comment-pin ${comment.resolved ? 'is-resolved' : ''}`}
                    style={{ left: screen.x, top: screen.y }}
                    title={comment.text}
                    onClick={() => {
                      useLienzo.getState().focusRect({
                        x: comment.x - 320,
                        y: comment.y - 220,
                        w: 640,
                        h: 440,
                      });
                      setPanelOpen(true);
                    }}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            <div className="presence-layer" aria-hidden="true">
              {peers.map((peer) =>
                peer.cursor ? (
                  <div
                    key={peer.id}
                    className="remote-cursor"
                    style={{
                      left: peer.cursor.x * viewport.zoom + viewport.x,
                      top: peer.cursor.y * viewport.zoom + viewport.y,
                      color: peer.color,
                    }}
                  >
                    <svg width="18" height="20" viewBox="0 0 18 20" fill="none">
                      <path
                        d="M2 2L15.5 8.3L9.2 10.2L7.2 17.5L2 2Z"
                        fill="currentColor"
                        stroke="#FFFDF7"
                        strokeWidth="1.4"
                      />
                    </svg>
                    <span style={{ background: peer.color }}>{peer.name}</span>
                  </div>
                ) : null,
              )}
            </div>
          </>
        ) : null}

        {!presentation && !zen ? (
          <>
            <Toolbar
              tool={tool}
              shapeKind={shapeKind}
              onTool={(next) => useLienzo.getState().setTool(next)}
              onShapeKind={(kind) => useLienzo.getState().setShapeKind(kind)}
              onImage={() => openImagePicker()}
              onTemplates={() => useLienzo.getState().setUi('templates', true)}
            />

            <ZoomBar
              viewport={viewport}
              onZoom={zoomBy}
              onReset={resetZoom}
              onFit={() => useLienzo.getState().fitToContent()}
            />

            <MobileDock
              tool={tool}
              shapeKind={shapeKind}
              onTool={(next) => useLienzo.getState().setTool(next)}
              onShapeKind={(kind) => useLienzo.getState().setShapeKind(kind)}
              onImage={() => openImagePicker()}
              onTemplates={() => useLienzo.getState().setUi('templates', true)}
            />

            {showInspector ? (
              <Inspector
                board={board}
                onClose={() => setPanelOpen(false)}
                onImageReplace={() => {
                  const image = board.items.find(
                    (item) => item.id === selected[0] && item.type === 'image',
                  );
                  if (image) openImagePicker(image.id);
                }}
                onTemplates={() => useLienzo.getState().setUi('templates', true)}
              />
            ) : (
              <button
                type="button"
                className="inspector-fab"
                onClick={() => setPanelOpen(true)}
                aria-label="Abrir propiedades"
              >
                <SlidersHorizontal size={16} />
                <span>Propiedades</span>
              </button>
            )}

            {pendingComment ? (
              <CommentComposer
                point={pendingComment}
                onClose={() => {
                  setPendingComment(null);
                  useLienzo.getState().setTool('select');
                }}
              />
            ) : null}
          </>
        ) : null}

        <PresentationOverlay board={board} />

        {!presentation && !zen ? (
          <QuickActions
            board={board}
            selected={selected}
            viewport={viewport}
            stageSize={stageSize}
          />
        ) : null}

        {!presentation ? (
          <ContextMenu
            board={board}
            state={contextMenu}
            onClose={() => setContextMenu(null)}
          />
        ) : null}

        {dropActive ? (
          <div className="drop-overlay" aria-hidden="true">
            <ImagePlus size={30} />
            <strong>Suelta para insertar la imagen</strong>
            <span>Se añadirá donde estás mirando</span>
          </div>
        ) : null}

        {zen ? (
          <button type="button" className="zen-exit" onClick={() => setZen(false)}>
            Salir del modo concentración <kbd>Esc</kbd>
          </button>
        ) : null}

        {!presentation && !zen ? (
          <div className="board-status" aria-live="polite">
            <span>{board.items.length} elementos</span>
            <span className="status-dot" />
            <span>
              {selected.length > 0 ? `${selected.length} seleccionados` : 'Sin selección'}
            </span>
            <span className="status-dot" />
            <span className={snapToGrid ? 'is-on' : ''}>
              {snapToGrid ? 'Ajuste activo' : 'Ajuste libre'}
            </span>
            <span className="status-dot" />
            <span>{saveStatus === 'saved' ? 'Guardado local' : 'Guardando…'}</span>
          </div>
        ) : null}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) void addImageFiles(files);
        }}
      />
    </div>
  );
}
