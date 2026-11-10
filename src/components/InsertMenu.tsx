import { useEffect, useRef, useState } from 'react';
import {
  Braces,
  FileText,
  GraduationCap,
  Mic,
  Plus,
  Sparkles,
  Table2,
  Video,
  Workflow,
} from 'lucide-react';
import type { InsertKind } from '../types';

interface InsertMenuProps {
  onInsert: (kind: InsertKind) => void;
}

const OPTIONS: Array<{ kind: InsertKind; label: string; hint: string; icon: React.ReactNode }> = [
  { kind: 'code', label: 'Bloque de código', hint: 'Con resaltado por lenguaje', icon: <Braces size={16} /> },
  { kind: 'markdown', label: 'Markdown', hint: 'Títulos, listas y tareas', icon: <FileText size={16} /> },
  { kind: 'table', label: 'Tabla', hint: 'Filas y columnas editables', icon: <Table2 size={16} /> },
  { kind: 'sticker', label: 'Sticker', hint: 'Iconos y sellos', icon: <Sparkles size={16} /> },
  { kind: 'flashcard', label: 'Flashcard', hint: 'Pregunta y respuesta', icon: <GraduationCap size={16} /> },
  { kind: 'mermaid', label: 'Diagrama Mermaid', hint: 'Mapa mental y flujo en vivo', icon: <Workflow size={16} /> },
  { kind: 'video', label: 'Vídeo', hint: 'URL de YouTube/Vimeo o archivo', icon: <Video size={16} /> },
  { kind: 'voice', label: 'Nota de voz', hint: 'Graba con el micrófono', icon: <Mic size={16} /> },
];

export function InsertMenu({ onInsert }: InsertMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div className="insert-menu" ref={ref}>
      <button
        type="button"
        className={`insert-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Insertar objeto"
        data-tip="Insertar"
      >
        <Plus size={19} />
        <span className="tool-tip" role="tooltip">
          Insertar
        </span>
      </button>
      {open ? (
        <div className="insert-popover" role="menu">
          <p className="insert-title">Insertar en el lienzo</p>
          {OPTIONS.map((option) => (
            <button
              key={option.kind}
              type="button"
              role="menuitem"
              className="insert-option"
              onClick={() => {
                setOpen(false);
                onInsert(option.kind);
              }}
            >
              <span className="insert-icon">{option.icon}</span>
              <span>
                <strong>{option.label}</strong>
                <em>{option.hint}</em>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
