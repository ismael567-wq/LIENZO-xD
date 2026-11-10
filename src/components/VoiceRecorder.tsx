import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, Check, Loader2, X } from 'lucide-react';
import type { VoiceNote } from '../types';
import { startRecording, type ActiveRecording } from '../lib/audio';
import { playSound } from '../lib/sound';
import { saveStoredFile } from '../lib/files';
import { uid } from '../lib/geometry';

interface VoiceRecorderProps {
  title?: string;
  author?: string;
  onCancel: () => void;
  onSaved: (note: VoiceNote) => void;
}

export function VoiceRecorder({ title = 'Nota de voz', author, onCancel, onSaved }: VoiceRecorderProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'review' | 'saving'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    blob: Blob;
    mime: string;
    duration: number;
    waveform: number[];
    url: string;
  } | null>(null);
  const recorderRef = useRef<ActiveRecording | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.cancel();
      if (result?.url) URL.revokeObjectURL(result.url);
    };
    // El clip de revisión se libera al desmontar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = async () => {
    setError(null);
    try {
      const recorder = await startRecording();
      recorderRef.current = recorder;
      setSeconds(0);
      setState('recording');
      playSound('tap');
      timerRef.current = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo acceder al micrófono.');
    }
  };

  const finish = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    setState('saving');
    try {
      const recording = await recorder.stop();
      recorderRef.current = null;
      const url = URL.createObjectURL(recording.blob);
      setResult({ ...recording, url });
      setState('review');
      playSound('success');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La grabación falló.');
      setState('idle');
    }
  };

  const discard = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    recorderRef.current?.cancel();
    recorderRef.current = null;
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    setSeconds(0);
    setState('idle');
  };

  const save = async () => {
    if (!result) return;
    setState('saving');
    const fileId = `voice-${uid(10)}`;
    try {
      await saveStoredFile(fileId, result.blob);
      onSaved({
        fileId,
        mime: result.mime,
        duration: result.duration,
        waveform: result.waveform,
        author,
        createdAt: Date.now(),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el audio.');
      setState('review');
    }
  };

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label={title}>
      <div className="voice-recorder">
        <header>
          <span>
            <Mic size={16} /> {title}
          </span>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Cerrar">
            <X size={14} />
          </button>
        </header>

        <div className={`voice-wave ${state === 'recording' ? 'is-live' : ''}`} aria-hidden="true">
          {Array.from({ length: 32 }, (_, index) => {
            const level =
              state === 'recording'
                ? 0.2 + Math.abs(Math.sin((Date.now() / 260 + index) * 0.8)) * 0.8
                : result?.waveform[index * 1] ?? 0.08;
            return <span key={index} style={{ height: `${Math.max(6, level * 44)}px` }} />;
          })}
        </div>

        <p className="voice-status">
          {state === 'idle' ? 'Pulsa grabar y habla con calma.' : null}
          {state === 'recording' ? `Grabando… ${seconds}s` : null}
          {state === 'saving' ? (
            <>
              <Loader2 size={13} className="spin" /> Guardando audio…
            </>
          ) : null}
          {state === 'review'
            ? `Listo: ${result?.duration ?? 0}s · ${Math.round((result?.blob.size ?? 0) / 1024)} KB`
            : null}
        </p>

        {result ? <audio src={result.url} controls className="voice-player" /> : null}
        {error ? <p className="voice-error">{error}</p> : null}

        <footer>
          {state === 'recording' ? (
            <button type="button" className="btn btn-primary" onClick={() => void finish()}>
              <Square size={14} /> Detener
            </button>
          ) : null}
          {state === 'idle' ? (
            <button type="button" className="btn btn-primary" onClick={() => void begin()}>
              <Mic size={14} /> Grabar
            </button>
          ) : null}
          {state === 'review' ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={discard}>
                <Trash2 size={14} /> Repetir
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void save()}>
                <Check size={14} /> Guardar
              </button>
            </>
          ) : null}
          {state === 'saving' ? (
            <button type="button" className="btn btn-ghost" disabled>
              <Loader2 size={14} className="spin" /> Un momento…
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
