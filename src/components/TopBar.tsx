import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  CircleDot,
  Copy,
  Download,
  FileJson,
  Grid3X3,
  Image as ImageIcon,
  Info,
  Keyboard,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  MoreHorizontal,
  Play,
  Plus,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { Board } from '../types';
import { useLienzo } from '../store/boardStore';
import { copyBoardPNG, exportBoardJSON, exportBoardPNG, safeFileName } from '../lib/export';
import { copyToClipboard } from '../lib/net';
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

  const saveStatus = useLienzo((state) => state.saveStatus);
  const closeBoard = useLienzo((state) => state.closeBoard);
  const renameBoard = useLienzo((state) => state.renameBoard);
  const duplicateBoard = useLienzo((state) => state.duplicateBoard);
  const deleteBoard = useLienzo((state) => state.deleteBoard);
  const toggleFavorite = useLienzo((state) => state.toggleFavorite);
  const setBackground = useLienzo((state) => state.setBackground);
  const theme = useLienzo((state) => state.theme);
  const toggleTheme = useLienzo((state) => state.toggleTheme);
  const zen = useLienzo((state) => state.zen);
  const toggleZen = useLienzo((state) => state.toggleZen);
  const selected = useLienzo((state) => state.selected);
  const gridSize = useLienzo((state) => state.gridSize);
  const setGridSize = useLienzo((state) => state.setGridSize);
  const startPresentation = useLienzo((state) => state.startPresentation);
  const setUi = useLienzo((state) => state.setUi);
  const showToast = useLienzo((state) => state.showToast);

  useOutsideClose(exportRef, exportOpen, () => setExportOpen(false));
  useOutsideClose(moreRef, moreOpen, () => setMoreOpen(false));

  useEffect(() => {
    setName(board.name);
  }, [board.id, board.name]);

  const commitName = () => {
    const clean = name.trim();
    if (clean && clean !== board.name) renameBoard(board.id, clean);
    else setName(board.name);
  };

  const handleExport = async (kind: 'png' | 'json' | 'selection' | 'copy') => {
    setExportOpen(false);
    try {
      if (kind === 'json') {
        exportBoardJSON(board);
        showToast('Tablero exportado en JSON.', 'success');
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
          aria-label="Ir a Lienzo"
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
                <span>Archivo Lienzo</span>
                <small>Editable</small>
              </button>
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
                  toggleFavorite(board.id);
                  setMoreOpen(false);
                }}
              >
                <Star size={16} />
                <span>{board.favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}</span>
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
                <span>Acerca de Lienzo</span>
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
