import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Boxes,
  ClipboardCopy,
  Command,
  Download,
  FileJson,
  Frame,
  Image as ImageIcon,
  Keyboard,
  LayoutGrid,
  Magnet,
  Maximize2,
  Moon,
  MousePointer2,
  PenLine,
  Play,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
  StickyNote,
  Sun,
  Type,
  Ungroup,
  Zap,
} from 'lucide-react';
import type { TemplateId } from '../types';
import { currentBoardOf, useLienzo } from '../store/boardStore';
import { DEFAULT_BOARD_NAME } from '../lib/templates';
import { Modal } from './Modal';
import { TemplatePicker } from './TemplatePicker';
import { Logo } from './Logo';
import { copyBoardPNG, exportBoardJSON, exportBoardPNG } from '../lib/export';
import { useUpdates } from '../store/updateStore';

export function NewBoardDialog() {
  const open = useLienzo((state) => state.ui.newBoard);
  const setUi = useLienzo((state) => state.setUi);
  const createBoard = useLienzo((state) => state.createBoard);
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  if (!open) return null;

  const choose = (template: TemplateId) => {
    createBoard(template, name.trim() || DEFAULT_BOARD_NAME[template]);
    setUi('newBoard', false);
  };

  return (
    <Modal
      title="Nuevo tablero"
      eyebrow="Empieza a pensar"
      subtitle="Elige un punto de partida. Podrás cambiarlo todo después."
      onClose={() => setUi('newBoard', false)}
      size="xl"
    >
      <label className="name-field">
        <span>Nombre del tablero</span>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Mi próximo gran plan…"
          onKeyDown={(event) => {
            if (event.key === 'Enter') choose('blank');
          }}
        />
      </label>
      <TemplatePicker mode="new" onSelect={choose} />
    </Modal>
  );
}

export function TemplateDialog() {
  const open = useLienzo((state) => state.ui.templates);
  const board = useLienzo((state) => currentBoardOf(state));
  const setUi = useLienzo((state) => state.setUi);
  const applyTemplate = useLienzo((state) => state.applyTemplate);

  if (!open || !board) return null;

  return (
    <Modal
      title="Añadir una plantilla"
      eyebrow="Atajos para empezar"
      subtitle="Se insertará al lado de tu contenido actual, sin tocar lo que ya existe."
      onClose={() => setUi('templates', false)}
      size="xl"
    >
      <TemplatePicker
        mode="insert"
        hideBlank
        onSelect={(template) => {
          applyTemplate(template);
          setUi('templates', false);
        }}
      />
    </Modal>
  );
}

const SHORTCUT_GROUPS: Array<{
  title: string;
  items: Array<{ keys: string[]; label: string }>;
}> = [
  {
    title: 'Herramientas',
    items: [
      { keys: ['V'], label: 'Seleccionar' },
      { keys: ['H'], label: 'Mover el lienzo' },
      { keys: ['N'], label: 'Nota adhesiva' },
      { keys: ['T'], label: 'Texto' },
      { keys: ['R'], label: 'Rectángulo' },
      { keys: ['O'], label: 'Elipse' },
      { keys: ['D'], label: 'Rombo' },
      { keys: ['C'], label: 'Conector' },
      { keys: ['P'], label: 'Dibujar' },
      { keys: ['L'], label: 'Resaltador' },
      { keys: ['K'], label: 'Puntero láser' },
      { keys: ['F'], label: 'Marco' },
      { keys: ['M'], label: 'Comentario' },
      { keys: ['I'], label: 'Insertar imagen' },
      { keys: ['E'], label: 'Borrar' },
    ],
  },
  {
    title: 'Edición',
    items: [
      { keys: ['⌘', 'Z'], label: 'Deshacer' },
      { keys: ['⇧', '⌘', 'Z'], label: 'Rehacer' },
      { keys: ['⌘', 'D'], label: 'Duplicar selección' },
      { keys: ['⌘', 'A'], label: 'Seleccionar todo' },
      { keys: ['⌘', 'G'], label: 'Agrupar selección' },
      { keys: ['⇧', '⌘', 'G'], label: 'Desagrupar selección' },
      { keys: ['G'], label: 'Activar o desactivar ajuste a cuadrícula' },
      { keys: ['Supr'], label: 'Eliminar selección' },
      { keys: ['Enter'], label: 'Editar texto seleccionado' },
      { keys: ['Doble clic'], label: 'Editar o crear una nota' },
    ],
  },
  {
    title: 'Navegación',
    items: [
      { keys: ['Espacio'], label: 'Mover el lienzo' },
      { keys: ['⌘', '+'], label: 'Acercar' },
      { keys: ['⌘', '−'], label: 'Alejar' },
      { keys: ['⇧', '1'], label: 'Ajustar a todo' },
      { keys: ['⌘', '0'], label: 'Zoom 100 %' },
      { keys: ['⌘', 'K'], label: 'Abrir paleta de comandos' },
      { keys: ['?'], label: 'Ver estos atajos' },
      { keys: ['Esc'], label: 'Cerrar / salir de presentación' },
    ],
  },
];

