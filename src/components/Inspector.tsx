import {
  ArrowUpRight,
  Boxes,
  Braces,
  Check,
  Circle,
  Copy,
  Diamond,
  Download,
  ExternalLink,
  FileText,
  Frame,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  Lock,
  MessageCircle,
  Palette,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  StickyNote,
  Table2,
  Timer,
  Trash2,
  Type,
  Ungroup,
  Unlock,
  X,
} from 'lucide-react';
import type { Board, BoardItem, ConnectorCap, ConnectorItem, FrameBackground } from '../types';
import { getBoardStats, useLienzo } from '../store/boardStore';
import {
  DRAW_COLORS,
  SHAPE_FILLS,
  SHAPE_STROKES,
  STICKY_COLORS,
} from '../lib/theme';
import { formatBytes } from '../lib/files';
import { downloadStoredFile, openStoredFile } from '../lib/files';
import { itemTypeLabel } from '../lib/geometry';
import { initials } from './Logo';

interface InspectorProps {
  board: Board;
  onClose: () => void;
  onImageReplace: () => void;
  onTemplates: () => void;
}

function typeIcon(item: BoardItem) {
  switch (item.type) {
    case 'sticky':
      return <StickyNote size={15} />;
    case 'text':
      return <Type size={15} />;
    case 'shape':
      return item.shape === 'ellipse' ? <Circle size={15} /> : item.shape === 'diamond' ? <Diamond size={15} /> : <Square size={15} />;
    case 'frame':
      return <Frame size={15} />;
    case 'connector':
      return <ArrowUpRight size={15} />;
    case 'draw':
      return <PenLine size={15} />;
    case 'image':
      return <ImageIcon size={15} />;
    case 'file':
      return <FileText size={15} />;
    case 'timer':
      return <Timer size={15} />;
    default:
      return <Layers size={15} />;
  }
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="inspector-section">
      <div className="inspector-section-head">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function ColorRow({
  colors,
  value,
  onChange,
}: {
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="swatch-row">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={`swatch ${value.toLowerCase() === color.toLowerCase() ? 'is-active' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
          aria-label={`Color ${color}`}
          title={color}
        />
      ))}
    </div>
  );
}

function StickyColorRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="swatch-row">
      {STICKY_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          className={`swatch swatch-sticky ${value === color.value ? 'is-active' : ''}`}
          style={{ background: color.value }}
          onClick={() => onChange(color.value)}
          aria-label={color.name}
          title={color.name}
        />
      ))}
    </div>
  );
}

function NumberField({
  label,
  value,
  onCommit,
  suffix,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  suffix?: string;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          key={value}
          type="number"
          defaultValue={Math.round(value)}
          onBlur={(event) => {
            const next = Number(event.currentTarget.value);
            if (Number.isFinite(next) && next !== Math.round(value)) onCommit(next);
            else event.currentTarget.value = String(Math.round(value));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        {suffix ? <small>{suffix}</small> : null}
      </div>
    </label>
  );
}

export function Inspector({ board, onClose, onImageReplace, onTemplates }: InspectorProps) {
  const selectedIds = useLienzo((state) => state.selected);
  const updateSelected = useLienzo((state) => state.updateSelected);
  const updateItem = useLienzo((state) => state.updateItem);
  const deleteSelected = useLienzo((state) => state.deleteSelected);
  const duplicateSelected = useLienzo((state) => state.duplicateSelected);
  const bringToFront = useLienzo((state) => state.bringToFront);
  const sendToBack = useLienzo((state) => state.sendToBack);
  const alignSelected = useLienzo((state) => state.alignSelected);
  const distributeSelected = useLienzo((state) => state.distributeSelected);
  const groupSelected = useLienzo((state) => state.groupSelected);
  const ungroupSelected = useLienzo((state) => state.ungroupSelected);
  const openTemplates = onTemplates;
  const setTool = useLienzo((state) => state.setTool);
  const toggleComment = useLienzo((state) => state.toggleComment);
  const deleteComment = useLienzo((state) => state.deleteComment);
  const focusRect = useLienzo((state) => state.focusRect);
  const showToast = useLienzo((state) => state.showToast);
  const peers = useLienzo((state) => state.collab.peers);
  const userName = useLienzo((state) => state.userName);
  const selfColor = useLienzo((state) => state.collab.selfColor);

  const selected = board.items.filter((item) => selectedIds.includes(item.id));
  const single = selected.length === 1 ? selected[0] : null;
  const stats = getBoardStats(board);
  const isConnector = single?.type === 'connector';
  const connector = isConnector ? (single as ConnectorItem) : null;
  const isSticky = single?.type === 'sticky';
  const isShape = single?.type === 'shape';
  const isText = single?.type === 'text';
  const isFrame = single?.type === 'frame';
  const isImage = single?.type === 'image';
  const isDraw = single?.type === 'draw';
  const isFile = single?.type === 'file';
  const isTimer = single?.type === 'timer';
  const isCode = single?.type === 'code';
  const isMarkdown = single?.type === 'markdown';
  const isTable = single?.type === 'table';
  const isSticker = single?.type === 'sticker';
  const isFlashcard = single?.type === 'flashcard';

  const commonFill =
    single && 'fill' in single && single.fill
      ? single.fill
      : selected.find((item) => 'fill' in item && item.type === 'shape')?.fill ?? '#FFFDF7';

  return (
    <aside className="inspector" aria-label="Propiedades">
      <div className="inspector-head">
        <div>
          {single ? (
            <>
              <span className="inspector-eyebrow">Propiedades</span>
              <h2 className="inspector-title">
                {typeIcon(single)}
                {itemTypeLabel(single.type)}
              </h2>
            </>
          ) : selected.length > 1 ? (
            <>
              <span className="inspector-eyebrow">Selección</span>
              <h2 className="inspector-title">
                <Layers size={15} /> {selected.length} elementos
              </h2>
            </>
          ) : (
            <>
              <span className="inspector-eyebrow">Este tablero</span>
              <h2 className="inspector-title">
                <Palette size={15} /> Pizarra
              </h2>
            </>
          )}
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar panel">
          <X size={16} />
        </button>
      </div>

      <div className="inspector-body">
        {single ? (
          <>
            <div className="inspector-actions">
              <button
                type="button"
                className="icon-btn"
                title={single.locked ? 'Desbloquear' : 'Bloquear'}
                onClick={() => updateItem(single.id, { locked: !single.locked })}
              >
                {single.locked ? <Lock size={16} /> : <Unlock size={16} />}
              </button>
              <button type="button" className="icon-btn" title="Duplicar" onClick={duplicateSelected}>
                <Copy size={16} />
              </button>
              <button type="button" className="icon-btn" title="Traer al frente" onClick={bringToFront}>
                <Layers size={16} />
              </button>
              <button type="button" className="icon-btn" title="Enviar al fondo" onClick={sendToBack}>
                <Layers size={16} className="flip-vertical" />
              </button>
              <button
                type="button"
                className="icon-btn is-danger"
                title="Eliminar"
                onClick={deleteSelected}
              >
                <Trash2 size={16} />
              </button>
            </div>

            {isSticky ? (
              <>
                <Section title="Color de la nota">
                  <StickyColorRow
                    value={single.fill}
                    onChange={(fill) => {
                      const color = STICKY_COLORS.find((entry) => entry.value === fill);
                      updateSelected({ fill, textColor: color?.text });
                    }}
                  />
                </Section>
                <Section title="Texto">
                  <div className="field-row">
                    <label className="select-field">
                      <span>Tamaño</span>
                      <select
                        value={single.fontSize}
                        onChange={(event) =>
                          updateSelected({ fontSize: Number(event.target.value) })
                        }
                      >
                        {[12, 14, 16, 18, 20, 24, 28].map((size) => (
                          <option key={size} value={size}>
                            {size} px
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="segmented" aria-label="Color de texto">
                      <button
                        type="button"
                        className="is-active"
                        style={{ color: single.textColor }}
                        onClick={() => updateSelected({ textColor: single.textColor })}
                      >
                        Tinta
                      </button>
                    </div>
                  </div>
                </Section>
              </>
            ) : null}

            {isShape ? (
              <>
                <Section title="Relleno">
                  <ColorRow
                    colors={SHAPE_FILLS}
                    value={single.fill}
                    onChange={(fill) => updateSelected({ fill })}
                  />
                  <div className="segmented segmented-wrap">
                    {(
                      [
                        ['solid', 'Sólido'],
                        ['hachure', 'Rayado'],
                        ['cross-hatch', 'Cruzado'],
                        ['dots', 'Puntos'],
                      ] as const
                    ).map(([style, label]) => (
                      <button
                        key={style}
                        type="button"
                        className={(single.fillStyle ?? 'solid') === style ? 'is-active' : ''}
                        onClick={() => updateSelected({ fillStyle: style })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Section>
                <Section title="Borde">
                  <ColorRow
                    colors={SHAPE_STROKES}
                    value={single.stroke}
                    onChange={(stroke) => updateSelected({ stroke })}
                  />
                  <div className="segmented segmented-wrap">
                    {(
                      [
                        ['solid', 'Sólido'],
                        ['dashed', 'Guiones'],
                        ['dotted', 'Puntos'],
                      ] as const
                    ).map(([style, label]) => (
                      <button
                        key={style}
                        type="button"
                        className={(single.strokeStyle ?? 'solid') === style ? 'is-active' : ''}
                        onClick={() => updateSelected({ strokeStyle: style })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="segmented">
                    <button
                      type="button"
                      className={(single.edge ?? 'round') === 'sharp' ? 'is-active' : ''}
                      onClick={() => updateSelected({ edge: 'sharp', radius: 0 })}
                    >
                      Esquinas vivas
                    </button>
                    <button
                      type="button"
                      className={(single.edge ?? 'round') === 'round' ? 'is-active' : ''}
                      onClick={() => updateSelected({ edge: 'round', radius: single.radius || 14 })}
                    >
                      Redondeadas
                    </button>
                  </div>
                  <div className="field-row">
                    <label className="range-field">
                      <span>Grosor</span>
                      <input
                        type="range"
                        min={0}
                        max={6}
                        step={0.5}
                        value={single.strokeWidth}
                        onChange={(event) =>
                          updateSelected({ strokeWidth: Number(event.target.value) })
                        }
                      />
                      <small>{single.strokeWidth} px</small>
                    </label>
                    <label className="range-field">
                      <span>Radio</span>
                      <input
                        type="range"
                        min={0}
                        max={48}
                        step={1}
                        value={single.radius}
                        onChange={(event) =>
                          updateSelected({ radius: Number(event.target.value) })
                        }
                      />
                      <small>{single.radius} px</small>
                    </label>
                  </div>
                </Section>
                <Section title="Texto">
                  <div className="field-row">
                    <label className="select-field">
                      <span>Tamaño</span>
                      <select
                        value={single.fontSize}
                        onChange={(event) =>
                          updateSelected({ fontSize: Number(event.target.value) })
                        }
                      >
                        {[12, 14, 16, 18, 20, 24, 28, 32].map((size) => (
                          <option key={size} value={size}>
                            {size} px
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </Section>
              </>
            ) : null}

            {isText ? (
              <>
                <Section title="Color">
                  <ColorRow
                    colors={DRAW_COLORS}
                    value={single.color}
                    onChange={(color) => updateSelected({ color })}
                  />
                </Section>
                <Section title="Tipografía">
                  <div className="field-row">
                    <label className="select-field">
                      <span>Tamaño</span>
                      <select
                        value={single.fontSize}
                        onChange={(event) =>
                          updateSelected({ fontSize: Number(event.target.value) })
                        }
                      >
                        {[14, 16, 18, 22, 26, 32, 40, 48, 64, 80].map((size) => (
                          <option key={size} value={size}>
                            {size} px
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="select-field">
                      <span>Peso</span>
                      <select
                        value={single.fontWeight}
                        onChange={(event) =>
                          updateSelected({
                            fontWeight: Number(event.target.value) as 400 | 500 | 600 | 700,
                          })
                        }
                      >
                        <option value={400}>Normal</option>
                        <option value={500}>Medio</option>
                        <option value={600}>Semibold</option>
                        <option value={700}>Bold</option>
                      </select>
                    </label>
                  </div>
                  <div className="segmented segmented-wrap">
                    <button
                      type="button"
                      className={(single.fontFamily ?? 'sans') === 'sans' ? 'is-active' : ''}
                      onClick={() => updateSelected({ fontFamily: 'sans' })}
                    >
                      Sans
                    </button>
                    <button
                      type="button"
                      className={single.fontFamily === 'serif' ? 'is-active' : ''}
                      onClick={() => updateSelected({ fontFamily: 'serif' })}
                    >
                      Serif
                    </button>
                    <button
                      type="button"
                      className={single.fontFamily === 'mono' ? 'is-active' : ''}
                      onClick={() => updateSelected({ fontFamily: 'mono' })}
                    >
                      Mono
                    </button>
                    <button
                      type="button"
                      className={single.italic ? 'is-active' : ''}
                      onClick={() => updateSelected({ italic: !single.italic })}
                    >
                      Cursiva
                    </button>
                  </div>
                  <div className="segmented">
                    <button
                      type="button"
                      className={single.align === 'left' ? 'is-active' : ''}
                      onClick={() => updateSelected({ align: 'left' })}
                    >
                      Izquierda
                    </button>
                    <button
                      type="button"
                      className={single.align === 'center' ? 'is-active' : ''}
                      onClick={() => updateSelected({ align: 'center' })}
                    >
                      Centro
                    </button>
                  </div>
                </Section>
              </>
            ) : null}

            {isFrame ? (
              <>
                <Section title="Título">
                  <input
                    className="text-input"
                    defaultValue={single.title}
                    key={single.id}
                    onBlur={(event) => {
                      const title = event.currentTarget.value.trim() || 'Marco';
                      if (title !== single.title) {
                        useLienzo.getState().pushHistory();
                        updateItem(single.id, { title });
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                  />
                </Section>
                <Section title="Fondo">
                  <ColorRow
                    colors={SHAPE_FILLS}
                    value={single.fill}
                    onChange={(fill) => updateSelected({ fill })}
                  />
                </Section>
                <Section title="Textura del marco">
                  <div className="segmented segmented-wrap">
                    {(
                      [
                        ['plain', 'Liso'],
                        ['dots', 'Puntos'],
                        ['grid', 'Cuadrícula'],
                        ['lines', 'Pauta'],
                        ['music', 'Pentagrama'],
                        ['axes', 'Ejes'],
                      ] as const satisfies ReadonlyArray<readonly [FrameBackground, string]>
                    ).map(([background, label]) => (
                      <button
                        key={background}
                        type="button"
                        className={(single.background ?? 'plain') === background ? 'is-active' : ''}
                        onClick={() => updateSelected({ background })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Section>
                <Section title="Presentación">
                  <div className="segmented segmented-wrap">
                    {(
                      [
                        ['blank', 'En blanco'],
                        ['title', 'Título'],
                        ['title-content', 'Título + contenido'],
                        ['two-columns', 'Dos columnas'],
                      ] as const
                    ).map(([layout, label]) => (
                      <button
                        key={layout}
                        type="button"
                        className={(single.layout ?? 'blank') === layout ? 'is-active' : ''}
                        onClick={() => updateSelected({ layout })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="toggle-row">
                    <button
                      type="button"
                      className={single.veiled ? 'is-active' : ''}
                      onClick={() => updateSelected({ veiled: !single.veiled })}
                    >
                      Ocultar con el velo
                    </button>
                  </div>
                </Section>
              </>
            ) : null}

            {isCode ? (
              <>
                <Section title="Código">
                  <label className="select-field">
                    <span>Lenguaje</span>
                    <select
                      value={single.language}
                      onChange={(event) => updateSelected({ language: event.target.value })}
                    >
                      {['ts', 'js', 'tsx', 'jsx', 'python', 'sql', 'bash', 'json', 'css', 'html', 'mermaid'].map(
                        (language) => (
                          <option key={language} value={language}>
                            {language}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="range-field">
                    <span>Tamaño</span>
                    <input
                      type="range"
                      min={10}
                      max={26}
                      step={1}
                      value={single.fontSize}
                      onChange={(event) => updateSelected({ fontSize: Number(event.target.value) })}
                    />
                    <small>{single.fontSize} px</small>
                  </label>
                  <button
                    type="button"
                    className="btn btn-soft full-width"
                    onClick={() => useLienzo.getState().startEditing(single.id)}
                  >
                    <Braces size={14} /> Editar código
                  </button>
                </Section>
              </>
            ) : null}

            {isMarkdown ? (
              <>
                <Section title="Markdown">
                  <label className="range-field">
                    <span>Tamaño</span>
                    <input
                      type="range"
                      min={10}
                      max={28}
                      step={1}
                      value={single.fontSize}
                      onChange={(event) => updateSelected({ fontSize: Number(event.target.value) })}
                    />
                    <small>{single.fontSize} px</small>
                  </label>
                  <button
                    type="button"
                    className="btn btn-soft full-width"
                    onClick={() => useLienzo.getState().startEditing(single.id)}
                  >
                    <FileText size={14} /> Editar Markdown
                  </button>
                  <p className="muted-copy">
                    Admite títulos, listas, tareas y citas. Se exporta como Markdown real.
                  </p>
                </Section>
              </>
            ) : null}

            {isTable ? (
              <>
                <Section title="Tabla">
                  <div className="segmented">
                    <button
                      type="button"
                      onClick={() =>
                        updateSelected({
                          rows: [
                            ...single.rows,
                            Array.from(
                              { length: Math.max(1, ...single.rows.map((row) => row.length)) },
                              () => '',
                            ),
                          ],
                        })
                      }
                    >
                      + Fila
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelected({ rows: single.rows.map((row) => [...row, '']) })}
                    >
                      + Columna
                    </button>
                  </div>
                  <div className="segmented">
                    <button
                      type="button"
                      className={single.header ? 'is-active' : ''}
                      onClick={() => updateSelected({ header: !single.header })}
                    >
                      Cabecera
                    </button>
                    <button
                      type="button"
                      onClick={() => useLienzo.getState().startEditing(single.id)}
                    >
                      <Table2 size={14} /> Editar celdas
                    </button>
                  </div>
                </Section>
              </>
            ) : null}

            {isSticker ? (
              <>
                <Section title="Sticker">
                  <div className="sticker-grid">
                    {['⭐', '✅', '❗', '💡', '🔥', '🎯', '📌', '❤️', '⚡', '🏆', '🧠', '👀'].map(
                      (symbol) => (
                        <button
                          key={symbol}
                          type="button"
                          className={single.symbol === symbol ? 'is-active' : ''}
                          onClick={() => updateSelected({ symbol })}
                        >
                          {symbol}
                        </button>
                      ),
                    )}
                  </div>
                  <input
                    className="text-input"
                    value={single.symbol}
                    maxLength={8}
                    onChange={(event) => updateSelected({ symbol: event.target.value })}
                    aria-label="Símbolo del sticker"
                  />
                </Section>
              </>
            ) : null}

            {isFlashcard ? (
              <>
                <Section title="Flashcard">
                  <label className="field-label">
                    <span>Pregunta</span>
                    <textarea
                      className="text-input"
                      rows={2}
                      value={single.front}
                      onChange={(event) => updateSelected({ front: event.target.value })}
                    />
                  </label>
                  <label className="field-label">
                    <span>Respuesta</span>
                    <textarea
                      className="text-input"
                      rows={2}
                      value={single.back}
                      onChange={(event) => updateSelected({ back: event.target.value })}
                    />
                  </label>
                  <div className="segmented">
                    <button
                      type="button"
                      className={single.flipped ? 'is-active' : ''}
                      onClick={() => useLienzo.getState().flipFlashcard(single.id)}
                    >
                      <GraduationCap size={14} /> Voltear
                    </button>
                    <button
                      type="button"
                      onClick={() => useLienzo.getState().startEditing(single.id)}
                    >
                      Editar tarjeta
                    </button>
                  </div>
                </Section>
              </>
            ) : null}

            {connector ? (
              <>
                <Section title="Línea">
                  <ColorRow
                    colors={DRAW_COLORS}
                    value={connector.color}
                    onChange={(color) => updateSelected({ color })}
                  />
                  <div className="segmented segmented-wrap">
                    {(
                      [
                        ['straight', 'Recta'],
                        ['elbow', 'Codo'],
                        ['curve', 'Curva'],
                      ] as const
                    ).map(([lineType, label]) => (
                      <button
                        key={lineType}
                        type="button"
                        className={(connector.lineType ?? 'straight') === lineType ? 'is-active' : ''}
                        onClick={() => updateSelected({ lineType })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="range-field">
                    <span>Grosor</span>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      step={0.5}
                      value={connector.strokeWidth}
                      onChange={(event) =>
                        updateSelected({ strokeWidth: Number(event.target.value) })
                      }
                    />
                    <small>{connector.strokeWidth} px</small>
                  </label>
                </Section>
                <Section title="Estilo">
                  <div className="toggle-row">
                    <button
                      type="button"
                      className={connector.dashed ? 'is-active' : ''}
                      onClick={() => updateSelected({ dashed: !connector.dashed })}
                    >
                      Discontinua
                    </button>
                    <button
                      type="button"
                      className={connector.arrowEnd ? 'is-active' : ''}
                      onClick={() => updateSelected({ arrowEnd: !connector.arrowEnd })}
                    >
                      Flecha final
                    </button>
                    <button
                      type="button"
                      className={connector.arrowStart ? 'is-active' : ''}
                      onClick={() => updateSelected({ arrowStart: !connector.arrowStart })}
                    >
                      Flecha inicio
                    </button>
                  </div>
                  <input
                    className="text-input"
                    placeholder="Etiqueta del conector"
                    defaultValue={connector.label}
                    key={connector.id}
                    onBlur={(event) => {
                      if (event.currentTarget.value !== connector.label) {
                        useLienzo.getState().pushHistory();
                        updateItem(connector.id, { label: event.currentTarget.value });
                      }
                    }}
                  />
                </Section>
                <Section title="Extremos">
                  <div className="field-row">
                    <label className="select-field">
                      <span>Inicio</span>
                      <select
                        value={connector.startCap ?? (connector.arrowStart ? 'arrow' : 'none')}
                        onChange={(event) =>
                          updateSelected({
                            startCap: event.target.value as ConnectorCap,
                            arrowStart: event.target.value === 'arrow',
                          })
                        }
                      >
                        <option value="none">Sin punta</option>
                        <option value="arrow">Flecha</option>
                        <option value="dot">Punto</option>
                        <option value="crowfoot">Crowfoot</option>
                        <option value="crowfoot-many">Crowfoot muchos</option>
                      </select>
                    </label>
                    <label className="select-field">
                      <span>Final</span>
                      <select
                        value={connector.endCap ?? (connector.arrowEnd ? 'arrow' : 'none')}
                        onChange={(event) =>
                          updateSelected({
                            endCap: event.target.value as ConnectorCap,
                            arrowEnd: event.target.value === 'arrow',
                          })
                        }
                      >
                        <option value="none">Sin punta</option>
                        <option value="arrow">Flecha</option>
                        <option value="dot">Punto</option>
                        <option value="crowfoot">Crowfoot</option>
                        <option value="crowfoot-many">Crowfoot muchos</option>
                      </select>
                    </label>
                  </div>
                </Section>
              </>
            ) : null}

            {isDraw ? (
              <>
                <Section title="Trazo">
                  <ColorRow
                    colors={DRAW_COLORS}
                    value={single.color}
                    onChange={(color) => updateSelected({ color })}
                  />
                  <label className="range-field">
                    <span>Grosor</span>
                    <input
                      type="range"
                      min={1}
                      max={40}
                      step={1}
                      value={single.strokeWidth}
                      onChange={(event) =>
                        updateSelected({ strokeWidth: Number(event.target.value) })
                      }
                    />
                    <small>{single.strokeWidth} px</small>
                  </label>
                  <div className="toggle-row">
                    <button
                      type="button"
                      className={single.chalk ? 'is-active' : ''}
                      onClick={() => updateSelected({ chalk: !single.chalk })}
                    >
                      Textura de tiza
                    </button>
                    <button
                      type="button"
                      className={single.highlighter ? 'is-active' : ''}
                      onClick={() => updateSelected({ highlighter: !single.highlighter })}
                    >
                      Resaltador
                    </button>
                  </div>
                </Section>
              </>
            ) : null}

            {isImage ? (
              <Section title="Imagen">
                <button type="button" className="btn btn-soft full-width" onClick={onImageReplace}>
                  <ImageIcon size={15} /> Reemplazar imagen
                </button>
                <label className="range-field">
                  <span>Esquinas</span>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={single.radius}
                    onChange={(event) => updateSelected({ radius: Number(event.target.value) })}
                  />
                  <small>{single.radius} px</small>
                </label>
              </Section>
            ) : null}

            {isFile ? (
              <Section title="Archivo">
                <p className="muted-copy">
                  <strong>{single.name}</strong>
                  <br />
                  {formatBytes(single.size)} · {single.mime || 'tipo desconocido'}
                  {single.pages ? ` · página ${single.page ?? 1}/${single.pages}` : ''}
                </p>
                <div className="segmented">
                  <button
                    type="button"
                    onClick={() => useLienzo.getState().openMedia(single.id)}
                  >
                    <Play size={14} /> Ver
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void openStoredFile(single.fileId).catch((error) =>
                        showToast(
                          error instanceof Error ? error.message : 'No se pudo abrir.',
                          'error',
                        ),
                      );
                    }}
                  >
                    <ExternalLink size={14} /> Abrir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void downloadStoredFile(single.fileId, single.name).catch((error) =>
                        showToast(
                          error instanceof Error ? error.message : 'No se pudo descargar.',
                          'error',
                        ),
                      );
                    }}
                  >
                    <Download size={14} /> Descargar
                  </button>
                </div>
                {single.pages && single.pages > 1 ? (
                  <div className="segmented">
                    <button
                      type="button"
                      onClick={() =>
                        updateItem(single.id, {
                          page: Math.max(1, (single.page ?? 1) - 1),
                        })
                      }
                    >
                      ← Página
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateItem(single.id, {
                          page: Math.min(single.pages ?? 1, (single.page ?? 1) + 1),
                        })
                      }
                    >
                      Página →
                    </button>
                  </div>
                ) : null}
              </Section>
            ) : null}

            {isTimer ? (
              <>
                <Section title="Temporizador">
                  <input
                    className="text-input"
                    defaultValue={single.label}
                    key={`${single.id}-label`}
                    onBlur={(event) => {
                      const label = event.currentTarget.value.trim() || 'Tiempo';
                      if (label !== single.label) updateItem(single.id, { label });
                    }}
                  />
                  <NumberField
                    label="Minutos"
                    value={Math.round(single.duration / 60)}
                    suffix="min"
                    onCommit={(value) => {
                      const minutes = Math.max(1, Math.min(180, Math.round(value)));
                      updateItem(single.id, {
                        duration: minutes * 60,
                        remaining: minutes * 60,
                        running: false,
                        endsAt: null,
                      });
                    }}
                  />
                  <div className="segmented">
                    <button
                      type="button"
                      onClick={() => {
                        const now = Date.now();
                        if (single.running) {
                          updateItem(single.id, {
                            running: false,
                            endsAt: null,
                            remaining: Math.max(
                              0,
                              Math.ceil(((single.endsAt ?? now) - now) / 1000),
                            ),
                          });
                        } else {
                          const remaining =
                            single.remaining > 0 ? single.remaining : single.duration;
                          updateItem(single.id, {
                            running: true,
                            endsAt: now + remaining * 1000,
                            remaining,
                          });
                        }
                      }}
                    >
                      {single.running ? <Pause size={14} /> : <Play size={14} />}
                      {single.running ? 'Pausar' : 'Iniciar'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateItem(single.id, {
                          running: false,
                          endsAt: null,
                          remaining: single.duration,
                        })
                      }
                    >
                      <RotateCcw size={14} /> Reiniciar
                    </button>
                  </div>
                  <div className="toggle-row">
                    <button
                      type="button"
                      className={single.sound ? 'is-active' : ''}
                      onClick={() => updateItem(single.id, { sound: !single.sound })}
                    >
                      Campana al terminar
                    </button>
                  </div>
                </Section>
              </>
            ) : null}

            <Section title="Portal y votos">
              <label className="select-field">
                <span>Enlazar con</span>
                <select
                  value={single.linkTo ?? ''}
                  onChange={(event) =>
                    useLienzo.getState().linkSelected(event.target.value || null)
                  }
                >
                  <option value="">Sin portal</option>
                  <optgroup label="Tableros">
                    {useLienzo
                      .getState()
                      .boards.filter((candidate) => candidate.id !== board.id)
                      .map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Marcos de este tablero">
                    {board.items
                      .filter((candidate) => candidate.type === 'frame' && candidate.id !== single.id)
                      .map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.type === 'frame' ? candidate.title : 'Marco'}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </label>
              <p className="muted-copy">
                Doble clic en el objeto para viajar al destino. Los portales también aparecen al
                pulsar <kbd>Ctrl K</kbd>.
              </p>
              <div className="vote-inspector">
                <span>
                  {(single as { votes?: string[] }).votes?.length
                    ? `${(single as { votes?: string[] }).votes?.length} voto(s) · ${(
                        single as { votes?: string[] }
                      ).votes?.join(', ')}`
                    : 'Sin votos todavía'}
                </span>
                <div className="segmented">
                  <button
                    type="button"
                    onClick={() => useLienzo.getState().addVote(single.id)}
                  >
                    Votar
                  </button>
                  <button
                    type="button"
                    onClick={() => useLienzo.getState().clearVotes(single.id)}
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </Section>

            <Section title="Posición y tamaño">
              <div className="number-grid">
                <NumberField
                  label="X"
                  value={single.type === 'connector' ? 0 : single.x}
                  onCommit={(value) => updateItem(single.id, { x: value })}
                />
                <NumberField
                  label="Y"
                  value={single.type === 'connector' ? 0 : single.y}
                  onCommit={(value) => updateItem(single.id, { y: value })}
                />
                {single.type !== 'connector' ? (
                  <>
                    <NumberField
                      label="An"
                      value={single.w}
                      onCommit={(value) => updateItem(single.id, { w: Math.max(24, value) })}
                    />
                    <NumberField
                      label="Al"
                      value={single.h}
                      onCommit={(value) => updateItem(single.id, { h: Math.max(24, value) })}
                    />
                  </>
                ) : null}
              </div>
            </Section>

            <Section title="Apariencia">
              <label className="range-field">
                <span>Opacidad</span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={Math.round((single.opacity ?? 1) * 100)}
                  onChange={(event) =>
                    updateItem(single.id, { opacity: Number(event.target.value) / 100 })
                  }
                />
                <small>{Math.round((single.opacity ?? 1) * 100)}%</small>
              </label>
            </Section>
          </>
        ) : selected.length > 1 ? (
          <>
            <Section title="Alinear">
              <div className="align-grid">
                <button type="button" onClick={() => alignSelected('left')}>Izquierda</button>
                <button type="button" onClick={() => alignSelected('center')}>Centro</button>
                <button type="button" onClick={() => alignSelected('right')}>Derecha</button>
                <button type="button" onClick={() => alignSelected('top')}>Arriba</button>
                <button type="button" onClick={() => alignSelected('middle')}>Medio</button>
                <button type="button" onClick={() => alignSelected('bottom')}>Abajo</button>
              </div>
              <div className="segmented">
                <button type="button" onClick={() => distributeSelected('x')}>
                  Distribuir horizontal
                </button>
                <button type="button" onClick={() => distributeSelected('y')}>
                  Distribuir vertical
                </button>
              </div>
            </Section>
            <Section title="Grupo">
              <div className="segmented">
                <button type="button" onClick={groupSelected}>
                  <Boxes size={14} /> Agrupar
                </button>
                <button type="button" onClick={ungroupSelected}>
                  <Ungroup size={14} /> Desagrupar
                </button>
              </div>
              <p className="muted-copy">
                Un grupo se selecciona, mueve y duplica como una sola unidad.
              </p>
            </Section>
            <Section title="Estilo rápido">
              <StickyColorRow
                value={commonFill}
                onChange={(fill) => {
                  const color = STICKY_COLORS.find((entry) => entry.value === fill);
                  updateSelected({ fill, textColor: color?.text });
                }}
              />
              <div className="inspector-actions">
                <button type="button" className="icon-btn" title="Duplicar" onClick={duplicateSelected}>
                  <Copy size={16} />
                </button>
                <button type="button" className="icon-btn" title="Traer al frente" onClick={bringToFront}>
                  <Layers size={16} />
                </button>
                <button type="button" className="icon-btn" title="Enviar al fondo" onClick={sendToBack}>
                  <Layers size={16} className="flip-vertical" />
                </button>
                <button type="button" className="icon-btn is-danger" title="Eliminar" onClick={deleteSelected}>
                  <Trash2 size={16} />
                </button>
              </div>
            </Section>
          </>
        ) : (
          <>
            <div className="board-stats">
              <div>
                <strong>{stats.items}</strong>
                <span>elementos</span>
              </div>
              <div>
                <strong>{stats.notes}</strong>
                <span>notas</span>
              </div>
              <div>
                <strong>{stats.connectors}</strong>
                <span>conectores</span>
              </div>
              <div>
                <strong>{stats.words}</strong>
                <span>palabras</span>
              </div>
            </div>

            <Section title="Fondo">
              <div className="segmented">
                <button
                  type="button"
                  className={board.background === 'dots' ? 'is-active' : ''}
                  onClick={() => useLienzo.getState().setBackground('dots')}
                >
                  Puntos
                </button>
                <button
                  type="button"
                  className={board.background === 'grid' ? 'is-active' : ''}
                  onClick={() => useLienzo.getState().setBackground('grid')}
                >
                  Cuadrícula
                </button>
                <button
                  type="button"
                  className={board.background === 'plain' ? 'is-active' : ''}
                  onClick={() => useLienzo.getState().setBackground('plain')}
                >
                  Liso
                </button>
              </div>
            </Section>

            <Section
              title={`Comentarios (${board.comments.length})`}
              action={
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setTool('comment');
                    onClose();
                    showToast('Haz clic en el lienzo para dejar un comentario.', 'info');
                  }}
                >
                  + Añadir
                </button>
              }
            >
              {board.comments.length === 0 ? (
                <p className="muted-copy">
                  Deja comentarios anclados a cualquier punto. Ideal para revisar sin interrumpir.
                </p>
              ) : (
                <ul className="comment-list">
                  {board.comments.map((comment, index) => (
                    <li key={comment.id} className={comment.resolved ? 'is-resolved' : ''}>
                      <button
                        type="button"
                        className="comment-pin-link"
                        onClick={() =>
                          focusRect({
                            x: comment.x - 320,
                            y: comment.y - 220,
                            w: 640,
                            h: 440,
                          })
                        }
                      >
                        {index + 1}
                      </button>
                      <div>
                        <p>{comment.text}</p>
                        <small>
                          {comment.author} ·{' '}
                          {new Date(comment.createdAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </small>
                      </div>
                      <div className="comment-actions">
                        {comment.audio ? (
                          <button
                            type="button"
                            title="Reproducir nota de voz"
                            onClick={() => {
                              void openStoredFile(comment.audio!.fileId).catch((error) =>
                                showToast(
                                  error instanceof Error
                                    ? error.message
                                    : 'No se pudo abrir la nota de voz.',
                                  'error',
                                ),
                              );
                            }}
                          >
                            <Play size={13} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title={comment.resolved ? 'Reabrir' : 'Resolver'}
                          onClick={() => toggleComment(comment.id)}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          title="Eliminar"
                          onClick={() => deleteComment(comment.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Plantillas">
              <button type="button" className="btn btn-soft full-width" onClick={openTemplates}>
                <Layers size={15} /> Añadir una plantilla
              </button>
            </Section>

            <Section title="En esta sala">
              <ul className="people-list">
                <li>
                  <span className="avatar" style={{ background: selfColor }}>
                    {initials(userName)}
                  </span>
                  <span>{userName}</span>
                  <small>Tú</small>
                </li>
                {peers.map((peer) => (
                  <li key={peer.id}>
                    <span className="avatar" style={{ background: peer.color }}>
                      {initials(peer.name)}
                    </span>
                    <span>{peer.name}</span>
                    <small>En línea</small>
                  </li>
                ))}
              </ul>
            </Section>

            <div className="local-note">
              <Check size={13} />
              Guardado en este dispositivo. Sin cuentas ni nube.
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
