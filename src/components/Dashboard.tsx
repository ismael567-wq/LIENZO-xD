import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Download,
  FileJson,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
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

type Filter = 'all' | 'recent' | 'favorites';

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

function BoardCard({ board }: { board: Board }) {
  const openBoard = useLienzo((state) => state.openBoard);
  const renameBoard = useLienzo((state) => state.renameBoard);
  const duplicateBoard = useLienzo((state) => state.duplicateBoard);
  const deleteBoard = useLienzo((state) => state.deleteBoard);
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

  return (
    <article className="board-card">
      <div
        className="board-card-preview"
        role="button"
        tabIndex={0}
        onClick={() => openBoard(board.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openBoard(board.id);
          }
        }}
        aria-label={`Abrir ${board.name}`}
      >
        <BoardPreview board={board} padding={24} />
        <span className="board-card-open-hint">
          Abrir <ArrowUpRight size={13} />
        </span>
      </div>
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
                if (window.confirm(`¿Eliminar «${board.name}»?`)) deleteBoard(board.id);
              }}
            >
              <Trash2 size={15} /> Eliminar
            </button>
          </div>
        ) : null}
      </div>
      <div className="board-card-foot">
        {renaming ? (
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
          <button type="button" className="board-card-name" onClick={() => openBoard(board.id)}>
            {board.name}
          </button>
        )}
        <p className="board-card-meta">
          {stats.items} elementos · {stats.updated}
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

  const sorted = useMemo(
    () => [...boards].sort((a, b) => b.updatedAt - a.updatedAt),
    [boards],
  );
  const recentBoard = sorted[0];
  const weekAgo = Date.now() - 1000 * 60 * 60 * 24 * 7;
  const filtered = sorted.filter((board) => {
    if (filter === 'favorites' && !board.favorite) return false;
    if (filter === 'recent' && board.updatedAt < weekAgo) return false;
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
    { id: 'all', label: 'Todos los tableros', icon: <LayoutGrid size={17} />, count: boards.length },
    { id: 'recent', label: 'Recientes', icon: <Clock3 size={17} /> },
    { id: 'favorites', label: 'Favoritos', icon: <Star size={17} />, count: boards.filter((board) => board.favorite).length || undefined },
    { id: 'templates', label: 'Plantillas', icon: <LayoutTemplate size={17} /> },
  ];

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

        {recentBoard ? (
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
                {filter === 'favorites'
                  ? 'Favoritos'
                  : filter === 'recent'
                    ? 'Recientes'
                    : 'Tus tableros'}
              </h2>
              <span>{filtered.length} en este espacio</span>
            </div>
            <button type="button" className="text-link" onClick={() => setUi('newBoard', true)}>
              <Plus size={14} /> Crear tablero
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-boards">
              <LayoutGrid size={28} />
              <h3>{query ? 'No encontramos ese tablero' : 'Aún no hay tableros aquí'}</h3>
              <p>
                {query
                  ? 'Prueba con otro nombre o limpia la búsqueda.'
                  : 'Empieza con una plantilla o crea una pizarra en blanco.'}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => (query ? setQuery('') : setUi('newBoard', true))}
              >
                {query ? 'Limpiar búsqueda' : 'Crear mi primer tablero'}
              </button>
            </div>
          ) : (
            <div className="board-grid">
              {filtered.map((board) => (
                <BoardCard key={board.id} board={board} />
              ))}
            </div>
          )}
        </section>

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
