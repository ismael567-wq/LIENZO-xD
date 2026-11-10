import { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  ExternalLink,
  Loader2,
  PenLine,
  X,
} from 'lucide-react';
import type { FileItem, Point } from '../types';
import { currentBoardOf, useLienzo } from '../store/boardStore';
import { ensureLocalFile, downloadStoredFile } from '../lib/files';
import { newDraw } from '../lib/factory';
import { formatDuration } from '../lib/audio';

function embedUrl(url: string): { kind: 'iframe' | 'video'; src: string } {
  const youtube = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/,
  );
  if (youtube) return { kind: 'iframe', src: `https://www.youtube.com/embed/${youtube[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) return { kind: 'video', src: url };
  return { kind: 'iframe', src: url };
}

export function MediaOverlay() {
  const board = useLienzo((state) => currentBoardOf(state));
  const mediaItemId = useLienzo((state) => state.mediaItemId);
  const closeMedia = useLienzo((state) => state.closeMedia);
  const setPdfPage = useLienzo((state) => state.setPdfPage);
  const base = useLienzo((state) => state.collab.localServerUrl ?? state.collab.url);

  const item = board?.items.find((candidate) => candidate.id === mediaItemId);
  const file = item && item.type === 'file' ? (item as FileItem) : null;

  useEffect(() => {
    if (!mediaItemId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMedia();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mediaItemId, closeMedia]);

  if (!mediaItemId || !board) return null;
  if (!file) {
    return (
      <div className="modal-scrim" role="dialog" aria-modal="true">
        <div className="media-panel">
          <header>
            <span>Vista previa</span>
            <button type="button" className="icon-btn" onClick={closeMedia} aria-label="Cerrar">
              <X size={16} />
            </button>
          </header>
          <p className="media-empty">Este objeto no tiene una vista ampliada.</p>
        </div>
      </div>
    );
  }

  if (file.kind === 'pdf') {
    return (
      <PdfViewer
        item={file}
        base={base}
        initialPage={board.pdfPages?.[file.fileId] ?? file.page ?? 1}
        onPage={(page) => setPdfPage(file.fileId, page)}
        onClose={closeMedia}
      />
    );
  }

  if (file.kind === 'video') {
    return <VideoViewer item={file} base={base} onClose={closeMedia} />;
  }

  if (file.kind === 'audio') {
    return <AudioViewer item={file} base={base} onClose={closeMedia} />;
  }

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true">
      <div className="media-panel">
        <header>
          <span>{file.name}</span>
          <button type="button" className="icon-btn" onClick={closeMedia} aria-label="Cerrar">
            <X size={16} />
          </button>
        </header>
        <p className="media-empty">
          {file.text
            ? file.text.slice(0, 4000)
            : 'Este archivo se abre con la aplicación del sistema.'}
        </p>
        <footer>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void downloadStoredFile(file.fileId, file.name)}
          >
            <Download size={14} /> Descargar
          </button>
        </footer>
      </div>
    </div>
  );
}

function PdfViewer({
  item,
  base,
  initialPage,
  onPage,
  onClose,
}: {
  item: FileItem;
  base: string | null;
  initialPage: number;
  onPage: (page: number) => void;
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ink, setInk] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Point[][]>([]);
  const currentRef = useRef<Point[]>([]);

  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    (async () => {
      try {
        setLoading(true);
        const blob = await ensureLocalFile(item.fileId, base);
        if (!blob) throw new Error('El PDF no está disponible en este dispositivo.');
        const pdfjs = await import('pdfjs-dist');
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const data = new Uint8Array(await blob.arrayBuffer());
        loaded = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          void loaded.destroy();
          return;
        }
        setDoc(loaded);
        setNumPages(loaded.numPages);
        setPage(Math.min(Math.max(1, initialPage), loaded.numPages));
        setError(null);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'No se pudo abrir el PDF.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (loaded) void loaded.destroy();
    };
    // El documento se recarga solo si cambia el archivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.fileId]);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const pdfPage = await doc.getPage(page);
        const viewport = pdfPage.getViewport({ scale: 1.35 });
        const canvas = canvasRef.current;
        const overlay = inkRef.current;
        if (!canvas || !overlay || cancelled) return;
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        const context = canvas.getContext('2d');
        if (!context) return;
        await pdfPage.render({ canvasContext: context, viewport }).promise;
        const overlayContext = overlay.getContext('2d');
        overlayContext?.clearRect(0, 0, overlay.width, overlay.height);
        strokesRef.current = [];
        setError(null);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'No se pudo pintar la página.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, page]);

  useEffect(() => {
    onPage(page);
  }, [page, onPage]);

  const changePage = (delta: number) => {
    setPage((value) => Math.min(Math.max(1, value + delta), Math.max(1, numPages)));
  };

  const drawInk = () => {
    const overlay = inkRef.current;
    const context = overlay?.getContext('2d');
    if (!overlay || !context) return;
    context.clearRect(0, 0, overlay.width, overlay.height);
    context.strokeStyle = '#D14343';
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const stroke of [...strokesRef.current, currentRef.current]) {
      if (stroke.length < 2) continue;
      context.beginPath();
      context.moveTo(stroke[0].x, stroke[0].y);
      for (const point of stroke.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
    }
  };

  const localPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const overlay = inkRef.current!;
    const rect = overlay.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * overlay.width,
      y: ((event.clientY - rect.top) / rect.height) * overlay.height,
    };
  };

  const commitStroke = () => {
    if (!ink) return;
    const overlay = inkRef.current;
    const stroke = currentRef.current;
    currentRef.current = [];
    if (!overlay || stroke.length < 2) return;
    const state = useLienzo.getState();
    const scaleX = item.w / overlay.width;
    const scaleY = item.h / overlay.height;
    const points = stroke.map((point) => ({
      x: item.x + point.x * scaleX,
      y: item.y + point.y * scaleY,
    }));
    const drawing = newDraw(points, false, '#D14343', 2);
    state.addItem({ ...drawing, pageOf: { fileId: item.fileId, page } });
  };

  const clearInk = () => {
    const state = useLienzo.getState();
    const board = currentBoardOf(state);
    if (!board) return;
    const targets = board.items.filter(
      (candidate) =>
        candidate.type === 'draw' &&
        candidate.pageOf?.fileId === item.fileId &&
        candidate.pageOf?.page === page,
    );
    if (targets.length === 0) return;
    state.pushHistory();
    for (const target of targets) state.deleteItem(target.id);
  };

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label={item.name}>
      <div className="media-panel is-pdf">
        <header>
          <span className="media-title" title={item.name}>
            {item.name}
          </span>
          <div className="media-actions">
            <button
              type="button"
              className={`icon-btn ${ink ? 'is-active' : ''}`}
              onClick={() => setInk((value) => !value)}
              title="Anotar sobre la página"
              aria-pressed={ink}
            >
              <PenLine size={15} />
            </button>
            <button type="button" className="icon-btn" onClick={clearInk} title="Borrar tinta de la página">
              <Eraser size={15} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => void downloadStoredFile(item.fileId, item.name)}
              title="Descargar PDF"
            >
              <Download size={15} />
            </button>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="pdf-stage">
          {loading ? (
            <div className="media-loading">
              <Loader2 size={20} className="spin" /> Cargando página…
            </div>
          ) : null}
          {error ? <p className="media-empty">{error}</p> : null}
          <div className="pdf-page">
            <canvas ref={canvasRef} />
            <canvas
              ref={inkRef}
              className={`pdf-ink ${ink ? 'is-active' : ''}`}
              onPointerDown={(event) => {
                if (!ink) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                currentRef.current = [localPoint(event)];
                drawInk();
              }}
              onPointerMove={(event) => {
                if (!ink || currentRef.current.length === 0) return;
                currentRef.current.push(localPoint(event));
                drawInk();
              }}
              onPointerUp={() => {
                if (!ink) return;
                strokesRef.current.push(currentRef.current);
                commitStroke();
              }}
              onPointerCancel={() => {
                currentRef.current = [];
                drawInk();
              }}
            />
          </div>
        </div>

        <footer className="pdf-footer">
          <button
            type="button"
            className="icon-btn"
            onClick={() => changePage(-1)}
            disabled={page <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Página {page} / {numPages || '—'}
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => changePage(1)}
            disabled={page >= numPages}
            aria-label="Página siguiente"
          >
            <ChevronRight size={16} />
          </button>
          {ink ? <span className="pdf-hint">Dibuja sobre la página para anotar</span> : null}
        </footer>
      </div>
    </div>
  );
}

function VideoViewer({
  item,
  base,
  onClose,
}: {
  item: FileItem;
  base: string | null;
  onClose: () => void;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remote = useMemo(() => (item.url ? embedUrl(item.url) : null), [item.url]);

  useEffect(() => {
    if (remote) return;
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      try {
        const blob = await ensureLocalFile(item.fileId, base);
        if (!blob) throw new Error('El vídeo no está disponible en este dispositivo.');
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSource(url);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'No se pudo abrir el vídeo.');
        }
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.fileId, base, remote]);

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label={item.name}>
      <div className="media-panel is-video">
        <header>
          <span className="media-title">{item.name}</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </header>
        {error ? <p className="media-empty">{error}</p> : null}
        {remote?.kind === 'iframe' ? (
          <iframe
            className="media-frame"
            src={remote.src}
            title={item.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : null}
        {remote?.kind === 'video' ? (
          <video className="media-frame" src={remote.src} controls autoPlay />
        ) : null}
        {!remote && source ? <video className="media-frame" src={source} controls autoPlay /> : null}
        {!remote && !source && !error ? (
          <div className="media-loading">
            <Loader2 size={20} className="spin" /> Preparando vídeo…
          </div>
        ) : null}
        <footer>
          {item.url ? (
            <a className="btn btn-ghost" href={item.url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Abrir en el navegador
            </a>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void downloadStoredFile(item.fileId, item.name)}
            >
              <Download size={14} /> Descargar
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function AudioViewer({
  item,
  base,
  onClose,
}: {
  item: FileItem;
  base: string | null;
  onClose: () => void;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      try {
        const blob = await ensureLocalFile(item.fileId, base);
        if (!blob) throw new Error('El audio no está disponible en este dispositivo.');
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSource(url);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'No se pudo abrir el audio.');
        }
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.fileId, base]);

  const waveform = item.voiceNote?.waveform ?? [];
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label={item.name}>
      <div className="media-panel is-audio">
        <header>
          <span className="media-title">{item.name}</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </header>
        <div className="audio-wave" aria-hidden="true">
          {waveform.length > 0
            ? waveform.map((level, index) => (
                <span key={index} style={{ height: `${Math.max(6, level * 84)}px` }} />
              ))
            : Array.from({ length: 40 }, (_, index) => (
                <span
                  key={index}
                  style={{ height: `${12 + Math.abs(Math.sin(index * 0.7)) * 54}px` }}
                />
              ))}
        </div>
        {item.voiceNote ? (
          <p className="media-meta">
            {formatDuration(item.voiceNote.duration)} · {item.voiceNote.author ?? 'Nota de voz'}
          </p>
        ) : null}
        {error ? <p className="media-empty">{error}</p> : null}
        {source ? <audio src={source} controls autoPlay className="voice-player" /> : null}
        {!source && !error ? (
          <div className="media-loading">
            <Loader2 size={20} className="spin" /> Preparando audio…
          </div>
        ) : null}
      </div>
    </div>
  );
}
