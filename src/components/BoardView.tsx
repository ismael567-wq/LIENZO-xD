import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Lock,
  MessageSquarePlus,
  Mic,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { Board, InsertKind, Point, VoiceNote } from '../types';
import { currentBoardOf, useLienzo } from '../store/boardStore';
import { CanvasStage } from './CanvasStage';
import { TopBar } from './TopBar';
import { MobileDock, Toolbar } from './Toolbar';
import { Inspector } from './Inspector';
import { ZoomBar } from './ZoomBar';
import { TextEditor } from './TextEditor';
import { QuickActions } from './QuickActions';
import { ContextMenu, type ContextMenuState } from './ContextMenu';
import { InsertMenu } from './InsertMenu';
import { MediaOverlay } from './MediaOverlay';
import { BoardChrome } from './BoardChrome';
import { RoomPanel } from './RoomPanel';
import { V2Tools } from './V2Tools';
import { VoiceRecorder } from './VoiceRecorder';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
  boundsOfItems,
  screenToWorld,
  uid,
  worldToScreen,
  zoomAtPoint,
} from '../lib/geometry';
import {
  newCode,
  newConnector,
  newFile,
  newFlashcard,
  newImage,
  newMarkdown,
  newSticker,
  newStickyRect,
  newTable,
  newText,
  newTimerItem,
} from '../lib/factory';
import { formatDuration } from '../lib/audio';
import { fileToImage } from '../lib/export';
import {
  guessFileKind,
  readStoredFileAsText,
  saveStoredFile,
  uploadFileToServer,
} from '../lib/files';
import { canConvertOffice, officeToItems } from '../lib/office';

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
  const [audio, setAudio] = useState<VoiceNote | null>(null);
  const [recording, setRecording] = useState(false);
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
    if (!text.trim() && !audio) return;
    addComment(point, text, audio ?? undefined);
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
        <div className="comment-composer-tools">
          {audio ? (
            <span className="comment-audio-badge" title="Comentario con nota de voz">
              <Mic size={12} /> {audio.duration}s
            </span>
          ) : null}
          <button
            type="button"
            className="icon-btn"
            onClick={() => setRecording(true)}
            aria-label="Añadir nota de voz"
            title="Nota de voz"
          >
            <Mic size={15} />
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={publish} disabled={!text.trim() && !audio}>
            Publicar
          </button>
        </div>
      </div>
      {recording ? (
        <VoiceRecorder
          title="Nota de voz del comentario"
          author={userName}
          onCancel={() => setRecording(false)}
          onSaved={(note) => {
            setAudio(note);
            setRecording(false);
          }}
        />
      ) : null}
    </div>
  );
}

