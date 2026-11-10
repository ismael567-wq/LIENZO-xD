export type SoundKind = 'tap' | 'pop' | 'success' | 'join' | 'leave' | 'reveal';

const STORAGE_KEY = 'lienzo:sounds:v1';
let cached: AudioContext | null = null;

export function soundsEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) !== 'off';
}

export function setSoundsEnabled(value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
}

function context(): AudioContext | null {
  if (typeof window === 'undefined' || !soundsEnabled()) return null;
  if (cached) return cached;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  cached = new Ctx();
  return cached;
}

/** Sonidos breves generados en el cliente; sin archivos ni red. */
export function playSound(kind: SoundKind = 'tap'): void {
  const audio = context();
  if (!audio) return;
  const now = audio.currentTime;
  const plan: Record<SoundKind, { frequencies: number[]; duration: number; gain: number; type: OscillatorType }> = {
    tap: { frequencies: [520], duration: 0.06, gain: 0.05, type: 'sine' },
    pop: { frequencies: [380, 680], duration: 0.12, gain: 0.09, type: 'triangle' },
    success: { frequencies: [523.25, 659.25, 783.99], duration: 0.34, gain: 0.08, type: 'sine' },
    join: { frequencies: [440, 587.33], duration: 0.22, gain: 0.07, type: 'sine' },
    leave: { frequencies: [392, 261.63], duration: 0.24, gain: 0.06, type: 'sine' },
    reveal: { frequencies: [330, 494, 660], duration: 0.28, gain: 0.07, type: 'triangle' },
  };
  const { frequencies, duration, gain: peak, type } = plan[kind];
  try {
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    gain.connect(audio.destination);
    frequencies.forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.07);
      oscillator.connect(gain);
      oscillator.start(now + index * 0.07);
      oscillator.stop(now + duration + 0.05);
    });
  } catch {
    // Some browsers block audio without a gesture; silence is acceptable.
  }
}
