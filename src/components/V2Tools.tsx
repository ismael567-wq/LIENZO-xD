import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility,
  BarChart3,
  Bot,
  Camera,
  Check,
  Clapperboard,
  Dices,
  Download,
  FileCode2,
  FileText,
  Frame,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  ListOrdered,
  Mic,
  MonitorPlay,
  Palette,
  Play,
  Podcast,
  Presentation,
  RotateCcw,
  Shuffle,
  Sparkles,
  Square,
  Table2,
  Users,
  Video,
  Wand2,
  X,
} from 'lucide-react';
import type { Board, BoardItem, CommentPin, FileItem, ImageItem } from '../types';
import { currentBoardOf, useLienzo } from '../store/boardStore';
import { boundsOfItems, fitViewport, screenToWorld, uid } from '../lib/geometry';
import { renderBoard } from '../lib/canvasRenderer';
import {
  ASSET_LIBRARY,
  arrangeFlow,
  buildHtmlFromItems,
  buildKanban,
  buildWireframe,
  buildZoneDuel,
  isEmbedAllowed,
  parseDelimited,
  renderChartDataUrl,
  boardToText,
  type ChartKind,
  type WireframeKind,
} from '../lib/v2';
import { newSticker, newStickyRect } from '../lib/factory';
import { saveStoredFile } from '../lib/files';
import { playSound } from '../lib/sound';
import { boardToMarkdown } from '../lib/markdown';

interface Snapshot {
  at: number;
  items: BoardItem[];
  comments: CommentPin[];
}

type Dialog =
  | 'chart'
  | 'embed'
  | 'assets'
  | 'wireframe'
  | 'roulette'
  | 'sidekick'
  | 'replay'
  | 'compare'
  | 'doc'
  | 'capture'
  | null;

interface AiConfig {
  endpoint: string;
  model: string;
  key: string;
}

const AI_KEY = 'lienzo:ai:v1';

function loadAi(): AiConfig {
  try {
    const raw = localStorage.getItem(AI_KEY);
    if (raw) return { endpoint: '', model: '', key: '', ...JSON.parse(raw) };
  } catch {
    // Configuración corrupta: se ignora.
  }
  return { endpoint: '', model: 'llama3.1', key: '' };
}

function outlineFor(prompt: string): string[] {
  const text = prompt.toLowerCase();
  if (/retro|sprint|equipo/.test(text)) {
    return ['Qué funcionó', 'Qué podemos mejorar', 'Acciones concretas', 'Responsables', 'Siguiente sprint'];
  }
  if (/viaje|cliente|experiencia/.test(text)) {
    return ['Descubrir', 'Considerar', 'Decidir', 'Usar', 'Fidelizar', 'Oportunidades'];
  }
  if (/clase|lección|leccion|curso|aula/.test(text)) {
    return ['Pregunta inicial', 'Objetivos', 'Concepto clave', 'Ejemplo guiado', 'Práctica', 'Cierre y dudas'];
  }
  if (/proyecto|plan|roadmap/.test(text)) {
    return ['Problema', 'Objetivo', 'Alcance', 'Equipo', 'Hitos', 'Riesgos'];
  }
  if (/kanban|tarea|flujo/.test(text)) {
    return ['Por hacer', 'En curso', 'En revisión', 'Hecho'];
  }
  return ['Contexto', 'Objetivo', 'Ideas', 'Pasos', 'Métricas', 'Próximos pasos'];
}

function outlineItems(lines: string[], point: { x: number; y: number }): BoardItem[] {
  const items: BoardItem[] = [];
  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(lines.length))));
  lines.forEach((line, index) => {
    const sticky = newStickyRect(
      {
        x: point.x + (index % columns) * 230,
        y: point.y + Math.floor(index / columns) * 180,
        w: 200,
        h: 140,
      },
      index % 6,
    );
    sticky.text = line;
    items.push(sticky);
  });
  return items;
}

