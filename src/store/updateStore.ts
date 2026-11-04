import { create } from 'zustand';
import {
  checkForUpdates,
  installRelease,
  preferredAsset,
  resolveVersion,
  type ReleaseInfo,
} from '../lib/updates';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'installing'
  | 'error';

interface UpdateStore {
  status: UpdateStatus;
  current: string;
  latest: string | null;
  release: ReleaseInfo | null;
  error: string | null;
  checkedAt: number | null;
  dismissed: string | null;
  init: () => Promise<void>;
  check: () => Promise<void>;
  dismiss: () => void;
  install: () => Promise<void>;
}

export const useUpdates = create<UpdateStore>((set, get) => ({
  status: 'idle',
  current: '',
  latest: null,
  release: null,
  error: null,
  checkedAt: null,
  dismissed: null,

  init: async () => {
    const current = await resolveVersion();
    set({ current });
    window.setTimeout(() => {
      void get().check();
    }, 1800);
  },

  check: async () => {
    if (get().status === 'checking' || get().status === 'installing') return;
    set({ status: 'checking', error: null });
    try {
      const result = await checkForUpdates();
      set({
        status: result.available ? 'available' : 'current',
        current: result.current,
        latest: result.latest,
        release: result.release,
        checkedAt: result.checkedAt,
        error: null,
      });
    } catch (error) {
      set({
        status: 'error',
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo comprobar si hay actualizaciones.',
      });
    }
  },

  dismiss: () => set({ dismissed: get().latest }),

  install: async () => {
    const asset = preferredAsset(get().release);
    if (!asset) {
      set({ error: 'No hay un instalador disponible para este sistema.' });
      return;
    }
    set({ status: 'installing', error: null });
    try {
      const result = await installRelease(asset);
      if (!result.started) set({ status: 'available' });
    } catch (error) {
      set({
        status: 'available',
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo iniciar la actualización.',
      });
    }
  },
}));

/** True when a newer version is known and the user has not dismissed it. */
export function hasPendingUpdate(state: UpdateStore): boolean {
  return state.status === 'available' && Boolean(state.latest) && state.dismissed !== state.latest;
}
