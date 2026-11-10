import { useEffect, useRef, useState } from 'react';
import {
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleDot,
  Combine,
  Copy,
  Download,
  FileCode2,
  FileDown,
  FileJson,
  FileText,
  FileUp,
  Grid3X3,
  History,
  Image as ImageIcon,
  Info,
  Keyboard,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Moon,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Settings,
  Sparkles,
  Star,
  Sun,
  TimerReset,
  Trash2,
  Unlock,
  Upload,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { Board, ImageItem } from '../types';
import { useLienzo } from '../store/boardStore';
import {
  copyBoardPNG,
  exportBoardJSON,
  exportBoardPDF,
  exportBoardPNG,
  exportBoardSVG,
  exportWorkspace,
  parseWorkspaceFile,
  renderBoardPNGBlob,
  safeFileName,
} from '../lib/export';
import { downloadBoardMarkdown } from '../lib/markdown';
import { importFromText, type ImportFormat } from '../lib/importers';
import { boundsOfItems, uid } from '../lib/geometry';
import { copyToClipboard } from '../lib/net';
import { hasPendingUpdate, useUpdates } from '../store/updateStore';
import { initials, Logo } from './Logo';

interface TopBarProps {
  board: Board;
}

function useOutsideClose(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, [open, ref, close]);
}

function Presence() {
  const peers = useLienzo((state) => state.collab.peers);
  const status = useLienzo((state) => state.collab.status);
  const userName = useLienzo((state) => state.userName);
  const selfColor = useLienzo((state) => state.collab.selfColor);
  const setUi = useLienzo((state) => state.setUi);
  const everyone = [{ id: 'self', name: userName, color: selfColor }, ...peers].slice(0, 4);
  return (
    <button
      type="button"
      className="presence"
      onClick={() => setUi('share', true)}
      aria-label="Ver personas en la sala"
      title={
        status === 'on'
          ? `${peers.length + 1} persona${peers.length === 0 ? '' : 's'} en la sala`
          : 'Solo tú por ahora'
      }
    >
      <span className={`presence-live ${status === 'on' ? 'is-on' : ''}`}>
        {status === 'on' ? <Wifi size={11} /> : status === 'error' ? <WifiOff size={11} /> : <ShieldCheck size={11} />}
        <span className="presence-live-label">
          {status === 'on' ? 'En vivo' : status === 'connecting' ? 'Conectando' : status === 'error' ? 'Sala offline' : 'Local'}
        </span>
      </span>
      <span className="avatar-stack">
        {everyone.map((person) => (
          <span
            key={person.id}
            className="avatar"
            style={{ background: person.color }}
            title={person.name}
          >
            {initials(person.name)}
          </span>
        ))}
        {peers.length > 3 ? <span className="avatar avatar-more">+{peers.length - 3}</span> : null}
      </span>
    </button>
  );
}

