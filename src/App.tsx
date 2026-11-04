import { useEffect } from 'react';
import { useLienzo, currentBoardOf } from './store/boardStore';
import { attachPersistence } from './lib/persistence';
import { Dashboard } from './components/Dashboard';
import { BoardView } from './components/BoardView';
import { ShareDialog } from './components/ShareDialog';
import {
  AboutDialog,
  CommandPalette,
  NewBoardDialog,
  ShortcutsDialog,
  TemplateDialog,
} from './components/dialogs';
import { Toast } from './components/Toast';
import { Logo } from './components/Logo';
import { OptionsDialog } from './components/OptionsDialog';
import { useUpdates } from './store/updateStore';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-logo">
        <Logo size={54} />
        <div className="loading-ring" />
      </div>
      <h1>Lienzo</h1>
      <p>Preparando tu espacio visual…</p>
    </div>
  );
}

export default function App() {
  const ready = useLienzo((state) => state.ready);
  const board = useLienzo((state) => currentBoardOf(state));
  const init = useLienzo((state) => state.init);

  useEffect(() => {
    void init();
    void useUpdates.getState().init();
    const detach = attachPersistence();
    return detach;
  }, [init]);

  useEffect(() => {
    const onHashChange = () => {
      const match = window.location.hash.match(/^#\/b\/(.+)$/);
      const state = useLienzo.getState();
      if (match) {
        if (state.boards.some((board) => board.id === match[1])) {
          if (state.boardId !== match[1]) state.openBoard(match[1]);
        }
      } else if (state.boardId) {
        state.closeBoard();
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const state = useLienzo.getState();
        state.setUi('command', !state.ui.command);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!ready || !board) return;
    const timer = setTimeout(() => {
      void useLienzo.getState().autoConnectIfServed();
    }, 420);
    return () => clearTimeout(timer);
  }, [ready, board?.id]);

  if (!ready) return <LoadingScreen />;

  return (
    <div className="app">
      {board ? <BoardView /> : <Dashboard />}
      <NewBoardDialog />
      <TemplateDialog />
      <ShareDialog />
      <CommandPalette />
      <ShortcutsDialog />
      <AboutDialog />
      <OptionsDialog />
      <Toast />
    </div>
  );
}
