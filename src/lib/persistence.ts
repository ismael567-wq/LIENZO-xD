import { useLienzo } from '../store/boardStore';
import { saveBoards } from './storage';

let timer: ReturnType<typeof setTimeout> | null = null;

export function attachPersistence(): () => void {
  const unsubscribe = useLienzo.subscribe((state, previous) => {
    if (!state.ready) return;
    if (state.boards === previous.boards) return;
    if (timer) clearTimeout(timer);
    useLienzo.setState({ saveStatus: 'saving' });
    timer = setTimeout(async () => {
      timer = null;
      await saveBoards(useLienzo.getState().boards);
      useLienzo.setState({ saveStatus: 'saved' });
    }, 450);
  });
  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