function RulerOverlay({
  viewport,
  stageSize,
}: {
  viewport: { x: number; y: number; zoom: number };
  stageSize: { w: number; h: number };
}) {
  const steps = [10, 20, 50, 100, 200, 500, 1000];
  const step = steps.find((candidate) => candidate * viewport.zoom >= 60) ?? 1000;
  const startX = -viewport.x / viewport.zoom;
  const startY = -viewport.y / viewport.zoom;
  const endX = startX + stageSize.w / viewport.zoom;
  const endY = startY + stageSize.h / viewport.zoom;
  const firstX = Math.floor(startX / step) * step;
  const firstY = Math.floor(startY / step) * step;
  const marksX: Array<{ screen: number; world: number }> = [];
  const marksY: Array<{ screen: number; world: number }> = [];
  for (let world = firstX; world <= endX; world += step) {
    marksX.push({ screen: world * viewport.zoom + viewport.x, world });
  }
  for (let world = firstY; world <= endY; world += step) {
    marksY.push({ screen: world * viewport.zoom + viewport.y, world });
  }
  return (
    <div className="ruler-layer" aria-hidden="true">
      <div className="ruler ruler-x">
        {marksX.map((mark) => (
          <span key={mark.world} style={{ left: mark.screen }}>
            <em>{mark.world}</em>
          </span>
        ))}
      </div>
      <div className="ruler ruler-y">
        {marksY.map((mark) => (
          <span key={mark.world} style={{ top: mark.screen }}>
            <em>{mark.world}</em>
          </span>
        ))}
      </div>
      <div className="ruler-origin" style={{ left: viewport.x, top: viewport.y }} />
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
  const trail = useLienzo((state) => state.trail);
  const boards = useLienzo((state) => state.boards);
  const setZen = useLienzo((state) => state.setZen);
  const [panelOpen, setPanelOpen] = useState(!isMobile);
  const [pendingComment, setPendingComment] = useState<Point | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const replaceIdRef = useRef<string | null>(null);
  const voicePointRef = useRef<Point | null>(null);
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
          // En pantallas estrechas priorizamos que quepa el ancho real del
          // lienzo, no una columna fija de 720 px pensada para tablet.
          const available = Math.max(240, state.stageSize.w - 32);
          const zoom = Math.min(0.62, Math.max(0.24, available / Math.max(bounds.w, 1)));
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

  const addTimer = () => {
    const state = useLienzo.getState();
    const world = screenToWorld(
      { x: state.stageSize.w / 2, y: state.stageSize.h / 2 },
      state.viewport,
    );
    state.addItem(newTimerItem(world, 5));
    state.setTool('select');
    state.showToast('Temporizador de 5 minutos añadido. Doble clic para iniciar.', 'info');
  };

  const insertObject = (kind: InsertKind) => {
    const state = useLienzo.getState();
    const world = screenToWorld(
      { x: state.stageSize.w / 2, y: state.stageSize.h / 2 },
      state.viewport,
    );
    state.setTool('select');
    switch (kind) {
      case 'code':
        state.addItem(newCode(world, '', 'ts'), { edit: true });
        return;
      case 'markdown':
        state.addItem(newMarkdown(world), { edit: true });
        return;
      case 'table':
        state.addItem(newTable(world), { edit: true });
        return;
      case 'sticker':
        state.addItem(newSticker(world, '⭐'));
        return;
      case 'flashcard':
        state.addItem(newFlashcard(world, '¿Qué quieres recordar?', 'Tu respuesta'), {
          edit: true,
        });
        return;
      case 'mermaid':
        state.addItem(
          newCode(
            world,
            'graph TD\n  A[Idea] --> B[Decisión]\n  B --> C[Acción]\n  B --> D[Revisión]',
            'mermaid',
          ),
          { edit: true },
        );
        return;
      case 'voice':
        voicePointRef.current = world;
        setVoiceOpen(true);
        return;
      case 'video': {
        const url = window.prompt(
          'Pega una URL de YouTube, Vimeo o un vídeo web. Deja vacío para elegir un archivo.',
          '',
        );
        if (url === null) return;
        if (url.trim()) {
          state.addItem(
            newFile(world, {
              fileId: `remote-${uid(10)}`,
              name: 'Vídeo remoto',
              mime: 'video/url',
              size: 0,
              kind: 'video',
              url: url.trim(),
            }),
          );
          state.showToast('Vídeo añadido. Doble clic para reproducirlo.', 'success');
        } else {
          videoInputRef.current?.click();
        }
        return;
      }
      default:
        return;
    }
  };

  const addDroppedFiles = useCallback(
    async (files: File[], worldPoint?: Point) => {
      if (files.length === 0) return;
      const imageFiles = files.filter((file) => file.type.startsWith('image/'));
      const otherFiles = files.filter((file) => !file.type.startsWith('image/'));
      if (imageFiles.length > 0) await addImageFiles(imageFiles, worldPoint);
      if (otherFiles.length === 0) return;
      const state = useLienzo.getState();
      const current = currentBoardOf(state);
      if (!current) return;
      const center =
        worldPoint ??
        screenToWorld(
          { x: state.stageSize.w / 2, y: state.stageSize.h / 2 },
          state.viewport,
        );
      const base = state.collab.localServerUrl ?? state.collab.url;
      for (let index = 0; index < otherFiles.length; index += 1) {
        const file = otherFiles[index];
        const fileId = uid(14);
        const point = {
          x: center.x + (index % 3) * 330,
          y: center.y + Math.floor(index / 3) * 220 + index * 8,
        };
        try {
          if (canConvertOffice(file.name, file.type)) {
            const convert = window.confirm(
              `¿Convertir "${file.name}" en objetos nativos del lienzo?\n\nAceptar: marcos, textos o tabla editable.\nCancelar: se guarda como archivo adjunto.`,
            );
            if (convert) {
              const items = officeToItems(
                file.name,
                file.type,
                await file.arrayBuffer(),
                point,
              );
              if (items.length > 0) {
                state.pushHistory();
                for (const item of items) {
                  state.addItem(item, { select: false, history: false });
                }
                state.select(
                  items.filter((item) => item.type !== 'connector').map((item) => item.id),
                );
                state.showToast(
                  `"${file.name}" convertido en ${items.length} objetos nativos.`,
                  'success',
                );
                continue;
              }
            }
          }
          await saveStoredFile(fileId, file);
          const kind = guessFileKind(file.type, file.name);
          let text: string | undefined;
          if (kind === 'csv' || file.type.startsWith('text/')) {
            try {
              text = (await file.text()).slice(0, 200_000);
            } catch {
              // Text extraction is best-effort.
            }
          }
          const item = newFile(point, {
            fileId,
            name: file.name,
            mime: file.type || 'application/octet-stream',
            size: file.size,
            kind,
            text,
          });
          state.addItem(item);
          if (base) {
            void uploadFileToServer(
              base,
              fileId,
              file,
              undefined,
              file.type || 'application/octet-stream',
            ).catch(() => {
              // LAN sync is optional; the local copy already exists.
            });
          }
        } catch (error) {
          state.showToast(
            error instanceof Error ? error.message : 'No se pudo guardar el archivo.',
            'error',
          );
        }
      }
    },
    [addImageFiles],
  );

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
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;
    const rect = mainRef.current?.getBoundingClientRect();
    const screen = rect
      ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
      : { x: 0, y: 0 };
    const world = screenToWorld(screen, useLienzo.getState().viewport);
    void addDroppedFiles(files, world);
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
      if (files.length === 0) {
        const text = event.clipboardData?.getData('text/plain')?.trim();
        if (!text) return;
        event.preventDefault();
        const state = useLienzo.getState();
        const world = screenToWorld(
          { x: state.stageSize.w / 2, y: state.stageSize.h / 2 },
          state.viewport,
        );
        state.addItem(newText(world, text));
        return;
      }
      event.preventDefault();
      await addDroppedFiles(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [board, addDroppedFiles]);

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
      if (mod && key === 'f') {
        event.preventDefault();
        state.setUi('search', true);
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
        state.showToast('tiza guarda automáticamente en este dispositivo.', 'success');
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
        if (
          item &&
          (item.type === 'sticky' ||
            item.type === 'text' ||
            item.type === 'shape' ||
            item.type === 'code' ||
            item.type === 'markdown' ||
            item.type === 'table' ||
            item.type === 'flashcard')
        ) {
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

      if (event.key === 'Tab' && state.selected.length === 1) {
        const parent = current.items.find((candidate) => candidate.id === state.selected[0]);
        if (parent && parent.type === 'sticky') {
          event.preventDefault();
          const childCount = current.items.filter(
            (item) => item.type === 'connector' && item.from.itemId === parent.id,
          ).length;
          const child = newStickyRect(
            {
              x: parent.x + parent.w + 110,
              y: parent.y + childCount * (parent.h + 36),
              w: parent.w,
              h: parent.h,
            },
            (childCount + 1) % 6,
          );
          child.text = '';
          const connector = newConnector(
            {
              itemId: parent.id,
              x: parent.x + parent.w,
              y: parent.y + parent.h / 2,
              side: 'right',
            },
            {
              itemId: child.id,
              x: child.x,
              y: child.y + child.h / 2,
              side: 'left',
            },
          );
          state.pushHistory();
          state.addItem(connector, { select: false, history: false });
          state.addItem(child, { edit: true, history: false });
          return;
        }
      }

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
        {!presentation && trail.length > 0 ? (
          <nav className="board-trail" aria-label="Ruta de tableros">
            <button type="button" onClick={() => useLienzo.getState().closeBoard()}>
              Inicio
            </button>
            {trail.map((id) => {
              const previous = boards.find((candidate) => candidate.id === id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => useLienzo.getState().openBoard(id)}
                >
                  {previous?.name ?? 'Tablero'}
                </button>
              );
            })}
            <span aria-current="page">{board.name}</span>
          </nav>
        ) : null}
        <CanvasStage
          board={board}
          viewport={viewport}
          tool={tool}
          shapeKind={shapeKind}
          selected={selected}
          editingId={editingId}
          snapToGrid={snapToGrid}
          readOnly={Boolean(presentation) || Boolean(board.locked)}
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

        {!presentation ? (
          <BoardChrome
            board={board}
            onRoom={() => setRoomOpen((value) => !value)}
            onLab={() => setLabOpen((value) => !value)}
          />
        ) : null}

        {labOpen && !presentation ? (
          <V2Tools board={board} onClose={() => setLabOpen(false)} />
        ) : null}

        {board.ruler && !presentation ? (
          <RulerOverlay viewport={viewport} stageSize={stageSize} />
        ) : null}

        {board.locked && !presentation ? (
          <button
            type="button"
            className="canvas-locked-banner"
            onClick={() => useLienzo.getState().toggleBoardLock()}
            title="Desbloquear la pizarra"
          >
            <Lock size={13} /> Pizarra bloqueada · solo lectura
          </button>
        ) : null}

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
              onTimer={addTimer}
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
              onTimer={addTimer}
            />

            <InsertMenu onInsert={insertObject} />
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

        <RoomPanel open={roomOpen} onClose={() => setRoomOpen(false)} />
        <MediaOverlay />
        {voiceOpen ? (
          <VoiceRecorder
            author={useLienzo.getState().userName}
            onCancel={() => setVoiceOpen(false)}
            onSaved={(note) => {
              const state = useLienzo.getState();
              const point =
                voicePointRef.current ??
                screenToWorld(
                  { x: state.stageSize.w / 2, y: state.stageSize.h / 2 },
                  state.viewport,
                );
              const item = newFile(point, {
                fileId: note.fileId,
                name: `Nota de voz · ${formatDuration(note.duration)}`,
                mime: note.mime,
                size: 0,
                kind: 'audio',
              });
              state.addItem({ ...item, voiceNote: note });
              state.showToast('Nota de voz añadida. Doble clic para escucharla.', 'success');
              setVoiceOpen(false);
            }}
          />
        ) : null}

        {dropActive ? (
          <div className="drop-overlay" aria-hidden="true">
            <ImagePlus size={30} />
            <strong>Suelta para insertar archivos</strong>
            <span>Imágenes, PDF, vídeo, audio, CSV… se guardan en tu dispositivo</span>
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
        multiple
        className="visually-hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) void addDroppedFiles(files);
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="visually-hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) void addDroppedFiles(files);
        }}
      />
    </div>
  );
}
