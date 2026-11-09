import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  Circle,
  Diamond,
  Eraser,
  Frame,
  Hand,
  Highlighter,
  Image as ImageIcon,
  MessageCircle,
  MousePointer2,
  PenLine,
  Redo2,
  Square,
  StickyNote,
  Type,
  Undo2,
  MoreHorizontal,
  LayoutTemplate,
  Timer,
  Zap,
} from 'lucide-react';
import type { ShapeKind, Tool } from '../types';
import { useLienzo } from '../store/boardStore';

interface ToolbarProps {
  tool: Tool;
  shapeKind: ShapeKind;
  onTool: (tool: Tool) => void;
  onShapeKind: (kind: ShapeKind) => void;
  onImage: () => void;
  onTemplates: () => void;
  onTimer: () => void;
}

interface ToolButtonProps {
  active?: boolean;
  label: string;
  shortcut?: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

function ToolButton({
  active,
  label,
  shortcut,
  onClick,
  children,
  className = '',
}: ToolButtonProps) {
  return (
    <button
      type="button"
      className={`tool-btn ${active ? 'is-active' : ''} ${className}`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      data-tip={label}
    >
      {children}
      <span className="tool-tip" role="tooltip">
        {label}
        {shortcut ? <kbd>{shortcut}</kbd> : null}
      </span>
    </button>
  );
}

const SHAPE_OPTIONS: Array<{ kind: ShapeKind; label: string; icon: React.ReactNode }> = [
  { kind: 'rect', label: 'Rectángulo', icon: <Square size={18} /> },
  { kind: 'ellipse', label: 'Círculo', icon: <Circle size={18} /> },
  { kind: 'diamond', label: 'Rombo', icon: <Diamond size={18} /> },
];

export function Toolbar({
  tool,
  shapeKind,
  onTool,
  onShapeKind,
  onImage,
  onTemplates,
  onTimer,
}: ToolbarProps) {
  const [shapeOpen, setShapeOpen] = useState(false);
  const shapeRef = useRef<HTMLDivElement>(null);
  const undo = useLienzo((state) => state.undo);
  const redo = useLienzo((state) => state.redo);
  const canUndo = useLienzo((state) => state.past.length > 0);
  const canRedo = useLienzo((state) => state.future.length > 0);

  useEffect(() => {
    if (!shapeOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!shapeRef.current?.contains(event.target as Node)) setShapeOpen(false);
    };
    window.addEventListener('pointerdown', onClick);
    return () => window.removeEventListener('pointerdown', onClick);
  }, [shapeOpen]);

  const currentShape = SHAPE_OPTIONS.find((option) => option.kind === shapeKind);
  const ShapeIcon = currentShape?.icon ?? <Square size={18} />;

  return (
    <aside className="toolbar" aria-label="Herramientas del tablero">
      <ToolButton
        active={tool === 'select'}
        label="Seleccionar"
        shortcut="V"
        onClick={() => onTool('select')}
      >
        <MousePointer2 size={19} />
      </ToolButton>
      <ToolButton
        active={tool === 'hand'}
        label="Mover lienzo"
        shortcut="H"
        onClick={() => onTool('hand')}
      >
        <Hand size={19} />
      </ToolButton>
      <div className="tool-divider" />
      <ToolButton
        active={tool === 'sticky'}
        label="Nota adhesiva"
        shortcut="N"
        onClick={() => onTool('sticky')}
      >
        <StickyNote size={19} />
      </ToolButton>
      <ToolButton
        active={tool === 'text'}
        label="Texto"
        shortcut="T"
        onClick={() => onTool('text')}
      >
        <Type size={19} />
      </ToolButton>
      <div className="tool-shape" ref={shapeRef}>
        <button
          type="button"
          className={`tool-btn tool-btn-shape ${tool === 'shape' ? 'is-active' : ''}`}
          onClick={() => onTool('shape')}
          aria-label="Forma"
          aria-pressed={tool === 'shape'}
          data-tip="Forma"
        >
          <span className="shape-icon">{ShapeIcon}</span>
          <span className="tool-tip" role="tooltip">
            Forma <kbd>R</kbd>
          </span>
        </button>
        <button
          type="button"
          className="shape-caret"
          aria-label="Elegir tipo de forma"
          aria-expanded={shapeOpen}
          onClick={() => setShapeOpen((open) => !open)}
        >
          <ChevronDown size={10} />
        </button>
        {shapeOpen ? (
          <div className="shape-menu">
            {SHAPE_OPTIONS.map((option) => (
              <button
                key={option.kind}
                type="button"
                className={`shape-option ${shapeKind === option.kind ? 'is-active' : ''}`}
                onClick={() => {
                  onShapeKind(option.kind);
                  onTool('shape');
                  setShapeOpen(false);
                }}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <ToolButton
        active={tool === 'connector'}
        label="Conector"
        shortcut="C"
        onClick={() => onTool('connector')}
      >
        <ArrowUpRight size={19} />
      </ToolButton>
      <ToolButton
        active={tool === 'pen'}
        label="Dibujar"
        shortcut="P"
        onClick={() => onTool('pen')}
      >
        <PenLine size={19} />
      </ToolButton>
      <ToolButton
        active={tool === 'highlighter'}
        label="Resaltar"
        shortcut="L"
        onClick={() => onTool('highlighter')}
      >
        <Highlighter size={19} />
      </ToolButton>
      <ToolButton
        active={tool === 'laser'}
        label="Puntero láser"
        shortcut="K"
        onClick={() => onTool('laser')}
      >
        <Zap size={19} />
      </ToolButton>
      <div className="tool-divider" />
      <ToolButton label="Insertar imagen" shortcut="I" onClick={onImage}>
        <ImageIcon size={19} />
      </ToolButton>
      <ToolButton
        active={tool === 'frame'}
        label="Marco"
        shortcut="F"
        onClick={() => onTool('frame')}
      >
        <Frame size={19} />
      </ToolButton>
      <ToolButton label="Temporizador" onClick={onTimer}>
        <Timer size={19} />
      </ToolButton>
      <ToolButton
        active={tool === 'comment'}
        label="Comentario"
        shortcut="M"
        onClick={() => onTool('comment')}
      >
        <MessageCircle size={19} />
      </ToolButton>
      <ToolButton
        active={tool === 'eraser'}
        label="Borrar"
        shortcut="E"
        onClick={() => onTool('eraser')}
      >
        <Eraser size={19} />
      </ToolButton>
      <div className="tool-divider" />
      <ToolButton label="Plantillas" onClick={onTemplates}>
        <LayoutTemplate size={19} />
      </ToolButton>
      <ToolButton
        label="Deshacer"
        shortcut="⌘Z"
        onClick={undo}
        className={!canUndo ? 'is-disabled' : ''}
      >
        <Undo2 size={18} />
      </ToolButton>
      <ToolButton
        label="Rehacer"
        shortcut="⇧⌘Z"
        onClick={redo}
        className={!canRedo ? 'is-disabled' : ''}
      >
        <Redo2 size={18} />
      </ToolButton>
    </aside>
  );
}

export function MobileDock({
  tool,
  shapeKind,
  onTool,
  onShapeKind,
  onImage,
  onTemplates,
  onTimer,
}: ToolbarProps) {
  const [expanded, setExpanded] = useState(false);
  const undo = useLienzo((state) => state.undo);
  const redo = useLienzo((state) => state.redo);
  const selectedShape = SHAPE_OPTIONS.find((option) => option.kind === shapeKind);
  const ShapeIcon = selectedShape?.icon ?? <Square size={19} />;

  const close = () => setExpanded(false);
  const choose = (next: Tool) => {
    onTool(next);
    close();
  };

  return (
    <nav className={`mobile-dock ${expanded ? 'is-expanded' : ''}`} aria-label="Herramientas">
      {expanded ? (
        <div className="mobile-dock-more">
          <button type="button" onClick={() => choose('connector')} aria-label="Conector">
            <ArrowUpRight size={20} />
            <span>Conector</span>
          </button>
          <button type="button" onClick={() => choose('pen')} aria-label="Dibujar">
            <PenLine size={20} />
            <span>Dibujar</span>
          </button>
          <button type="button" onClick={() => choose('highlighter')} aria-label="Resaltar">
            <Highlighter size={20} />
            <span>Resaltar</span>
          </button>
          <button type="button" onClick={() => choose('laser')} aria-label="Puntero láser">
            <Zap size={20} />
            <span>Láser</span>
          </button>
          <button type="button" onClick={() => choose('frame')} aria-label="Marco">
            <Frame size={20} />
            <span>Marco</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onImage();
              close();
            }}
            aria-label="Insertar imagen"
          >
            <ImageIcon size={20} />
            <span>Imagen</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onTimer();
              close();
            }}
            aria-label="Temporizador"
          >
            <Timer size={20} />
            <span>Temporizador</span>
          </button>
          <button type="button" onClick={() => choose('comment')} aria-label="Comentario">
            <MessageCircle size={20} />
            <span>Comentario</span>
          </button>
          <button type="button" onClick={() => choose('eraser')} aria-label="Borrar">
            <Eraser size={20} />
            <span>Borrar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onTemplates();
              close();
            }}
            aria-label="Plantillas"
          >
            <LayoutTemplate size={20} />
            <span>Plantillas</span>
          </button>
          <button type="button" onClick={undo} aria-label="Deshacer">
            <Undo2 size={20} />
            <span>Deshacer</span>
          </button>
          <button type="button" onClick={redo} aria-label="Rehacer">
            <Redo2 size={20} />
            <span>Rehacer</span>
          </button>
        </div>
      ) : null}
      <div className="mobile-dock-row">
        <button
          type="button"
          className={tool === 'select' ? 'is-active' : ''}
          onClick={() => choose('select')}
          aria-label="Seleccionar"
        >
          <MousePointer2 size={21} />
        </button>
        <button
          type="button"
          className={tool === 'sticky' ? 'is-active' : ''}
          onClick={() => choose('sticky')}
          aria-label="Nota"
        >
          <StickyNote size={21} />
        </button>
        <button
          type="button"
          className={tool === 'text' ? 'is-active' : ''}
          onClick={() => choose('text')}
          aria-label="Texto"
        >
          <Type size={21} />
        </button>
        <button
          type="button"
          className={tool === 'shape' ? 'is-active' : ''}
          onClick={() => {
            if (tool === 'shape') {
              const index = SHAPE_OPTIONS.findIndex((option) => option.kind === shapeKind);
              onShapeKind(SHAPE_OPTIONS[(index + 1) % SHAPE_OPTIONS.length].kind);
            } else {
              onShapeKind(shapeKind);
              onTool('shape');
            }
          }}
          aria-label="Forma"
          onDoubleClick={() => onTool('shape')}
        >
          <span className="mobile-shape">{ShapeIcon}</span>
        </button>
        <button
          type="button"
          className={tool === 'hand' ? 'is-active' : ''}
          onClick={() => choose('hand')}
          aria-label="Mover"
        >
          <Hand size={21} />
        </button>
        <button
          type="button"
          className={tool === 'comment' ? 'is-active' : ''}
          onClick={() => choose('comment')}
          aria-label="Comentario"
        >
          <MessageCircle size={21} />
        </button>
        <button
          type="button"
          className={`mobile-more ${expanded ? 'is-active' : ''}`}
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? 'Cerrar más herramientas' : 'Más herramientas'}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown size={21} /> : <MoreHorizontal size={21} />}
        </button>
      </div>
    </nav>
  );
}
