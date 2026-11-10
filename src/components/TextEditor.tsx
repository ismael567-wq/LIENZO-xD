import { useEffect, useRef } from 'react';
import type { Board, BoardItem, FrameItem } from '../types';
import { useLienzo } from '../store/boardStore';
import { worldToScreen } from '../lib/geometry';
import { FONT_DISPLAY, FONT_MONO, FONT_UI, readableInk } from '../lib/theme';

interface TextEditorProps {
  board: Board;
  viewport: { x: number; y: number; zoom: number };
}

type TextualItem = Extract<BoardItem, { type: 'sticky' | 'text' | 'shape' | 'code' | 'markdown' }>;

export function TextEditor({ board, viewport }: TextEditorProps) {
  const editingId = useLienzo((state) => state.editingId);
  if (!editingId) return null;
  const item = board.items.find((candidate) => candidate.id === editingId);
  if (!item) return null;
  if (item.type === 'frame') {
    return <FrameTitleEditor item={item} viewport={viewport} />;
  }
  if (item.type === 'table') {
    return <TableEditor item={item} viewport={viewport} />;
  }
  if (item.type === 'flashcard') {
    return <FlashcardEditor item={item} viewport={viewport} />;
  }
  if (
    item.type !== 'sticky' &&
    item.type !== 'text' &&
    item.type !== 'shape' &&
    item.type !== 'code' &&
    item.type !== 'markdown'
  ) {
    return null;
  }
  return <BodyTextEditor item={item} viewport={viewport} />;
}

function BodyTextEditor({
  item,
  viewport,
}: {
  item: TextualItem;
  viewport: { x: number; y: number; zoom: number };
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef(false);
  const zoom = viewport.zoom;
  const screen = worldToScreen({ x: item.x, y: item.y }, viewport);
  const theme = useLienzo((state) => state.theme);

  useEffect(() => {
    committedRef.current = false;
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerText = item.text;
    const frame = requestAnimationFrame(() => {
      editor.focus();
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    });
    return () => cancelAnimationFrame(frame);
    // Only reset content when switching to another item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const state = useLienzo.getState();
    const editor = editorRef.current;
    const current = state.boards
      .find((board) => board.id === state.boardId)
      ?.items.find((candidate) => candidate.id === item.id);
    if (!editor || !current) {
      state.finishEditing();
      return;
    }
    const value = editor.innerText.replace(/\u00a0/g, ' ').replace(/\n$/, '');
    if (current.type === 'text') {
      const height = Math.max(48, Math.ceil(editor.scrollHeight / zoom));
      state.updateItem(current.id, {
        text: value,
        h: Math.min(Math.max(height, 48), 2400),
      });
    } else {
      state.updateItem(current.id, { text: value });
    }
    state.finishEditing();
  };

  const isSticky = item.type === 'sticky';
  const isShape = item.type === 'shape';
  const isCode = item.type === 'code';
  const isMarkdown = item.type === 'markdown';
  const padding = isSticky
    ? Math.max(12, Math.min(20, item.w * 0.1)) * zoom
    : isCode
      ? 14 * zoom
      : 18 * zoom;
  const fontFamily =
    isCode
      ? FONT_MONO
      : item.type === 'text'
        ? item.fontFamily === 'serif'
          ? FONT_DISPLAY
          : item.fontFamily === 'mono'
            ? FONT_MONO
            : FONT_UI
        : FONT_UI;
  const fontStyle = item.type === 'text' && item.italic ? 'italic' : 'normal';
  const color =
    item.type === 'sticky'
      ? item.textColor
      : item.type === 'shape'
        ? item.textColor
        : isCode
          ? theme === 'dark'
            ? '#F3F0E8'
            : '#16211E'
          : item.type === 'markdown'
            ? theme === 'dark'
              ? '#F3F0E8'
              : '#16211E'
            : readableInk(item.color, theme);
  const background = isCode
    ? theme === 'dark'
      ? '#151A18'
      : '#F7F5EF'
    : isMarkdown
      ? theme === 'dark'
        ? '#1B211E'
        : '#FFFDF7'
      : undefined;

  return (
    <div
      className={`text-editor-overlay ${isShape ? 'is-shape' : ''} ${isSticky ? 'is-sticky' : ''
        } ${isCode ? 'is-code' : ''} ${isMarkdown ? 'is-markdown' : ''}`}
      style={{
        left: screen.x,
        top: screen.y,
        width: item.w * zoom,
        height: isSticky || isShape || isCode || isMarkdown ? item.h * zoom : 'auto',
        minHeight: item.h * zoom,
        padding,
        fontSize: item.fontSize * zoom,
        lineHeight: isCode ? 1.5 : 1.35,
        fontFamily,
        fontStyle,
        fontWeight: item.type === 'text' ? item.fontWeight : isCode ? 400 : 500,
        color,
        background,
        textAlign: isShape ? 'center' : item.type === 'text' ? item.align : 'left',
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        ref={editorRef}
        className="text-editor-input"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={() => {
          const editor = editorRef.current;
          if (!editor) return;
          const value = editor.innerText.replace(/\u00a0/g, ' ').replace(/\n$/, '');
          useLienzo.getState().updateItem(item.id, { text: value });
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
            event.preventDefault();
            commit();
          }
        }}
      />
    </div>
  );
}

function TableEditor({
  item,
  viewport,
}: {
  item: Extract<BoardItem, { type: 'table' }>;
  viewport: { x: number; y: number; zoom: number };
}) {
  const zoom = viewport.zoom;
  const screen = worldToScreen({ x: item.x, y: item.y }, viewport);
  const rows = item.rows.length > 0 ? item.rows : [['']];
  const columns = Math.max(1, ...rows.map((row) => row.length));

  const setCell = (rowIndex: number, columnIndex: number, value: string) => {
    const state = useLienzo.getState();
    const board = state.boards.find((board) => board.id === state.boardId);
    const current = board?.items.find((candidate) => candidate.id === item.id);
    if (!current || current.type !== 'table') return;
    const next = current.rows.map((row, r) =>
      r === rowIndex
        ? Array.from({ length: Math.max(row.length, columns) }, (_, c) =>
            c === columnIndex ? value : row[c] ?? '',
          )
        : row,
    );
    state.updateItem(item.id, { rows: next });
  };

  return (
    <div
      className="table-editor"
      style={{
        left: screen.x,
        top: screen.y,
        width: item.w * zoom,
        height: item.h * zoom,
        fontSize: item.fontSize * zoom,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="table-editor-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows.length }, (_, rowIndex) =>
          Array.from({ length: columns }, (_, columnIndex) => (
            <input
              key={`${rowIndex}-${columnIndex}`}
              value={rows[rowIndex]?.[columnIndex] ?? ''}
              className={rowIndex === 0 && item.header ? 'is-header' : ''}
              onChange={(event) => setCell(rowIndex, columnIndex, event.target.value)}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Escape') {
                  event.preventDefault();
                  useLienzo.getState().finishEditing();
                }
              }}
            />
          )),
        )}
      </div>
      <p className="table-editor-hint">Tab para moverte entre celdas · Esc para terminar</p>
    </div>
  );
}

