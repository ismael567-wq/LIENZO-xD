import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search, X } from 'lucide-react';
import type { BoardItem } from '../types';
import { currentBoardOf, useLienzo } from '../store/boardStore';
import { itemRect } from '../lib/geometry';

const TYPE_LABEL: Record<BoardItem['type'], string> = {
  sticky: 'Nota',
  shape: 'Forma',
  text: 'Texto',
  draw: 'Trazo',
  image: 'Imagen',
  frame: 'Marco',
  connector: 'Conector',
};

function searchableText(item: BoardItem): string {
  switch (item.type) {
    case 'sticky':
    case 'shape':
    case 'text':
      return item.text;
    case 'frame':
      return item.title;
    case 'connector':
      return item.label;
    case 'image':
      return item.alt;
    default:
      return '';
  }
}

export function BoardSearch() {
  const open = useLienzo((state) => state.ui.search);
  const setUi = useLienzo((state) => state.setUi);
  const board = useLienzo((state) => currentBoardOf(state));
  const select = useLienzo((state) => state.select);
  const focusRect = useLienzo((state) => state.focusRect);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  const results = useMemo(() => {
    if (!board) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return board.items
      .filter((item) => searchableText(item).toLowerCase().includes(needle))
      .slice(0, 8);
  }, [board, query]);

  if (!open || !board) return null;

  const close = () => setUi('search', false);

  const goTo = (item: BoardItem) => {
    select([item.id]);
    focusRect(itemRect(item), 150, 1.6);
    close();
  };

  return (
    <div
      className="search-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="board-search" role="dialog" aria-modal="true" aria-label="Buscar en la pizarra">
        <div className="board-search-field">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            placeholder="Buscar texto, notas, marcos…"
            aria-label="Buscar en la pizarra"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                close();
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((value) => Math.min(results.length - 1, value + 1));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((value) => Math.max(0, value - 1));
              }
              if (event.key === 'Enter' && results[active]) {
                event.preventDefault();
                goTo(results[active]);
              }
            }}
          />
          <button type="button" onClick={close} aria-label="Cerrar búsqueda">
            <X size={16} />
          </button>
        </div>
        {query.trim() ? (
          results.length > 0 ? (
            <ul className="board-search-results">
              {results.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={index === active ? 'is-active' : ''}
                    onPointerEnter={() => setActive(index)}
                    onClick={() => goTo(item)}
                  >
                    <span className="board-search-type">{TYPE_LABEL[item.type]}</span>
                    <span className="board-search-copy">
                      {searchableText(item).slice(0, 90) || 'Sin texto'}
                    </span>
                    {index === active ? <CornerDownLeft size={14} /> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="board-search-empty">No hay coincidencias en esta pizarra.</p>
          )
        ) : (
          <p className="board-search-hint">
            Escribe para buscar dentro de la pizarra. <kbd>Esc</kbd> para cerrar.
          </p>
        )}
      </div>
    </div>
  );
}