export function TopBar({ board }: TopBarProps) {
  const [name, setName] = useState(board.name);
  const [exportOpen, setExportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const workspaceInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const importFormatRef = useRef<ImportFormat>('excalidraw');

  const pieces = useLienzo((state) => state.pieces);
  const loadPieces = useLienzo((state) => state.loadPieces);
  const savePiece = useLienzo((state) => state.savePiece);
  const deletePiece = useLienzo((state) => state.deletePiece);
  const insertPiece = useLienzo((state) => state.insertPiece);

  const saveStatus = useLienzo((state) => state.saveStatus);
  const closeBoard = useLienzo((state) => state.closeBoard);
  const renameBoard = useLienzo((state) => state.renameBoard);
  const duplicateBoard = useLienzo((state) => state.duplicateBoard);
  const deleteBoard = useLienzo((state) => state.deleteBoard);
  const toggleFavorite = useLienzo((state) => state.toggleFavorite);
  const setBackground = useLienzo((state) => state.setBackground);
  const theme = useLienzo((state) => state.theme);
  const toggleTheme = useLienzo((state) => state.toggleTheme);
  const openTimer = useLienzo((state) => state.openTimer);
  const toggleBoardLock = useLienzo((state) => state.toggleBoardLock);
  const zen = useLienzo((state) => state.zen);
  const toggleZen = useLienzo((state) => state.toggleZen);
  const selected = useLienzo((state) => state.selected);
  const gridSize = useLienzo((state) => state.gridSize);
  const setGridSize = useLienzo((state) => state.setGridSize);
  const startPresentation = useLienzo((state) => state.startPresentation);
  const setUi = useLienzo((state) => state.setUi);
  const showToast = useLienzo((state) => state.showToast);
  const pendingUpdate = useUpdates(hasPendingUpdate);
  const latestVersion = useUpdates((state) => state.latest);

  useOutsideClose(exportRef, exportOpen, () => setExportOpen(false));
  useOutsideClose(moreRef, moreOpen, () => setMoreOpen(false));

  useEffect(() => {
    setName(board.name);
  }, [board.id, board.name]);

  useEffect(() => {
    loadPieces();
  }, [loadPieces]);

  const commitName = () => {
    const clean = name.trim();
    if (clean && clean !== board.name) renameBoard(board.id, clean);
    else setName(board.name);
  };

  const handleImportFile = async (file: File) => {
    try {
      const items = importFromText(importFormatRef.current, await file.text());
      if (items.length === 0) {
        showToast('El archivo no produjo ningún elemento.', 'info');
        return;
      }
      const store = useLienzo.getState();
      store.pushHistory();
      for (const item of items) {
        store.addItem(item, { select: false, history: false });
      }
      store.select(items.map((item) => item.id));
      showToast(
        `Importados ${items.length} elemento(s) desde ${importFormatRef.current}.`,
        'success',
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'No se pudo importar el archivo.',
        'error',
      );
    }
  };

  const handleFlatten = async () => {
    if (selected.length === 0) {
      showToast('Selecciona los elementos que quieres aplanar.', 'info');
      return;
    }
    const store = useLienzo.getState();
    const current = useLienzo.getState().boards.find((candidate) => candidate.id === board.id);
    if (!current) return;
    const scoped = current.items.filter((item) => selected.includes(item.id));
    const bounds = boundsOfItems(scoped);
    if (!bounds) {
      showToast('La selección no tiene contenido visible.', 'info');
      return;
    }
    try {
      const padding = 72;
      const width = Math.max(200, Math.ceil(bounds.w + padding * 2));
      const height = Math.max(200, Math.ceil(bounds.h + padding * 2));
      const blob = await renderBoardPNGBlob(current, {
        selected,
        theme,
        transparent: true,
        scale: 2,
      });
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const image: ImageItem = {
        id: uid(9),
        type: 'image',
        x: Math.round(bounds.x - padding),
        y: Math.round(bounds.y - padding),
        w: width,
        h: height,
        src,
        alt: 'Selección aplanada',
        radius: 6,
        updatedAt: Date.now(),
      };
      store.deleteSelected();
      store.addItem(image, { history: false });
      showToast('Selección aplanada en una sola imagen.', 'success');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'No se pudo aplanar la selección.',
        'error',
      );
    }
  };

  const handleExport = async (
    kind: 'png' | 'json' | 'selection' | 'copy' | 'pdf' | 'svg' | 'workspace' | 'markdown',
  ) => {
    setExportOpen(false);
    try {
      if (kind === 'json') {
        exportBoardJSON(board);
        showToast('Tablero exportado en JSON.', 'success');
      } else if (kind === 'markdown') {
        downloadBoardMarkdown(board);
        showToast('Markdown exportado con la estructura del tablero.', 'success');
      } else if (kind === 'copy') {
        await copyBoardPNG(board, {
          selected: selected.length > 0 ? selected : undefined,
          theme,
        });
        showToast(
          selected.length > 0
            ? 'Selección copiada como PNG.'
            : 'Tablero copiado como PNG.',
          'success',
        );
      } else if (kind === 'selection') {
        await exportBoardPNG(board, { selected, theme });
        showToast('PNG de la selección generado.', 'success');
      } else if (kind === 'svg') {
        exportBoardSVG(board, { selected, theme });
        showToast('SVG vectorial generado.', 'success');
      } else if (kind === 'pdf') {
        await exportBoardPDF(board, { theme });
        showToast('PDF con una página por marco generado.', 'success');
      } else if (kind === 'workspace') {
        exportWorkspace(useLienzo.getState().boards);
        showToast('Backup completo del workspace generado.', 'success');
      } else {
        await exportBoardPNG(board, { theme });
        showToast('PNG generado con todo el tablero.', 'success');
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'No se pudo exportar el tablero.',
        'error',
      );
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-btn topbar-home"
          onClick={closeBoard}
          aria-label="Volver a mis tableros"
          title="Mis tableros"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="brand-button"
          onClick={closeBoard}
          aria-label="Ir a tiza"
        >
          <Logo size={27} />
        </button>
        <div className="topbar-title">
          <input
            ref={titleRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                setName(board.name);
                event.currentTarget.blur();
              }
            }}
            className="board-title-input"
            style={{ width: `${Math.min(34, Math.max(10, name.length + 1))}ch` }}
            aria-label="Nombre del tablero"
          />
          <span className={`save-state is-${saveStatus}`}>
            {saveStatus === 'saving' ? (
              <Loader2 size={11} className="spin" />
            ) : saveStatus === 'saved' ? (
              <Check size={11} />
            ) : (
              <CircleDot size={11} />
            )}
            {saveStatus === 'saving'
              ? 'Guardando'
              : saveStatus === 'saved'
                ? 'Guardado'
                : 'Sin guardar'}
          </span>
        </div>
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className={`icon-btn topbar-options ${pendingUpdate ? 'has-update' : ''}`}
          onClick={() => setUi('options', true)}
          aria-label="Opciones y actualizaciones"
          title={
            pendingUpdate
              ? `Actualización ${latestVersion ?? ''} disponible`
              : 'Opciones y actualizaciones'
          }
        >
          <Settings size={18} />
          {pendingUpdate ? <span className="update-dot" aria-hidden="true" /> : null}
        </button>
        <button
          type="button"
          className="icon-btn topbar-theme"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          type="button"
          className={`icon-btn topbar-zen ${zen ? 'is-active' : ''}`}
          onClick={toggleZen}
          aria-label={zen ? 'Salir del modo concentración' : 'Modo concentración'}
          title={zen ? 'Salir del modo concentración' : 'Modo concentración (oculta paneles)'}
        >
          {zen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        <Presence />
        <button
          type="button"
          className="btn btn-ghost topbar-present"
          onClick={startPresentation}
          title="Presentar marcos"
        >
          <Play size={15} />
          <span>Presentar</span>
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setUi('share', true)}
        >
          <Share2 size={15} />
          <span>Compartir</span>
        </button>
        <div className="menu-wrap export-wrap" ref={exportRef}>
          <button
            type="button"
            className={`icon-btn ${exportOpen ? 'is-active' : ''}`}
            onClick={() => setExportOpen((open) => !open)}
            aria-label="Exportar"
            aria-expanded={exportOpen}
            title="Exportar"
          >
            <Download size={18} />
          </button>
          {exportOpen ? (
            <div className="menu" role="menu">
              <div className="menu-label">Exportar tablero</div>
              <button type="button" role="menuitem" onClick={() => handleExport('png')}>
                <ImageIcon size={16} />
                <span>Imagen PNG</span>
                <small>Alta resolución</small>
              </button>
              {selected.length > 0 ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleExport('selection')}
                >
                  <ImageIcon size={16} />
                  <span>Solo la selección</span>
                  <small>{selected.length} elementos</small>
                </button>
              ) : null}
              <button type="button" role="menuitem" onClick={() => handleExport('copy')}>
                <Copy size={16} />
                <span>Copiar PNG</span>
                <small>Al portapapeles</small>
              </button>
              <button type="button" role="menuitem" onClick={() => handleExport('json')}>
                <FileJson size={16} />
                <span>Archivo tiza</span>
                <small>Editable</small>
              </button>
              <button type="button" role="menuitem" onClick={() => handleExport('pdf')}>
                <FileText size={16} />
                <span>PDF por marcos</span>
                <small>Una página por marco</small>
              </button>
              <button type="button" role="menuitem" onClick={() => handleExport('svg')}>
                <FileCode2 size={16} />
                <span>SVG vectorial</span>
                <small>Escalable</small>
              </button>
              <button type="button" role="menuitem" onClick={() => handleExport('markdown')}>
                <FileDown size={16} />
                <span>Markdown estructurado</span>
                <small>Notas, tablas y código</small>
              </button>
              <div className="menu-separator" />
              <div className="menu-label">Workspace</div>
              <button type="button" role="menuitem" onClick={() => handleExport('workspace')}>
                <Download size={16} />
                <span>Backup total</span>
                <small>Archivo .tiza</small>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setExportOpen(false);
                  workspaceInputRef.current?.click();
                }}
              >
                <Upload size={16} />
                <span>Importar workspace</span>
                <small>Abre un .tiza</small>
              </button>
              <div className="menu-label">Importar desde</div>
              {(
                [
                  ['excalidraw', 'Excalidraw', '.excalidraw,.json'],
                  ['jam', 'JAM / Jamboard', '.jam,.json'],
                  ['mermaid', 'Mermaid', '.mmd,.mermaid,.txt'],
                ] as const satisfies ReadonlyArray<readonly [ImportFormat, string, string]>
              ).map(([format, label, accept]) => (
                <button
                  key={format}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setExportOpen(false);
                    importFormatRef.current = format;
                    const input = importInputRef.current;
                    if (input) {
                      input.accept = accept;
                      input.click();
                    }
                  }}
                >
                  <FileUp size={16} />
                  <span>{label}</span>
                </button>
              ))}
              <div className="menu-separator" />
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  const ok = await copyToClipboard(window.location.href);
                  setExportOpen(false);
                  showToast(
                    ok ? 'Enlace copiado al portapapeles.' : 'No se pudo copiar el enlace.',
                    ok ? 'success' : 'error',
                  );
                }}
              >
                <Copy size={16} />
                <span>Copiar enlace</span>
              </button>
            </div>
          ) : null}
        </div>
        <div className="menu-wrap more-wrap" ref={moreRef}>
          <button
            type="button"
            className={`icon-btn ${moreOpen ? 'is-active' : ''}`}
            onClick={() => setMoreOpen((open) => !open)}
            aria-label="Más opciones"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal size={18} />
          </button>
          {moreOpen ? (
            <div className="menu menu-wide" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  titleRef.current?.focus();
                  titleRef.current?.select();
                }}
              >
                <Sparkles size={16} />
                <span>Renombrar tablero</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  duplicateBoard(board.id);
                }}
              >
                <Copy size={16} />
                <span>Duplicar tablero</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  const current = useLienzo.getState();
                  if (current.selected.length === 0) {
                    showToast('Selecciona elementos para guardar una pieza.', 'info');
                    return;
                  }
                  const pieceName = window.prompt('Nombre de la pieza', 'Pieza sin nombre');
                  if (pieceName === null) return;
                  savePiece(pieceName);
                }}
              >
                <Boxes size={16} />
                <span>Guardar selección como pieza</span>
                <small>{selected.length > 0 ? `${selected.length} elementos` : 'Sin selección'}</small>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  void handleFlatten();
                }}
              >
                <Combine size={16} />
                <span>Aplanar selección</span>
                <small>Convierte en imagen</small>
              </button>
              {pieces.length > 0 ? (
                <>
                  <div className="menu-label">Piezas guardadas</div>
                  {pieces.slice(0, 6).map((piece) => (
                    <div className="piece-row" key={piece.id}>
                      <button
                        type="button"
                        role="menuitem"
                        className="piece-insert"
                        onClick={() => {
                          setMoreOpen(false);
                          insertPiece(piece.id);
                        }}
                      >
                        <Boxes size={15} />
                        <span>{piece.name}</span>
                        <small>{piece.items.length} elem.</small>
                      </button>
                      <button
                        type="button"
                        className="piece-delete"
                        aria-label={`Eliminar pieza ${piece.name}`}
                        onClick={() => deletePiece(piece.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  toggleFavorite(board.id);
                  setMoreOpen(false);
                }}
              >
                <Star size={16} />
                <span>{board.favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  setUi('search', true);
                }}
              >
                <Search size={16} />
                <span>Buscar en la pizarra</span>
                <kbd>Ctrl F</kbd>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  setUi('history', true);
                }}
              >
                <History size={16} />
                <span>Historial de versiones</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  openTimer();
                }}
              >
                <TimerReset size={16} />
                <span>Temporizador de foco</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  toggleBoardLock();
                }}
              >
                {board.locked ? <Unlock size={16} /> : <Lock size={16} />}
                <span>{board.locked ? 'Desbloquear pizarra' : 'Bloquear pizarra'}</span>
              </button>
              <div className="menu-separator mobile-menu-only" />
              <button
                type="button"
                role="menuitem"
                className="mobile-menu-only"
                onClick={() => {
                  setMoreOpen(false);
                  toggleTheme();
                }}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                <span>{theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="mobile-menu-only"
                onClick={() => {
                  setMoreOpen(false);
                  toggleZen();
                }}
              >
                {zen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                <span>{zen ? 'Salir de concentración' : 'Modo concentración'}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="mobile-menu-only"
                onClick={() => {
                  setMoreOpen(false);
                  setUi('options', true);
                }}
              >
                <Settings size={16} />
                <span>Opciones y actualizaciones</span>
              </button>
              <div className="menu-separator" />
              <div className="menu-label">Fondo del lienzo</div>
              <div className="background-row">
                <button
                  type="button"
                  className={board.background === 'dots' ? 'is-active' : ''}
                  onClick={() => setBackground('dots')}
                  title="Puntos"
                >
                  <CircleDot size={15} /> Puntos
                </button>
                <button
                  type="button"
                  className={board.background === 'grid' ? 'is-active' : ''}
                  onClick={() => setBackground('grid')}
                  title="Cuadrícula"
                >
                  <Grid3X3 size={15} /> Cuadrícula
                </button>
                <button
                  type="button"
                  className={board.background === 'plain' ? 'is-active' : ''}
                  onClick={() => setBackground('plain')}
                  title="Liso"
                >
                  <SquareIcon /> Liso
                </button>
              </div>
              <div className="menu-label">Tamaño de cuadrícula</div>
              <div className="grid-size-row">
                {[16, 24, 32, 48].map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={gridSize === size ? 'is-active' : ''}
                    onClick={() => setGridSize(size)}
                    title={`Cuadrícula de ${size} px`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <div className="menu-separator" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  setUi('shortcuts', true);
                }}
              >
                <Keyboard size={16} />
                <span>Atajos de teclado</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  setUi('about', true);
                }}
              >
                <Info size={16} />
                <span>Acerca de tiza</span>
              </button>
              <div className="menu-separator" />
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={() => {
                  setMoreOpen(false);
                  if (
                    window.confirm(
                      `¿Eliminar «${board.name}»? Esta acción no se puede deshacer.`,
                    )
                  ) {
                    deleteBoard(board.id);
                  }
                }}
              >
                <Trash2 size={16} />
                <span>Eliminar tablero</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <input
        ref={workspaceInputRef}
        type="file"
        accept=".tiza,.json,application/json"
        className="visually-hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          try {
            const boards = parseWorkspaceFile(await file.text());
            useLienzo.getState().importWorkspace(boards);
          } catch (error) {
            showToast(
              error instanceof Error ? error.message : 'No se pudo importar el workspace.',
              'error',
            );
          }
        }}
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".excalidraw,.json,.jam,.mmd,.mermaid,.txt"
        className="visually-hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          await handleImportFile(file);
        }}
      />
    </header>
  );
}

function SquareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="1.5" y="1.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
