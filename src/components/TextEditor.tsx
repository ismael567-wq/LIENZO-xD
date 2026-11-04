import { useEffect, useRef } from 'react';
import type { Board, BoardItem, FrameItem } from '../types';
import { useLienzo } from '../store/boardStore';
import { worldToScreen } from '../lib/geometry';
import { FONT_DISPLAY, FONT_MONO, FONT_UI, readableInk } from '../lib/theme';

interface TextEditorProps {
  board: Board;
  viewport: { x: number; y: number; zoom: number };
}

type TextualItem = Extract<BoardItem, { type: 'sticky' | 'text' | 'shape' }>;

export function TextEditor({ board, viewport }: TextEditorProps) {
  const editingId = useLienzo((state) => state.editingId);
  if (!editingId) return null;
  const item = board.items.find((candidate) => candidate.id === editingId);
  if (!item) return null;
  if (item.type === 'frame') {
    return <FrameTitleEditor item={item} viewport={viewport} />;
  }
  if (item.type !== 'sticky' && item.type !== 'text' && item.type !== 'shape') {
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
  const padding = isSticky
    ? Math.max(12, Math.min(20, item.w * 0.1)) * zoom
    : 18 * zoom;
  const fontFamily =
    item.type === 'text'
      ? item.fontFamily === 'serif'
        ? FONT_DISPLAY
        : item.fontFamily === 'mono'
          ? FONT_MONO
          : FONT_UI
      : FONT_UI;
  const fontStyle = item.type === 'text' && item.italic ? 'italic' : 'normal';
  const theme = useLienzo((state) => state.theme);
  const color =
    item.type === 'sticky'
      ? item.textColor
      : item.type === 'shape'
        ? item.textColor
        : readableInk(item.color, theme);

  return (
    <div
      className={`text-editor-overlay ${isShape ? 'is-shape' : ''} ${isSticky ? 'is-sticky' : ''}`}
      style={{
        left: screen.x,
        top: screen.y,
        width: item.w * zoom,
        height: isSticky || isShape ? item.h * zoom : 'auto',
        minHeight: item.h * zoom,
        padding,
        fontSize: item.fontSize * zoom,
        lineHeight: 1.35,
        fontFamily,
        fontStyle,
        fontWeight: item.type === 'text' ? item.fontWeight : 500,
        color,
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
