import { currentBoardOf, useLienzo } from '../store/boardStore';
import { saveBoards, saveFolders } from './storage';
import { autoSnapshot } from './versions';

let timer: ReturnType<typeof setTimeout> | null = null;

export function attachPersistence(): () => void {
  const unsubscribe = useLienzo.subscribe((state, previous) => {
    if (!state.ready) return;
    if (state.boards === previous.boards && state.folders === previous.folders) return;
    if (timer) clearTimeout(timer);
    useLienzo.setState({ saveStatus: 'saving' });
    timer = setTimeout(async () => {
      timer = null;
      const state = useLienzo.getState();
      await saveBoards(state.boards);
      saveFolders(state.folders);
      useLienzo.setState({ saveStatus: 'saved' });
      const board = currentBoardOf(useLienzo.getState());
      if (board) void autoSnapshot(board);
    }, 450);
  });
  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