export function ShortcutsDialog() {
  const open = useLienzo((state) => state.ui.shortcuts);
  const setUi = useLienzo((state) => state.setUi);
  if (!open) return null;
  return (
    <Modal
      title="Atajos de teclado"
      eyebrow="Piensa con las manos"
      subtitle="Todo lo importante, a una tecla de distancia."
      onClose={() => setUi('shortcuts', false)}
      size="lg"
    >
      <div className="shortcut-groups">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            <ul>
              {group.items.map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <span className="shortcut-keys">
                    {item.keys.map((key) => (
                      <kbd key={`${item.label}-${key}`}>{key}</kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}

export function AboutDialog() {
  const open = useLienzo((state) => state.ui.about);
  const setUi = useLienzo((state) => state.setUi);
  const version = useUpdates((state) => state.current) || __APP_VERSION__;
  if (!open) return null;
  return (
    <Modal
      title="Acerca de Lienzo"
      eyebrow="Un espacio visual, tuyo"
      onClose={() => setUi('about', false)}
      size="md"
    >
      <div className="about-hero">
        <Logo size={52} />
        <div>
          <h3>Piensa sin bordes. Alpha.</h3>
          <p>
            Lienzo es una pizarra visual local-first inspirada en la colaboración de Miro, pero
            diseñada para funcionar sin cuentas, sin nube y sin depender de un servicio externo.
            Esta es una versión alpha: úsala, pruébala y cuéntanos qué se rompe.
          </p>
        </div>
      </div>
      <div className="about-grid">
        <div>
          <h4>Web local</h4>
          <p>Un servidor ligero sirve la app y la sala de colaboración en tu red.</p>
        </div>
        <div>
          <h4>Escritorio</h4>
          <p>La misma experiencia dentro de Electron, con el servidor de sala integrado.</p>
        </div>
        <div>
          <h4>Móvil</h4>
          <p>PWA instalable y envoltorio Capacitor para Android e iOS.</p>
        </div>
      </div>
      <div className="about-chips">
        <span>React 19</span>
        <span>TypeScript</span>
        <span>Canvas 2D</span>
        <span>IndexedDB</span>
        <span>WebSocket</span>
        <span>Electron</span>
        <span>Capacitor</span>
      </div>
      <p className="about-footnote">
        Tus tableros se guardan en este dispositivo. La sala en vivo solo comparte datos por tu
        red local. Versión {version} · canal estable.
      </p>
    </Modal>
  );
}

interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  group: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useLienzo((state) => state.ui.command);
  const setUi = useLienzo((state) => state.setUi);
  const boards = useLienzo((state) => state.boards);
  const board = useLienzo((state) => currentBoardOf(state));
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  if (!open) return null;

  const close = () => setUi('command', false);
  const actions: CommandAction[] = [
    {
      id: 'new',
      label: 'Crear un tablero nuevo',
      hint: 'Elige una plantilla',
      icon: <Plus size={17} />,
      group: 'Crear',
      run: () => {
        close();
        setUi('newBoard', true);
      },
    },
    {
      id: 'dashboard',
      label: 'Ir a mis tableros',
      icon: <LayoutGrid size={17} />,
      group: 'Navegar',
      run: () => {
        close();
        useLienzo.getState().closeBoard();
      },
    },
    ...boards.slice(0, 8).map<CommandAction>((candidate) => ({
      id: `board-${candidate.id}`,
      label: candidate.name,
      hint: `${candidate.items.length} elementos`,
      icon: <Frame size={17} />,
      group: 'Tableros',
      run: () => {
        close();
        useLienzo.getState().openBoard(candidate.id);
      },
    })),
  ];
  if (board) {
    actions.push(
      {
        id: 'share',
        label: 'Compartir y colaborar',
        hint: 'Sala local + QR',
        icon: <Share2 size={17} />,
        group: 'Tablero',
        run: () => {
          close();
          setUi('share', true);
        },
      },
      {
        id: 'present',
        label: 'Presentar el tablero',
        icon: <Play size={17} />,
        group: 'Tablero',
        run: () => {
          close();
          useLienzo.getState().startPresentation();
        },
      },
      {
        id: 'theme',
        label:
          useLienzo.getState().theme === 'dark'
            ? 'Cambiar a tema claro'
            : 'Cambiar a tema oscuro',
        hint: 'Interfaz y lienzo',
        icon: useLienzo.getState().theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />,
        group: 'Apariencia',
        run: () => {
          close();
          useLienzo.getState().toggleTheme();
        },
      },
      {
        id: 'zen',
        label: useLienzo.getState().zen
          ? 'Salir del modo concentración'
          : 'Entrar en modo concentración',
        hint: 'Oculta los paneles',
        icon: <Maximize2 size={17} />,
        group: 'Apariencia',
        run: () => {
          close();
          useLienzo.getState().toggleZen();
        },
      },
      {
        id: 'laser',
        label: 'Activar puntero láser',
        hint: 'Se desvanece al dibujar',
        icon: <Zap size={17} />,
        group: 'Herramientas',
        run: () => {
          close();
          useLienzo.getState().setTool('laser');
        },
      },
      {
        id: 'snap',
        label: useLienzo.getState().snapToGrid
          ? 'Desactivar ajuste a cuadrícula'
          : 'Activar ajuste a cuadrícula',
        icon: <Magnet size={17} />,
        group: 'Herramientas',
        run: () => {
          close();
          const store = useLienzo.getState();
          store.setSnapToGrid(!store.snapToGrid);
        },
      },
      {
        id: 'group',
        label: 'Agrupar la selección',
        icon: <Boxes size={17} />,
        group: 'Selección',
        run: () => {
          close();
          useLienzo.getState().groupSelected();
        },
      },
      {
        id: 'ungroup',
        label: 'Desagrupar la selección',
        icon: <Ungroup size={17} />,
        group: 'Selección',
        run: () => {
          close();
          useLienzo.getState().ungroupSelected();
        },
      },
      {
        id: 'copy-png',
        label: 'Copiar el tablero como PNG',
        hint: 'Al portapapeles',
        icon: <ClipboardCopy size={17} />,
        group: 'Tablero',
        run: async () => {
          close();
          const store = useLienzo.getState();
          try {
            await copyBoardPNG(board, {
              selected: store.selected.length > 0 ? store.selected : undefined,
              theme: store.theme,
            });
            store.showToast('PNG copiado al portapapeles.', 'success');
          } catch (error) {
            store.showToast(
              error instanceof Error ? error.message : 'No se pudo copiar la imagen.',
              'error',
            );
          }
        },
      },
      {
        id: 'png',
        label: 'Exportar como PNG',
        icon: <ImageIcon size={17} />,
        group: 'Tablero',
        run: async () => {
          close();
          await exportBoardPNG(board, { theme: useLienzo.getState().theme });
        },
      },
      {
        id: 'json',
        label: 'Exportar como archivo Lienzo',
        icon: <FileJson size={17} />,
        group: 'Tablero',
        run: () => {
          close();
          exportBoardJSON(board);
        },
      },
      {
        id: 'shortcuts',
        label: 'Ver atajos de teclado',
        icon: <Keyboard size={17} />,
        group: 'Ayuda',
        run: () => {
          close();
          setUi('shortcuts', true);
        },
      },
      {
        id: 'options',
        label: 'Opciones y actualizaciones',
        hint: 'Apariencia y versión',
        icon: <Settings size={17} />,
        group: 'Ajustes',
        run: () => {
          close();
          setUi('options', true);
        },
      },
      {
        id: 'about',
        label: 'Acerca de Lienzo',
        icon: <Sparkles size={17} />,
        group: 'Ayuda',
        run: () => {
          close();
          setUi('about', true);
        },
      },
    );
  }

  const normalized = query.trim().toLowerCase();
  const filtered = actions.filter((action) =>
    `${action.label} ${action.hint ?? ''} ${action.group}`.toLowerCase().includes(normalized),
  );
  const groups = [...new Set(filtered.map((action) => action.group))];
  let flatIndex = -1;

  return (
    <div className="command-backdrop" onPointerDown={(event) => event.target === event.currentTarget && close()}>
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
        <div className="command-search">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            placeholder="Busca un comando, un tablero o una acción…"
            aria-label="Buscar comandos"
            onKeyDown={(event) => {
              if (event.key === 'Escape') close();
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((value) => Math.min(filtered.length - 1, value + 1));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((value) => Math.max(0, value - 1));
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                filtered[active]?.run();
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-results">
          {filtered.length === 0 ? (
            <div className="command-empty">No hay resultados para «{query}».</div>
          ) : (
            groups.map((group) => (
              <div key={group} className="command-group">
                <span className="command-group-label">{group}</span>
                {filtered
                  .filter((action) => action.group === group)
                  .map((action) => {
                    flatIndex += 1;
                    const index = flatIndex;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        className={`command-item ${active === index ? 'is-active' : ''}`}
                        onMouseEnter={() => setActive(index)}
                        onClick={action.run}
                      >
                        <span className="command-icon">{action.icon}</span>
                        <span>{action.label}</span>
                        {action.hint ? <small>{action.hint}</small> : null}
                        {active === index ? <ArrowUpRight size={14} /> : null}
                      </button>
                    );
                  })}
              </div>
            ))
          )}
        </div>
        <div className="command-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navegar
          </span>
          <span>
            <kbd>↵</kbd> abrir
          </span>
          <span>
            <Command size={12} /> Paleta de Lienzo
          </span>
        </div>
      </div>
    </div>
  );
}

void Download;
void MousePointer2;
void PenLine;
void StickyNote;
void Type;