function FlashcardEditor({
  item,
  viewport,
}: {
  item: Extract<BoardItem, { type: 'flashcard' }>;
  viewport: { x: number; y: number; zoom: number };
}) {
  const zoom = viewport.zoom;
  const screen = worldToScreen({ x: item.x, y: item.y }, viewport);
  const state = useLienzo.getState();

  return (
    <div
      className="flashcard-editor"
      style={{
        left: screen.x,
        top: screen.y,
        width: item.w * zoom,
        height: item.h * zoom,
        fontSize: item.fontSize * zoom,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <label>
        <span>Pregunta</span>
        <textarea
          autoFocus
          value={item.front}
          onChange={(event) => state.updateItem(item.id, { front: event.target.value })}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') useLienzo.getState().finishEditing();
          }}
          rows={3}
        />
      </label>
      <label>
        <span>Respuesta</span>
        <textarea
          value={item.back}
          onChange={(event) => state.updateItem(item.id, { back: event.target.value })}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') useLienzo.getState().finishEditing();
          }}
          rows={3}
        />
      </label>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => useLienzo.getState().finishEditing()}
      >
        Listo
      </button>
    </div>
  );
}

function FrameTitleEditor({
  item,
  viewport,
}: {
  item: FrameItem;
  viewport: { x: number; y: number; zoom: number };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoom = viewport.zoom;
  const screen = worldToScreen({ x: item.x, y: item.y }, viewport);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  const commit = (value: string) => {
    useLienzo.getState().updateItem(item.id, {
      title: value.trim() || 'Marco',
    });
    useLienzo.getState().finishEditing();
  };

  return (
    <div
      className="text-editor-frame"
      style={{
        left: screen.x,
        top: screen.y - 36 * zoom,
        minWidth: Math.max(180, item.w * zoom * 0.4),
        maxWidth: 460,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <input
        ref={inputRef}
        defaultValue={item.title}
        onChange={(event) => {
          useLienzo.getState().updateItem(item.id, { title: event.target.value });
        }}
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        style={{ fontSize: `${13 * zoom}px` }}
        aria-label="Título del marco"
      />
    </div>
  );
}