export function V2Tools({ board, onClose }: { board: Board; onClose: () => void }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [chartKind, setChartKind] = useState<ChartKind>('bar');
  const [chartTitle, setChartTitle] = useState('Datos del tablero');
  const [chartData, setChartData] = useState('Categoría,Valor\nIdeas,12\nPrototipo,8\nValidación,5');
  const [embedUrl, setEmbedUrl] = useState('');
  const [wireframe, setWireframe] = useState<WireframeKind>('browser');
  const [roulette, setRoulette] = useState<string | null>(null);
  const [sidekickPrompt, setSidekickPrompt] = useState('Organiza una clase sobre energía solar');
  const [aiConfig, setAiConfig] = useState<AiConfig>(() => loadAi());
  const [aiBusy, setAiBusy] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [recording, setRecording] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [compareId, setCompareId] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<'screen' | 'webcam' | 'document'>('webcam');
  const [capturing, setCapturing] = useState(false);
  const [ambience, setAmbience] = useState(false);
  const [accessible, setAccessible] = useState(
    () => localStorage.getItem('lienzo:accessible:v1') === 'on',
  );

  const theme = useLienzo((state) => state.theme);
  const peers = useLienzo((state) => state.collab.peers);
  const userName = useLienzo((state) => state.userName);
  const stageSize = useLienzo((state) => state.stageSize);
  const viewport = useLienzo((state) => state.viewport);
  const selected = useLienzo((state) => state.selected);
  const boards = useLienzo((state) => state.boards);
  const showToast = useLienzo((state) => state.showToast);
  const setTexture = useLienzo((state) => state.setTexture);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const compareARef = useRef<HTMLCanvasElement>(null);
  const compareBRef = useRef<HTMLCanvasElement>(null);
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const ambienceRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);

  const center = screenToWorld(
    { x: stageSize.w / 2, y: stageSize.h / 2 },
    viewport,
  );

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      ambienceRef.current?.ctx.close().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('a11y-large', accessible);
    localStorage.setItem('lienzo:accessible:v1', accessible ? 'on' : 'off');
  }, [accessible]);

  const insertItems = (items: BoardItem[]) => {
    if (items.length === 0) return;
    const store = useLienzo.getState();
    store.pushHistory();
    for (const item of items) store.addItem(item, { select: false, history: false });
    store.select(items.filter((item) => item.type !== 'connector').map((item) => item.id));
    playSound('success');
  };

  const pushImage = (src: string, width: number, height: number, alt: string) => {
    const image: ImageItem = {
      id: uid(9),
      type: 'image',
      x: Math.round(center.x - width / 2),
      y: Math.round(center.y - height / 2),
      w: width,
      h: height,
      src,
      alt,
      radius: 8,
      updatedAt: Date.now(),
    };
    insertItems([image]);
  };

  const createChart = () => {
    try {
      const parsed = parseDelimited(chartData);
      if (parsed.rows.length < 2) throw new Error('Añade una cabecera y al menos una fila.');
      const chart = renderChartDataUrl(parsed.rows, chartKind, chartTitle, theme === 'dark');
      pushImage(chart.src, Math.min(600, chart.width / 1.4), Math.min(360, chart.height / 1.4), chartTitle);
      setDialog(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo crear el gráfico.', 'error');
    }
  };

  const insertEmbed = () => {
    if (!isEmbedAllowed(embedUrl)) {
      showToast('Ese dominio no está en la lista de embeds permitidos.', 'error');
      return;
    }
    let host = 'web';
    try {
      host = new URL(embedUrl).hostname.replace(/^www\./, '');
    } catch {
      // La validación previa ya comprobó la URL.
    }
    const file: FileItem = {
      id: uid(9),
      type: 'file',
      x: Math.round(center.x - 240),
      y: Math.round(center.y - 150),
      w: 480,
      h: 300,
      name: `Embed · ${host}`,
      mime: 'text/html',
      size: 0,
      fileId: `embed-${uid(10)}`,
      kind: 'video',
      url: embedUrl,
      updatedAt: Date.now(),
    };
    insertItems([file]);
    setDialog(null);
  };

  const insertAsset = (symbol: string) => {
    const sticker = newSticker(center, symbol);
    insertItems([sticker]);
  };

  const insertWireframe = (kind: WireframeKind) => {
    insertItems(buildWireframe(kind, { x: center.x - 320, y: center.y - 240 }));
    setDialog(null);
  };

  const spinRoulette = () => {
    const names = [userName, ...peers.map((peer) => peer.name)].filter(Boolean);
    if (names.length === 0) return;
    let turns = 0;
    const interval = window.setInterval(() => {
      setRoulette(names[Math.floor(Math.random() * names.length)]);
      turns += 1;
      if (turns > 10) {
        window.clearInterval(interval);
        playSound('reveal');
      }
    }, 80);
  };

  const rollDice = () => {
    setRoulette(`🎲 ${1 + Math.floor(Math.random() * 6)}`);
    playSound('pop');
  };

  const runSidekick = async () => {
    const prompt = sidekickPrompt.trim();
    if (!prompt) return;
    setAiBusy(true);
    try {
      let lines = outlineFor(prompt);
      if (aiConfig.endpoint) {
        const response = await fetch(aiConfig.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(aiConfig.key ? { Authorization: `Bearer ${aiConfig.key}` } : {}),
          },
          body: JSON.stringify({
            model: aiConfig.model,
            temperature: 0.7,
            messages: [
              {
                role: 'system',
                content:
                  'Eres un facilitador visual. Devuelve entre 4 y 8 ideas breves, una por línea, sin numeración ni markdown.',
              },
              { role: 'user', content: prompt },
            ],
          }),
        });
        if (!response.ok) throw new Error(`El modelo respondió ${response.status}.`);
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content ?? '';
        const parsed = content
          .split(/\r?\n/)
          .map((line) => line.replace(/^[-*•\d.\s]+/, '').trim())
          .filter(Boolean)
          .slice(0, 8);
        if (parsed.length > 0) lines = parsed;
      }
      insertItems(outlineItems(lines, { x: center.x - 320, y: center.y - 220 }));
      setDialog(null);
      showToast(aiConfig.endpoint ? 'Ideas generadas con tu modelo.' : 'Esquema local generado.', 'success');
    } catch (error) {
      insertItems(outlineItems(outlineFor(prompt), { x: center.x - 320, y: center.y - 220 }));
      setDialog(null);
      showToast(
        `${error instanceof Error ? error.message : 'La IA falló'} Se usó el esquema local.`,
        'error',
      );
    } finally {
      setAiBusy(false);
    }
  };

  const toggleRecording = () => {
    if (recording) {
      setRecording(false);
      playSound('tap');
      return;
    }
    const snapshot = () => ({
      at: Date.now(),
      items: structuredClone(board.items),
      comments: structuredClone(board.comments),
    });
    setSnapshots([snapshot()]);
    setCursor(0);
    setRecording(true);
    playSound('success');
  };

  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => {
      const current = currentBoardOf(useLienzo.getState());
      if (!current) return;
      setSnapshots((previous) => [
        ...previous.slice(-160),
        {
          at: Date.now(),
          items: structuredClone(current.items),
          comments: structuredClone(current.comments),
        },
      ]);
    }, 2200);
    return () => window.clearInterval(interval);
  }, [recording]);

  const activeSnapshot = snapshots[Math.min(cursor, Math.max(0, snapshots.length - 1))];

  useEffect(() => {
    if (dialog !== 'replay' || !previewRef.current || !activeSnapshot) return;
    const canvas = previewRef.current;
    const width = 640;
    const height = 360;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bounds = boundsOfItems(activeSnapshot.items) ?? { x: 0, y: 0, w: 1000, h: 700 };
    const previewBoard: Board = {
      ...board,
      items: activeSnapshot.items,
      comments: activeSnapshot.comments,
    };
    renderBoard(ctx, previewBoard, {
      width,
      height,
      dpr: 1,
      viewport: fitViewport(bounds, width, height, 24, 1),
      theme,
      preview: true,
      comments: false,
      selected: [],
    });
  }, [dialog, activeSnapshot, board, theme]);

  const compareBoard = useMemo(
    () => boards.find((candidate) => candidate.id === compareId) ?? null,
    [boards, compareId],
  );

  useEffect(() => {
    if (dialog !== 'compare') return;
    const paint = (canvas: HTMLCanvasElement | null, source: Board) => {
      if (!canvas) return;
      const width = 420;
      const height = 260;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const bounds = boundsOfItems(source.items) ?? { x: 0, y: 0, w: 1000, h: 700 };
      renderBoard(ctx, source, {
        width,
        height,
        dpr: 1,
        viewport: fitViewport(bounds, width, height, 20, 1),
        theme,
        preview: true,
        comments: false,
        selected: [],
      });
    };
    paint(compareARef.current, board);
    if (compareBoard) paint(compareBRef.current, compareBoard);
  }, [dialog, board, compareBoard, theme]);

  const exportReplay = () => {
    const blob = new Blob([JSON.stringify({ board: board.name, snapshots }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `replay-${board.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const restoreReplay = () => {
    if (!activeSnapshot) return;
    useLienzo.getState().restoreSnapshot(
      {
        items: structuredClone(activeSnapshot.items),
        comments: structuredClone(activeSnapshot.comments),
        name: board.name,
        background: board.background,
      },
      'Reproducción de sesión',
    );
    showToast('Fotograma restaurado en la pizarra.', 'success');
  };

  const chronology = useMemo(() => {
    const groups = new Map<string, BoardItem[]>();
    for (const item of board.items) {
      const author =
        ('author' in item && typeof item.author === 'string' && item.author) || 'Sin autor';
      const list = groups.get(author) ?? [];
      list.push(item);
      groups.set(author, list);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [board.items]);

  const heatCells = useMemo(() => {
    const cells = new Map<string, number>();
    for (const snapshot of snapshots) {
      for (const item of snapshot.items) {
        const key = `${Math.round(item.x / 160)}:${Math.round(item.y / 160)}`;
        cells.set(key, (cells.get(key) ?? 0) + 1);
      }
    }
    const max = Math.max(1, ...cells.values());
    return [...cells.entries()].map(([key, value]) => {
      const [x, y] = key.split(':').map(Number);
      return { x, y, value: value / max };
    });
  }, [snapshots]);

  const applyFlow = () => {
    const store = useLienzo.getState();
    const current = currentBoardOf(store);
    if (!current) return;
    const selectedItems = current.items.filter((item) => selected.includes(item.id));
    if (selectedItems.length < 2) {
      showToast('Selecciona dos o más objetos para ordenarlos.', 'info');
      return;
    }
    const arranged = arrangeFlow(selectedItems);
    store.pushHistory();
    store.updateItems(
      arranged
        .filter((item) => item.type !== 'connector')
        .map((item) => ({ id: item.id, patch: { x: item.x, y: item.y } })),
    );
    const connectors = arranged.filter((item) => item.type === 'connector');
    for (const connector of connectors) {
      if (!current.items.some((item) => item.id === connector.id)) {
        store.addItem(connector, { select: false, history: false });
      }
    }
    showToast('Flujo ordenado en cadena.', 'success');
  };

  const makeReal = () => {
    const current = currentBoardOf(useLienzo.getState());
    if (!current) return;
    const items = current.items.filter((item) => selected.includes(item.id));
    if (items.length === 0) {
      showToast('Selecciona los objetos que quieres convertir en HTML.', 'info');
      return;
    }
    const html = buildHtmlFromItems(items, `${board.name} · prototipo`);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    const link = document.createElement('a');
    link.href = url;
    link.download = `prototipo-${board.name.replace(/\s+/g, '-').toLowerCase()}.html`;
    link.click();
    showToast('Prototipo HTML generado y abierto.', 'success');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const toggleAmbience = () => {
    if (ambienceRef.current) {
      ambienceRef.current.gain.gain.linearRampToValueAtTime(0, ambienceRef.current.ctx.currentTime + 1);
      const ctx = ambienceRef.current.ctx;
      setTimeout(() => ctx.close().catch(() => undefined), 1200);
      ambienceRef.current = null;
      setAmbience(false);
      return;
    }
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      showToast('Tu navegador no permite audio ambiental.', 'error');
      return;
    }
    const ctx = new Ctx();
    const gain = ctx.createGain();
    gain.gain.value = 0.02;
    gain.connect(ctx.destination);
    const createNoise = (frequency: number, type: OscillatorType) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08 + Math.random() * 0.1;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = frequency * 0.008;
      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      oscillator.connect(gain);
      oscillator.start();
      lfo.start();
    };
    createNoise(110, 'sine');
    createNoise(164, 'triangle');
    ambienceRef.current = { ctx, gain };
    setAmbience(true);
    showToast('Ambiente de sala activado.', 'success');
  };

  const speak = () => {
    interface SpeechRecognitionLike {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      start: () => void;
      stop: () => void;
      onresult:
        | ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
        | null;
      onerror: (() => void) | null;
    }
    type SpeechWindow = Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const win = window as SpeechWindow;
    const Recognition = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Recognition) {
      showToast('El dictado necesita Chrome o Edge con micrófono.', 'error');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = true;
    recognition.continuous = false;
    let finalText = '';
    recognition.onresult = (event) => {
      let text = '';
      for (let index = 0; index < event.results.length; index += 1) {
        text += event.results[index][0]?.transcript ?? '';
      }
      finalText = text;
    };
    recognition.onerror = () => showToast('No se pudo escuchar el micrófono.', 'error');
    recognition.start();
    setStatus('Escuchando… vuelve a pulsar Dictado para insertar el texto.');
    const timer = window.setInterval(() => {
      if (finalText) {
        window.clearInterval(timer);
        const sticky = newStickyRect(
          { x: center.x - 150, y: center.y - 100, w: 300, h: 200 },
          3,
        );
        sticky.text = finalText;
        insertItems([sticky]);
        setStatus(null);
      }
    }, 700);
    window.setTimeout(() => {
      window.clearInterval(timer);
      recognition.stop();
    }, 15000);
  };

  useEffect(() => {
    if (dialog !== 'capture') return;
    let cancelled = false;
    const start = async () => {
      try {
        setCapturing(false);
        const constraints: MediaStreamConstraints =
          captureMode === 'screen'
            ? { video: true, audio: true }
            : {
                video:
                  captureMode === 'document'
                    ? { facingMode: { ideal: 'environment' } }
                    : true,
                audio: captureMode === 'webcam',
              };
        const stream =
          captureMode === 'screen'
            ? await navigator.mediaDevices.getDisplayMedia(constraints)
            : await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (captureVideoRef.current) {
          captureVideoRef.current.srcObject = stream;
          await captureVideoRef.current.play().catch(() => undefined);
        }
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'No se pudo acceder a la cámara.',
          'error',
        );
        
        setDialog(null);
      }
    };
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [dialog, captureMode, showToast]);

  const startRecorder = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
    });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      void saveCapture(blob, 'video');
    };
    recorder.start();
    recorderRef.current = recorder;
    setCapturing(true);
    playSound('success');
  };

  const stopRecorder = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setCapturing(false);
  };

  const saveCapture = async (blob: Blob, kind: 'video' | 'image') => {
    const fileId = `capture-${uid(10)}`;
    try {
      await saveStoredFile(fileId, blob);
      if (kind === 'image') {
        const url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        pushImage(url, 480, 320, 'Captura');
      } else {
        const file: FileItem = {
          id: uid(9),
          type: 'file',
          x: Math.round(center.x - 240),
          y: Math.round(center.y - 135),
          w: 480,
          h: 270,
          name:
            captureMode === 'screen'
              ? 'Grabación de pantalla.webm'
              : captureMode === 'document'
                ? 'Documento capturado.webm'
                : 'Vídeo de webcam.webm',
          mime: blob.type || 'video/webm',
          size: blob.size,
          fileId,
          kind: 'video',
          updatedAt: Date.now(),
        };
        insertItems([file]);
      }
      setDialog(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo guardar la captura.', 'error');
    }
  };

  const photo = async () => {
    const video = captureVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), 'image/png'),
    );
    if (blob) await saveCapture(blob, 'image');
  };

  const toolGroups: Array<{
    title: string;
    tools: Array<{
      id: string;
      label: string;
      hint: string;
      icon: React.ReactNode;
      active?: boolean;
      run: () => void;
    }>;
  }> = [
    {
      title: 'Datos y prototipos',
      tools: [
        {
          id: 'chart',
          label: 'Gráfico desde datos',
          hint: 'Barras, línea o tarta',
          icon: <BarChart3 size={17} />,
          run: () => setDialog('chart'),
        },
        {
          id: 'embed',
          label: 'Embed web',
          hint: 'Figma, Maps, Spotify…',
          icon: <MonitorPlay size={17} />,
          run: () => setDialog('embed'),
        },
        {
          id: 'wireframe',
          label: 'Kit de wireframe',
          hint: 'Navegador, móvil, tarjeta…',
          icon: <LayoutGrid size={17} />,
          run: () => setDialog('wireframe'),
        },
        {
          id: 'flow',
          label: 'Ordenar flujo',
          hint: 'Alinea y conecta la selección',
          icon: <ListOrdered size={17} />,
          run: applyFlow,
        },
        {
          id: 'kanban',
          label: 'Kanban vivo',
          hint: 'Columnas, tarjetas y sprint',
          icon: <Table2 size={17} />,
          run: () => insertItems(buildKanban({ x: center.x - 480, y: center.y - 240 })),
        },
        {
          id: 'duel',
          label: 'Duelo de zonas',
          hint: 'Cuatro equipos y temporizador',
          icon: <Frame size={17} />,
          run: () => insertItems(buildZoneDuel({ x: center.x - 380, y: center.y - 320 })),
        },
        {
          id: 'assets',
          label: 'Galería de assets',
          hint: 'Iconos y stickers offline',
          icon: <Sparkles size={17} />,
          run: () => setDialog('assets'),
        },
        {
          id: 'make-real',
          label: 'Make Real local',
          hint: 'Convierte la selección en HTML',
          icon: <FileCode2 size={17} />,
          run: makeReal,
        },
      ],
    },
    {
      title: 'Aula y personas',
      tools: [
        {
          id: 'capture',
          label: 'Grabar pantalla o cámara',
          hint: 'Vídeo y captura de documento',
          icon: <Video size={17} />,
          run: () => {
            setCaptureMode('screen');
            setDialog('capture');
          },
        },
        {
          id: 'capture-doc',
          label: 'Cámara de documento',
          hint: 'Foto de una hoja o pizarra',
          icon: <Camera size={17} />,
          run: () => {
            setCaptureMode('document');
            setDialog('capture');
          },
        },
        {
          id: 'dictation',
          label: 'Dictado al lienzo',
          hint: 'Habla y crea una nota',
          icon: <Mic size={17} />,
          run: speak,
        },
        {
          id: 'roulette',
          label: 'Dado y ruleta',
          hint: 'Elige un nombre al azar',
          icon: <Dices size={17} />,
          run: () => setDialog('roulette'),
        },
        {
          id: 'sidekick',
          label: 'Sidekick local / IA',
          hint: 'Esquema o modelo BYOK',
          icon: <Bot size={17} />,
          run: () => setDialog('sidekick'),
        },
        {
          id: 'ambience',
          label: 'Ambiente de sala',
          hint: 'Sonido suave de fondo',
          icon: <Podcast size={17} />,
          active: ambience,
          run: toggleAmbience,
        },
        {
          id: 'exam',
          label: 'Modo examen',
          hint: 'Bloquea la pizarra y presenta',
          icon: <Presentation size={17} />,
          run: () => {
            const store = useLienzo.getState();
            if (!board.locked) {
              store.toggleBoardLock();
              store.startPresentation();
            } else {
              store.toggleBoardLock();
              store.exitPresentation();
            }
          },
        },
        {
          id: 'accessible',
          label: 'Modo accesible',
          hint: 'Texto grande y alto contraste',
          icon: <Accessibility size={17} />,
          active: accessible,
          run: () => setAccessible((value) => !value),
        },
      ],
    },
    {
      title: 'Sesión y documentos',
      tools: [
        {
          id: 'replay',
          label: 'Replay de sesión',
          hint: 'Graba, rebobina y exporta',
          icon: <Clapperboard size={17} />,
          active: recording,
          run: () => setDialog('replay'),
        },
        {
          id: 'compare',
          label: 'Comparador de tableros',
          hint: 'Dos pizarras lado a lado',
          icon: <Layers size={17} />,
          run: () => setDialog('compare'),
        },
        {
          id: 'doc',
          label: 'Doc ↔ pizarra',
          hint: 'Vista de documento e impresión',
          icon: <FileText size={17} />,
          run: () => setDialog('doc'),
        },
        {
          id: 'chronology',
          label: 'Cronología por persona',
          hint: 'Quién añadió qué',
          icon: <Users size={17} />,
          run: () => {
            const first = chronology[0];
            showToast(
              first
                ? `${first[0]}: ${first[1].length} elementos. Abre Replay para el detalle.`
                : 'Todavía no hay actividad registrada.',
              'info',
            );
          },
        },
      ],
    },
    {
      title: 'Apariencia',
      tools: [
        {
          id: 'texture-paper',
          label: 'Textura papel',
          hint: 'Líneas suaves',
          icon: <FileText size={17} />,
          active: board.texture === 'paper',
          run: () => setTexture(board.texture === 'paper' ? 'none' : 'paper'),
        },
        {
          id: 'texture-canvas',
          label: 'Textura lienzo',
          hint: 'Trama de tejido',
          icon: <Grid2X2 size={17} />,
          active: board.texture === 'canvas',
          run: () => setTexture(board.texture === 'canvas' ? 'none' : 'canvas'),
        },
        {
          id: 'texture-chalk',
          label: 'Textura pizarra',
          hint: 'Polvo de tiza',
          icon: <Palette size={17} />,
          active: board.texture === 'chalkboard',
          run: () => setTexture(board.texture === 'chalkboard' ? 'none' : 'chalkboard'),
        },
        {
          id: 'handwriting',
          label: 'Letra manuscrita',
          hint: 'Aplica a la selección de texto',
          icon: <Wand2 size={17} />,
          run: () => {
            const store = useLienzo.getState();
            const current = currentBoardOf(store);
            if (!current) return;
            const texts = current.items.filter(
              (item) =>
                selected.includes(item.id) &&
                (item.type === 'text' || item.type === 'sticky'),
            );
            if (texts.length === 0) {
              showToast('Selecciona textos o notas para cambiar la letra.', 'info');
              return;
            }
            store.pushHistory();
            store.updateItems(
              texts.map((item) => ({
                id: item.id,
                patch:
                  item.type === 'text'
                    ? { fontFamily: 'hand' as const }
                    : ({ fontFamily: 'hand' } as Record<string, unknown>),
              })),
            );
            showToast('Letra manuscrita aplicada.', 'success');
          },
        },
      ],
    },
  ];

  return (
    <aside className="v2-panel" aria-label="Laboratorio v2">
      <header>
        <span>
          <Sparkles size={15} /> Laboratorio
        </span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar laboratorio">
          <X size={15} />
        </button>
      </header>
      <p className="v2-note">
        Herramientas locales de la fase v2.0: datos, aula, sesión y accesibilidad.
      </p>
      {status ? <p className="v2-status">{status}</p> : null}
      <div className="v2-groups">
        {toolGroups.map((group) => (
          <section key={group.title}>
            <h4>{group.title}</h4>
            <div className="v2-grid">
              {group.tools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  className={tool.active ? 'is-active' : ''}
                  onClick={tool.run}
                  title={tool.hint}
                >
                  <span>{tool.icon}</span>
                  <strong>{tool.label}</strong>
                  <em>{tool.hint}</em>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {dialog ? (
        <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Herramienta v2">
          <div className="v2-dialog">
            <header>
              <strong>
                {dialog === 'chart' && 'Gráfico desde datos'}
                {dialog === 'embed' && 'Embed web permitido'}
                {dialog === 'assets' && 'Galería de assets'}
                {dialog === 'wireframe' && 'Kit de wireframe'}
                {dialog === 'roulette' && 'Dado y ruleta'}
                {dialog === 'sidekick' && 'Sidekick local / IA BYOK'}
                {dialog === 'replay' && 'Replay de sesión'}
                {dialog === 'compare' && 'Comparador de tableros'}
                {dialog === 'doc' && 'Doc ↔ pizarra'}
                {dialog === 'capture' && 'Grabar pantalla, cámara o documento'}
              </strong>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  if (recorderRef.current) stopRecorder();
                  setDialog(null);
                }}
                aria-label="Cerrar"
              >
                <X size={15} />
              </button>
            </header>

            {dialog === 'chart' ? (
              <div className="v2-body">
                <div className="v2-row">
                  {(['bar', 'line', 'pie'] as ChartKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className={chartKind === kind ? 'is-active' : ''}
                      onClick={() => setChartKind(kind)}
                    >
                      {kind === 'bar' ? 'Barras' : kind === 'line' ? 'Línea' : 'Tarta'}
                    </button>
                  ))}
                </div>
                <label className="field-label">
                  <span>Título</span>
                  <input
                    className="text-input"
                    value={chartTitle}
                    onChange={(event) => setChartTitle(event.target.value)}
                  />
                </label>
                <label className="field-label">
                  <span>Datos (CSV o TSV)</span>
                  <textarea
                    className="text-input"
                    rows={7}
                    value={chartData}
                    onChange={(event) => setChartData(event.target.value)}
                  />
                </label>
                <footer>
                  <button type="button" className="btn btn-primary" onClick={createChart}>
                    <BarChart3 size={14} /> Crear gráfico
                  </button>
                </footer>
              </div>
            ) : null}

            {dialog === 'embed' ? (
              <div className="v2-body">
                <p className="v2-note">
                  Permitidos: YouTube, Vimeo, Figma, Google Maps, Spotify, Google Docs,
                  Excalidraw, CodePen y SoundCloud.
                </p>
                <label className="field-label">
                  <span>URL del embed</span>
                  <input
                    className="text-input"
                    value={embedUrl}
                    onChange={(event) => setEmbedUrl(event.target.value)}
                    placeholder="https://www.figma.com/…"
                  />
                </label>
                <footer>
                  <button type="button" className="btn btn-primary" onClick={insertEmbed}>
                    <MonitorPlay size={14} /> Insertar tarjeta
                  </button>
                </footer>
              </div>
            ) : null}

            {dialog === 'assets' ? (
              <div className="v2-body">
                {ASSET_LIBRARY.map((group) => (
                  <div key={group.category}>
                    <h5>{group.category}</h5>
                    <div className="asset-grid">
                      {group.symbols.map((symbol) => (
                        <button
                          key={symbol}
                          type="button"
                          onClick={() => insertAsset(symbol)}
                          title={`Insertar ${symbol}`}
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {dialog === 'wireframe' ? (
              <div className="v2-body">
                <div className="wireframe-grid">
                  {(
                    [
                      ['browser', 'Navegador'],
                      ['mobile', 'Móvil'],
                      ['card', 'Tarjeta'],
                      ['button', 'Botón'],
                      ['input', 'Campo'],
                    ] as Array<[WireframeKind, string]>
                  ).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      className={wireframe === kind ? 'is-active' : ''}
                      onClick={() => {
                        setWireframe(kind);
                        insertWireframe(kind);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {dialog === 'roulette' ? (
              <div className="v2-body v2-center">
                <div className="roulette-result">{roulette ?? '—'}</div>
                <div className="v2-row">
                  <button type="button" className="btn btn-primary" onClick={spinRoulette}>
                    <Shuffle size={14} /> Girar ruleta
                  </button>
                  <button type="button" className="btn btn-soft" onClick={rollDice}>
                    <Dices size={14} /> Tirar dado
                  </button>
                </div>
                <p className="v2-note">Participantes: {[userName, ...peers.map((p) => p.name)].join(', ')}</p>
              </div>
            ) : null}

            {dialog === 'sidekick' ? (
              <div className="v2-body">
                <label className="field-label">
                  <span>Qué quieres organizar</span>
                  <textarea
                    className="text-input"
                    rows={3}
                    value={sidekickPrompt}
                    onChange={(event) => setSidekickPrompt(event.target.value)}
                  />
                </label>
                <div className="v2-ai-config">
                  <label className="field-label">
                    <span>Endpoint compatible OpenAI (opcional)</span>
                    <input
                      className="text-input"
                      value={aiConfig.endpoint}
                      onChange={(event) =>
                        setAiConfig((config) => ({ ...config, endpoint: event.target.value }))
                      }
                      placeholder="http://localhost:11434/v1/chat/completions"
                    />
                  </label>
                  <label className="field-label">
                    <span>Modelo</span>
                    <input
                      className="text-input"
                      value={aiConfig.model}
                      onChange={(event) =>
                        setAiConfig((config) => ({ ...config, model: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field-label">
                    <span>Clave (BYOK)</span>
                    <input
                      className="text-input"
                      type="password"
                      value={aiConfig.key}
                      onChange={(event) =>
                        setAiConfig((config) => ({ ...config, key: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <footer>
                  <button
                    type="button"
                    className="btn btn-soft"
                    onClick={() => {
                      localStorage.setItem(AI_KEY, JSON.stringify(aiConfig));
                      showToast('Configuración de IA guardada en este dispositivo.', 'success');
                    }}
                  >
                    <Check size={14} /> Guardar BYOK
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={aiBusy}
                    onClick={() => void runSidekick()}
                  >
                    <Bot size={14} /> {aiBusy ? 'Generando…' : 'Generar esquema'}
                  </button>
                </footer>
              </div>
            ) : null}

            {dialog === 'replay' ? (
              <div className="v2-body">
                <div className="v2-row">
                  <button
                    type="button"
                    className={recording ? 'btn btn-danger' : 'btn btn-primary'}
                    onClick={toggleRecording}
                  >
                    {recording ? <Square size={13} /> : <Play size={13} />}
                    {recording ? 'Detener grabación' : 'Grabar sesión'}
                  </button>
                  <span className="v2-badge">{snapshots.length} fotogramas</span>
                  <button type="button" className="btn btn-soft" onClick={exportReplay} disabled={snapshots.length === 0}>
                    <Download size={13} /> Exportar
                  </button>
                  <button type="button" className="btn btn-soft" onClick={restoreReplay} disabled={!activeSnapshot}>
                    <RotateCcw size={13} /> Aplicar
                  </button>
                </div>
                <canvas ref={previewRef} className="replay-canvas" />
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, snapshots.length - 1)}
                  value={cursor}
                  onChange={(event) => setCursor(Number(event.target.value))}
                  disabled={snapshots.length === 0}
                  aria-label="Línea de tiempo"
                />
                {activeSnapshot ? (
                  <p className="v2-note">
                    Fotograma {cursor + 1} de {snapshots.length} ·{' '}
                    {new Date(activeSnapshot.at).toLocaleTimeString('es-ES')}
                  </p>
                ) : (
                  <p className="v2-note">Pulsa Grabar sesión y trabaja: cada 2 segundos se guarda un fotograma.</p>
                )}
                <div className="heatmap">
                  {heatCells.map((cell) => (
                    <span
                      key={`${cell.x}:${cell.y}`}
                      style={{
                        left: `${Math.min(96, Math.max(0, (cell.x % 10) * 10))}%`,
                        top: `${Math.min(94, Math.max(0, (cell.y % 10) * 10))}%`,
                        opacity: 0.18 + cell.value * 0.7,
                      }}
                    />
                  ))}
                </div>
                <div className="chronology">
                  {chronology.map(([author, items]) => (
                    <div key={author}>
                      <strong>{author}</strong>
                      <span>{items.length} elementos · última edición {new Date(Math.max(...items.map((item) => item.updatedAt ?? 0))).toLocaleTimeString('es-ES')}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {dialog === 'compare' ? (
              <div className="v2-body">
                <label className="field-label">
                  <span>Comparar con</span>
                  <select
                    className="text-input"
                    value={compareId}
                    onChange={(event) => setCompareId(event.target.value)}
                  >
                    <option value="">Elige un tablero…</option>
                    {boards
                      .filter((candidate) => candidate.id !== board.id)
                      .map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="compare-grid">
                  <figure>
                    <canvas ref={compareARef} />
                    <figcaption>{board.name} · {board.items.length} elem.</figcaption>
                  </figure>
                  <figure>
                    {compareBoard ? (
                      <>
                        <canvas ref={compareBRef} />
                        <figcaption>{compareBoard.name} · {compareBoard.items.length} elem.</figcaption>
                      </>
                    ) : (
                      <div className="compare-empty">Elige una pizarra para comparar.</div>
                    )}
                  </figure>
                </div>
              </div>
            ) : null}

            {dialog === 'doc' ? (
              <div className="v2-body">
                <p className="v2-note">
                  Vista de documento del tablero con la jerarquía de marcos, notas y tablas.
                </p>
                <pre className="doc-preview">{boardToMarkdown(board)}</pre>
                <div className="v2-row">
                  <button
                    type="button"
                    className="btn btn-soft"
                    onClick={() => {
                      const blob = new Blob([boardToText(board)], {
                        type: 'text/plain;charset=utf-8',
                      });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `${board.name}.txt`;
                      link.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    <Download size={14} /> Texto plano
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                    <FileText size={14} /> Imprimir
                  </button>
                </div>
              </div>
            ) : null}

            {dialog === 'capture' ? (
              <div className="v2-body">
                <div className="v2-row">
                  {(['screen', 'webcam', 'document'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={captureMode === mode ? 'is-active' : ''}
                      onClick={() => {
                        streamRef.current?.getTracks().forEach((track) => track.stop());
                        streamRef.current = null;
                        setCaptureMode(mode);
                      }}
                    >
                      {mode === 'screen' ? 'Pantalla' : mode === 'webcam' ? 'Webcam' : 'Documento'}
                    </button>
                  ))}
                </div>
                <video ref={captureVideoRef} className="capture-video" muted playsInline />
                <div className="v2-row">
                  <button
                    type="button"
                    className={capturing ? 'btn btn-danger' : 'btn btn-primary'}
                    onClick={capturing ? stopRecorder : startRecorder}
                  >
                    {capturing ? <Square size={13} /> : <Video size={13} />}
                    {capturing ? 'Detener y guardar' : 'Grabar vídeo'}
                  </button>
                  <button type="button" className="btn btn-soft" onClick={() => void photo()}>
                    <ImageIcon size={13} /> Tomar foto
                  </button>
                </div>
                <p className="v2-note">
                  {captureMode === 'screen'
                    ? 'Elige una pestaña o ventana. La grabación se guarda como objeto de vídeo.'
                    : captureMode === 'document'
                      ? 'Apunta la cámara a la hoja y toma una foto para insertarla como imagen.'
                      : 'La webcam se puede grabar como vídeo o capturar como foto.'}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

// Iconos auxiliares usados solo en algunas tarjetas.
function Grid2X2({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
