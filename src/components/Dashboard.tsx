import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Download,
  FileJson,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  Users,
  Wifi,
} from 'lucide-react';
import type { Board, TemplateId } from '../types';
import { getBoardStats, useLienzo } from '../store/boardStore';
import { BoardPreview } from './BoardPreview';
import { Logo, initials } from './Logo';
import { createBoard, TEMPLATES, DEFAULT_BOARD_NAME } from '../lib/templates';
import { exportBoardJSON, exportBoardPNG } from '../lib/export';
import { hasPendingUpdate, useUpdates } from '../store/updateStore';

type Filter = 'all' | 'recent' | 'favorites' | 'trash' | `folder:${string}`;

const folderOfFilter = (filter: Filter): string | null =>
  filter.startsWith('folder:') ? filter.slice('folder:'.length) : null;

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

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

function BoardCard({ board, trashed = false }: { board: Board; trashed?: boolean }) {
  const openBoard = useLienzo((state) => state.openBoard);
  const renameBoard = useLienzo((state) => state.renameBoard);
  const duplicateBoard = useLienzo((state) => state.duplicateBoard);
  const deleteBoard = useLienzo((state) => state.deleteBoard);
  const restoreBoard = useLienzo((state) => state.restoreBoard);
  const purgeBoard = useLienzo((state) => state.purgeBoard);
  const moveBoardToFolder = useLienzo((state) => state.moveBoardToFolder);
  const folders = useLienzo((state) => state.folders);
  const toggleFavorite = useLienzo((state) => state.toggleFavorite);
  const showToast = useLienzo((state) => state.showToast);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(board.name);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutsideClose(menuRef, menuOpen, () => setMenuOpen(false));
  const stats = getBoardStats(board);

  useEffect(() => setName(board.name), [board.name]);

  const commitName = () => {
    const clean = name.trim();
    if (clean && clean !== board.name) renameBoard(board.id, clean);
    else setName(board.name);
    setRenaming(false);
  };

  const openCard = () => {
    if (trashed) {
      showToast('Restaura el tablero para poder abrirlo.', 'info');
      return;
    }
    openBoard(board.id);
  };

  return (
    <article className={`board-card ${trashed ? 'is-trashed' : ''}`}>
      <div
        className="board-card-preview"
        role={trashed ? undefined : 'button'}
        tabIndex={trashed ? -1 : 0}
        onClick={openCard}
        onKeyDown={(event) => {
          if (!trashed && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            openBoard(board.id);
          }
        }}
        aria-label={trashed ? `${board.name}, en la papelera` : `Abrir ${board.name}`}
      >
        <BoardPreview board={board} padding={24} />
        <span className={`board-card-open-hint ${trashed ? 'is-trash' : ''}`}>
          {trashed ? (
            <>
              <Trash2 size={13} /> En papelera
            </>
          ) : (
            <>
              Abrir <ArrowUpRight size={13} />
            </>
          )}
        </span>
      </div>
      {!trashed ? (
        <button
          type="button"
          className={`card-star ${board.favorite ? 'is-active' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            toggleFavorite(board.id);
          }}
          aria-label={board.favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          title={board.favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        >
          <Star size={14} fill={board.favorite ? 'currentColor' : 'none'} />
        </button>
      ) : null}
      {!trashed ? (
        <div className="board-card-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="card-menu-btn"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Opciones del tablero"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen ? (
            <div className="menu card-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  openBoard(board.id);
                }}
              >
                <ArrowUpRight size={15} /> Abrir
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setRenaming(true);
                }}
              >
                <Plus size={15} /> Renombrar
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  duplicateBoard(board.id);
                }}
              >
                <LayoutGrid size={15} /> Duplicar
              </button>
              <div className="menu-separator" />
              <div className="menu-label">Mover a carpeta</div>
              <button
                type="button"
                role="menuitem"
                className={!board.folder ? 'is-selected' : ''}
                onClick={() => {
                  setMenuOpen(false);
                  moveBoardToFolder(board.id, null);
                }}
              >
                <Folder size={15} /> Sin carpeta
                {!board.folder ? <Check size={13} /> : null}
              </button>
              {folders.map((folder) => (
                <button
                  key={folder}
                  type="button"
                  role="menuitem"
                  className={board.folder === folder ? 'is-selected' : ''}
                  onClick={() => {
                    setMenuOpen(false);
                    moveBoardToFolder(board.id, folder);
                  }}
                >
                  <Folder size={15} /> {folder}
                  {board.folder === folder ? <Check size={13} /> : null}
                </button>
              ))}
              <div className="menu-separator" />
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  setMenuOpen(false);
                  await exportBoardPNG(board);
                  showToast('PNG exportado.', 'success');
                }}
              >
                <ImageIcon size={15} /> Exportar PNG
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  exportBoardJSON(board);
                  showToast('Archivo tiza exportado.', 'success');
                }}
              >
                <FileJson size={15} /> Exportar JSON
              </button>
              <div className="menu-separator" />
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={() => {
                  setMenuOpen(false);
                  if (window.confirm(`¿Mover «${board.name}» a la papelera?`)) {
                    deleteBoard(board.id);
                  }
                }}
              >
                <Trash2 size={15} /> Mover a la papelera
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="board-card-trash-actions">
          <button
            type="button"
            onClick={() => restoreBoard(board.id)}
            aria-label={`Restaurar ${board.name}`}
          >
            <RotateCcw size={14} /> Restaurar
          </button>
          <button
            type="button"
            className="is-danger"
            onClick={() => {
              if (window.confirm(`¿Eliminar «${board.name}» para siempre?`)) {
                purgeBoard(board.id);
              }
            }}
            aria-label={`Eliminar definitivamente ${board.name}`}
          >
            <Trash2 size={14} /> Borrar
          </button>
        </div>
      )}
      <div className="board-card-foot">
        {renaming && !trashed ? (
          <input
            className="board-rename-input"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                setName(board.name);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="board-card-name"
            onClick={openCard}
            disabled={trashed}
          >
            {board.name}
          </button>
        )}
        <p className="board-card-meta">
          {trashed
            ? `Eliminado el ${new Date(board.deletedAt ?? Date.now()).toLocaleDateString('es-ES')}`
            : `${stats.items} elementos · ${stats.updated}`}
          {!trashed && board.folder ? ` · ${board.folder}` : ''}
        </p>
      </div>
    </article>
  );
}

function DashTemplateCard({ templateId }: { templateId: TemplateId }) {
  const meta = TEMPLATES.find((template) => template.id === templateId);
  const create = useLienzo((state) => state.createBoard);
  const board = useMemo(
    () => createBoard(templateId, DEFAULT_BOARD_NAME[templateId]),
    [templateId],
  );
  if (!meta) return null;
  return (
    <button
      type="button"
      className="dash-template-card"
      onClick={() => create(templateId)}
    >
      <div className="dash-template-preview">
        <BoardPreview board={board} padding={18} />
      </div>
      <div>
        <strong>{meta.name}</strong>
        <span>{meta.tag}</span>
      </div>
    </button>
  );
}

export function Dashboard() {
  const boards = useLienzo((state) => state.boards);
  const userName = useLienzo((state) => state.userName);
  const setUserName = useLienzo((state) => state.setUserName);
  const setUi = useLienzo((state) => state.setUi);
  const selfColor = useLienzo((state) => state.collab.selfColor);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(userName);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState('');
  const folders = useLienzo((state) => state.folders);
  const createFolder = useLienzo((state) => state.createFolder);
  const renameFolder = useLienzo((state) => state.renameFolder);
  const deleteFolder = useLienzo((state) => state.deleteFolder);
  const restoreBoard = useLienzo((state) => state.restoreBoard);
  const emptyTrash = useLienzo((state) => state.emptyTrash);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const isDesktopApp = Boolean(window.lienzoDesktop?.isDesktop);
  const pendingUpdate = useUpdates(hasPendingUpdate);
  const currentVersion = useUpdates((state) => state.current) || __APP_VERSION__;

  useEffect(() => setNameDraft(userName), [userName]);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const activeBoards = useMemo(
    () => boards.filter((board) => !board.deletedAt),
    [boards],
  );
  const trashedBoards = useMemo(
    () =>
      boards
        .filter((board) => Boolean(board.deletedAt))
        .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
    [boards],
  );
  const sorted = useMemo(
    () => [...activeBoards].sort((a, b) => b.updatedAt - a.updatedAt),
    [activeBoards],
  );
  const recentBoard = sorted[0];
  const weekAgo = Date.now() - 1000 * 60 * 60 * 24 * 7;
  const activeFolder = folderOfFilter(filter);
  const filtered = (filter === 'trash' ? trashedBoards : sorted).filter((board) => {
    if (filter === 'favorites' && !board.favorite) return false;
    if (filter === 'recent' && board.updatedAt < weekAgo) return false;
    if (activeFolder && board.folder !== activeFolder) return false;
    if (query.trim() && !board.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  const storageBytes = useMemo(
    () => new Blob([JSON.stringify(boards)]).size,
    [boards],
  );
  const storageLabel =
    storageBytes > 1024 * 1024
      ? `${(storageBytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(storageBytes / 1024))} KB`;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  const navItems: Array<{ id: Filter | 'templates'; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'all', label: 'Todos los tableros', icon: <LayoutGrid size={17} />, count: activeBoards.length },
    { id: 'recent', label: 'Recientes', icon: <Clock3 size={17} /> },
    { id: 'favorites', label: 'Favoritos', icon: <Star size={17} />, count: activeBoards.filter((board) => board.favorite).length || undefined },
    { id: 'trash', label: 'Papelera', icon: <Trash2 size={17} />, count: trashedBoards.length || undefined },
    { id: 'templates', label: 'Plantillas', icon: <LayoutTemplate size={17} /> },
  ];

  const submitFolder = () => {
    const clean = folderDraft.trim();
    if (clean) {
      const created = createFolder(clean);
      if (created) setFilter(`folder:${created}` as Filter);
    }
    setFolderDraft('');
    setCreatingFolder(false);
  };

  const trashCount = trashedBoards.length;
  const isTrash = filter === 'trash';

  const saveName = () => {
    setUserName(nameDraft);
    setEditingName(false);
  };

  return (
    <div className="dashboard">
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <Logo size={32} withWord />
          <span className="dash-version" title="Versión instalada">
            v{currentVersion}
          </span>
          <button
            type="button"
            className={`icon-btn dash-options ${pendingUpdate ? 'has-update' : ''}`}
            onClick={() => setUi('options', true)}
            aria-label="Opciones y actualizaciones"
            title={
              pendingUpdate ? 'Hay una actualización disponible' : 'Opciones y actualizaciones'
            }
          >
            <Settings size={16} />
            {pendingUpdate ? <span className="update-dot" aria-hidden="true" /> : null}
          </button>
        </div>
        <nav className="dash-nav" aria-label="Navegación principal">
          <span className="nav-label">Espacio</span>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                item.id === 'templates'
                  ? 'nav-item'
                  : `nav-item ${filter === item.id ? 'is-active' : ''}`
              }
              onClick={() => {
                if (item.id === 'templates') setUi('newBoard', true);
                else setFilter(item.id);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.count ? <small>{item.count}</small> : null}
            </button>
          ))}
        </nav>
        <nav className="dash-nav dash-folders" aria-label="Carpetas">
          <span className="nav-label">Carpetas</span>
          {folders.map((folder) => (
            <button
              key={folder}
              type="button"
              className={`nav-item ${filter === `folder:${folder}` ? 'is-active' : ''}`}
              onClick={() => setFilter(`folder:${folder}`)}
            >
              <Folder size={17} />
              <span>{folder}</span>
              {activeBoards.filter((board) => board.folder === folder).length > 0 ? (
                <small>
                  {activeBoards.filter((board) => board.folder === folder).length}
                </small>
              ) : null}
            </button>
          ))}
          {creatingFolder ? (
            <input
              className="folder-name-input"
              autoFocus
              value={folderDraft}
              onChange={(event) => setFolderDraft(event.target.value)}
              onBlur={submitFolder}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  setFolderDraft('');
                  setCreatingFolder(false);
                }
              }}
              placeholder="Nombre de la carpeta"
              aria-label="Nombre de la carpeta"
            />
          ) : (
            <button
              type="button"
              className="nav-item nav-item-new"
              onClick={() => setCreatingFolder(true)}
            >
              <FolderPlus size={17} />
              <span>Nueva carpeta</span>
            </button>
          )}
        </nav>

        <div className="dash-new-wrap">
          <button type="button" className="btn btn-primary full-width" onClick={() => setUi('newBoard', true)}>
            <Plus size={16} /> Nuevo tablero
          </button>
        </div>

        <div className="dash-sidebar-spacer" />

        <div className="storage-card">
          <div className="storage-card-head">
            <ShieldCheck size={16} />
            <span>Local-first</span>
          </div>
          <p>Tus tableros viven en este dispositivo. Sin cuentas ni nube.</p>
          <div className="storage-meter">
            <span style={{ width: `${Math.min(100, Math.max(4, storageBytes / 50000))}%` }} />
          </div>
          <small>{storageLabel} · IndexedDB</small>
        </div>

        {installPrompt && !isDesktopApp ? (
          <button
            type="button"
            className="install-btn"
            onClick={async () => {
              await installPrompt.prompt();
              await installPrompt.userChoice;
              setInstallPrompt(null);
            }}
          >
            <Download size={15} />
            Instalar tiza
          </button>
        ) : null}

        <div className="dash-user">
          <span className="avatar avatar-lg" style={{ background: selfColor }}>
            {initials(userName)}
          </span>
          <div className="dash-user-info">
            {editingName ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={saveName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    setNameDraft(userName);
                    setEditingName(false);
                  }
                }}
                className="user-name-input"
                aria-label="Tu nombre"
              />
            ) : (
              <button type="button" onClick={() => setEditingName(true)} className="user-name">
                {userName}
              </button>
            )}
            <span>Cuenta local</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setEditingName(true)}
            aria-label="Editar nombre"
            title="Editar nombre"
          >
            <Check size={14} />
          </button>
        </div>
      </aside>

      <main className="dash-main">
        <header className="mobile-dash-head">
          <Logo size={28} withWord />
          <div>
            <button
              type="button"
              className={`icon-btn ${pendingUpdate ? 'has-update' : ''}`}
              onClick={() => setUi('options', true)}
              aria-label="Opciones y actualizaciones"
            >
              <Settings size={18} />
              {pendingUpdate ? <span className="update-dot" aria-hidden="true" /> : null}
            </button>
            <button type="button" className="icon-btn" onClick={() => setUi('newBoard', true)} aria-label="Nuevo tablero">
              <Plus size={18} />
            </button>
            <span className="avatar" style={{ background: selfColor }}>
              {initials(userName)}
            </span>
          </div>
        </header>

        <section className="dash-intro">
          <div>
            <span className="eyebrow">pizarras en vivo</span>
            <h1>
              {greeting}, <em>{userName}</em>.
            </h1>
            <p>
              Una pizarra para pensar, planear y compartir en vivo. Sin cuentas, sin fricción
              y con tus datos donde deben estar: contigo.
            </p>
          </div>
          <div className="dash-intro-actions">
            <label className="search-field">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar tableros…"
                aria-label="Buscar tableros"
              />
              <kbd>⌘K</kbd>
            </label>
            <button type="button" className="btn btn-primary" onClick={() => setUi('newBoard', true)}>
              <Plus size={16} /> Nuevo tablero
            </button>
          </div>
        </section>

        {recentBoard && !isTrash && !activeFolder ? (
          <section className="feature-card">
            <div className="feature-copy">
              <span className="feature-eyebrow">
                <Clock3 size={13} /> Continúa donde lo dejaste
              </span>
              <h2>{recentBoard.name}</h2>
              <p>
                {recentBoard.items.length} elementos · {getBoardStats(recentBoard).updated}
              </p>
              <div className="feature-actions">
                <button
                  type="button"
                  className="btn btn-lime"
                  onClick={() => useLienzo.getState().openBoard(recentBoard.id)}
                >
                  Abrir tablero <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => useLienzo.getState().toggleFavorite(recentBoard.id)}
                >
                  <Star size={15} fill={recentBoard.favorite ? 'currentColor' : 'none'} />
                  {recentBoard.favorite ? 'En favoritos' : 'Guardar'}
                </button>
              </div>
              <div className="feature-perks">
                <span><ShieldCheck size={14} /> 100 % local</span>
                <span><Wifi size={14} /> Colaboración LAN</span>
                <span><Users size={14} /> Sin registro</span>
              </div>
            </div>
            <div className="feature-art">
              <div className="feature-art-note">Tu pizarra, en cualquier pantalla</div>
              <div
                className="feature-art-board"
                role="button"
                tabIndex={0}
                onClick={() => useLienzo.getState().openBoard(recentBoard.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') useLienzo.getState().openBoard(recentBoard.id);
                }}
              >
                <BoardPreview board={recentBoard} padding={30} />
              </div>
              <span className="feature-sticker sticker-one">ideas</span>
              <span className="feature-sticker sticker-two">en equipo</span>
            </div>
          </section>
        ) : null}

        <section className="boards-section">
          <div className="section-head">
            <div>
              <h2>
                {isTrash
                  ? 'Papelera'
                  : filter === 'favorites'
                    ? 'Favoritos'
                    : filter === 'recent'
                      ? 'Recientes'
                      : activeFolder
                        ? activeFolder
                        : 'Tus tableros'}
              </h2>
              <span>
                {isTrash
                  ? `${filtered.length} tablero${filtered.length === 1 ? '' : 's'} en la papelera`
                  : `${filtered.length} en este espacio`}
              </span>
            </div>
            {isTrash ? (
              <div className="section-head-actions">
                {trashCount > 0 ? (
                  <>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => trashedBoards.forEach((board) => restoreBoard(board.id))}
                    >
                      <RotateCcw size={14} /> Restaurar todo
                    </button>
                    <button
                      type="button"
                      className="text-link is-danger"
                      onClick={() => {
                        if (window.confirm(`¿Vaciar la papelera (${trashCount} tableros)?`)) {
                          emptyTrash();
                        }
                      }}
                    >
                      <Trash2 size={14} /> Vaciar papelera
                    </button>
                  </>
                ) : null}
              </div>
            ) : activeFolder ? (
              <div className="section-head-actions">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    const next = window.prompt('Nuevo nombre de la carpeta', activeFolder);
                    if (next?.trim()) {
                      renameFolder(activeFolder, next);
                      setFilter(`folder:${next.trim()}`);
                    }
                  }}
                >
                  Renombrar carpeta
                </button>
                <button
                  type="button"
                  className="text-link is-danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        `¿Eliminar la carpeta «${activeFolder}»? Los tableros no se borran.`,
                      )
                    ) {
                      deleteFolder(activeFolder);
                      setFilter('all');
                    }
                  }}
                >
                  <Trash2 size={14} /> Eliminar carpeta
                </button>
            </div>
            ) : (
              <button type="button" className="text-link" onClick={() => setUi('newBoard', true)}>
                <Plus size={14} /> Crear tablero
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-boards">
              {isTrash ? <Trash2 size={28} /> : <LayoutGrid size={28} />}
              <h3>
                {query
                  ? 'No encontramos ese tablero'
                  : isTrash
                    ? 'La papelera está vacía'
                    : activeFolder
                      ? 'Esta carpeta está vacía'
                      : 'Aún no hay tableros aquí'}
              </h3>
              <p>
                {query
                  ? 'Prueba con otro nombre o limpia la búsqueda.'
                  : isTrash
                    ? 'Los tableros que muevas aquí podrás restaurarlos cuando quieras.'
                    : activeFolder
                      ? 'Mueve tableros a esta carpeta desde el menú de cada tarjeta.'
                      : 'Empieza con una plantilla o crea una pizarra en blanco.'}
              </p>
              {!isTrash ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => (query ? setQuery('') : setUi('newBoard', true))}
                >
                  {query ? 'Limpiar búsqueda' : activeFolder ? 'Nuevo tablero' : 'Crear mi primer tablero'}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="board-grid">
              {filtered.map((board) => (
                <BoardCard key={board.id} board={board} trashed={isTrash} />
              ))}
            </div>
          )}
        </section>

        {!isTrash ? (
        <section className="templates-section">
          <div className="section-head">
            <div>
              <h2>Empieza con una plantilla</h2>
              <span>Ideas probadas para no partir de cero</span>
            </div>
            <button type="button" className="text-link" onClick={() => setUi('newBoard', true)}>
              Ver todas <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="dash-template-grid">
            {(['brainstorm', 'retro', 'kanban', 'mindmap'] as TemplateId[]).map((template) => (
              <DashTemplateCard key={template} templateId={template} />
            ))}
          </div>
        </section>
        ) : null}

        <footer className="dash-footer">
          <span>
            <Logo size={17} /> tiza · pizarras en vivo
          </span>
          <span>Hecho para pensar en voz alta.</span>
        </footer>
      </main>
    </div>
  );
}
