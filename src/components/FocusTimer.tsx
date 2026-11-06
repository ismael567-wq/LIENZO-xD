import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, TimerReset, X } from 'lucide-react';
import { useLienzo } from '../store/boardStore';

const PRESETS = [15, 25, 50] as const;

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function FocusTimer() {
  const timer = useLienzo((state) => state.timer);
  const toggleTimer = useLienzo((state) => state.toggleTimer);
  const resetTimer = useLienzo((state) => state.resetTimer);
  const startTimer = useLienzo((state) => state.startTimer);
  const finishTimer = useLienzo((state) => state.finishTimer);
  const closeTimer = useLienzo((state) => state.closeTimer);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timer.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timer.running]);

  const remaining = timer.running
    ? Math.max(0, (timer.endsAt ?? now) - now)
    : timer.remaining;

  useEffect(() => {
    if (timer.running && remaining <= 0) finishTimer();
  }, [timer.running, remaining, finishTimer]);

  const progress = useMemo(() => {
    const total = timer.duration * 60 * 1000;
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, 1 - remaining / total));
  }, [remaining, timer.duration]);

  if (!timer.visible) return null;

  return (
    <aside className="focus-timer" aria-label="Temporizador de foco">
      <header className="focus-timer-head">
        <span>
          <TimerReset size={15} /> Foco
        </span>
        <button type="button" onClick={closeTimer} aria-label="Cerrar temporizador">
          <X size={15} />
        </button>
      </header>
      <div className="focus-timer-time" aria-live="polite">
        {format(remaining)}
      </div>
      <div
        className="focus-timer-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="focus-timer-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={toggleTimer}
        >
          {timer.running ? <Pause size={14} /> : <Play size={14} />}
          {timer.running ? 'Pausar' : remaining === 0 ? 'Repetir' : 'Seguir'}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={resetTimer}
          aria-label="Reiniciar temporizador"
          title="Reiniciar"
        >
          <RotateCcw size={15} />
        </button>
      </div>
      <div className="focus-timer-presets" aria-label="Duraciones rápidas">
        {PRESETS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className={timer.duration === minutes ? 'is-active' : ''}
            onClick={() => startTimer(minutes)}
          >
            {minutes} min
          </button>
        ))}
      </div>
    </aside>
  );
}
