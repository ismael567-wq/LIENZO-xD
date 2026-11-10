/**
 * Grabación de voz local. Usa MediaRecorder y decodifica el clip para extraer
 * una forma de onda compacta que se dibuja en la nota de voz del lienzo.
 */
export interface RecordingResult {
  blob: Blob;
  mime: string;
  duration: number;
  waveform: number[];
}

export interface ActiveRecording {
  stop: () => Promise<RecordingResult>;
  cancel: () => void;
}

const BARS = 48;

async function waveformFromBlob(blob: Blob): Promise<number[]> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return [];
    const audio = new Ctx();
    const buffer = await audio.decodeAudioData(arrayBuffer.slice(0));
    const channel = buffer.getChannelData(0);
    const bucket = Math.max(1, Math.floor(channel.length / BARS));
    const peaks: number[] = [];
    for (let index = 0; index < BARS; index += 1) {
      let max = 0;
      const start = index * bucket;
      for (let cursor = start; cursor < start + bucket && cursor < channel.length; cursor += 1) {
        const value = Math.abs(channel[cursor]);
        if (value > max) max = value;
      }
      peaks.push(Number(max.toFixed(3)));
    }
    const loudest = Math.max(0.05, ...peaks);
    await audio.close();
    return peaks.map((peak) => Number((peak / loudest).toFixed(3)));
  } catch {
    return [];
  }
}

export async function startRecording(): Promise<ActiveRecording> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no permite grabar audio.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const preferred = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ].find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
  const chunks: BlobPart[] = [];
  const startedAt = performance.now();
  let settled = false;
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
  });
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };
  recorder.start(150);
  const stopTracks = () => stream.getTracks().forEach((track) => track.stop());

  return {
    stop: async () => {
      if (recorder.state !== 'inactive') recorder.stop();
      await stopped;
      stopTracks();
      const mime = recorder.mimeType || preferred || 'audio/webm';
      const blob = new Blob(chunks, { type: mime });
      const duration = Math.max(1, Math.round((performance.now() - startedAt) / 1000));
      const waveform = await waveformFromBlob(blob);
      return { blob, mime, duration, waveform };
    },
    cancel: () => {
      settled = true;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // El grabador pudo detenerse solo.
      }
      stopTracks();
    },
  };
}

export async function playbackUrl(fileId: string): Promise<string | null> {
  const { loadStoredFile } = await import('./files');
  const blob = await loadStoredFile(fileId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function fakeWaveform(seed = 1): number[] {
  const values: number[] = [];
  for (let index = 0; index < BARS; index += 1) {
    const value = 0.25 + Math.abs(Math.sin((index + seed) * 0.7)) * 0.7;
    values.push(Number(value.toFixed(3)));
  }
  return values;
}
