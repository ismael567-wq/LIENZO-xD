import { useCallback, useEffect, useState } from 'react';
import { Clock3, History, RotateCcw, Save } from 'lucide-react';
import { currentBoardOf, useLienzo } from '../store/boardStore';
import { formatVersionTime, loadVersions, saveVersion, type BoardVersion } from '../lib/versions';
import { Modal } from './Modal';

export function HistoryDialog() {
  const open = useLienzo((state) => state.ui.history);
  const setUi = useLienzo((state) => state.setUi);
  const board = useLienzo((state) => currentBoardOf(state));
  const restoreSnapshot = useLienzo((state) => state.restoreSnapshot);
  const showToast = useLienzo((state) => state.showToast);
  const [versions, setVersions] = useState<BoardVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (boardId: string) => {
    setLoading(true);
    const stored = await loadVersions(boardId);
    setVersions(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open || !board) return;
    void refresh(board.id);
  }, [open, board?.id, refresh]);

  if (!open || !board) return null;

  const close = () => setUi('history', false);

  const snapshotNow = async () => {
    const next = await saveVersion(board, 'Versión manual', { force: true });
    setVersions(next);
    showToast('Versión guardada en el historial.', 'success');
  };

  const restore = (version: BoardVersion) => {
    if (
      !window.confirm(
        `¿Restaurar «${version.label}» de ${formatVersionTime(version.at)}? Podrás deshacerlo con Ctrl+Z.`,
      )
    ) {
      return;
    }
    restoreSnapshot(version.snapshot, version.label);
    close();
  };

  return (
    <Modal
      title="Historial de versiones"
      eyebrow="Nunca pierdas el hilo"
      subtitle="tiza guarda una instantánea automática cada pocos minutos y hasta 24 versiones por pizarra."
      onClose={close}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={close}>
            Cerrar
          </button>
          <button type="button" className="btn btn-primary" onClick={snapshotNow}>
            <Save size={15} /> Guardar versión ahora
          </button>
        </>
      }
    >
      <div className="version-list">
        {loading ? (
          <p className="version-empty">Cargando versiones…</p>
        ) : versions.length === 0 ? (
          <div className="version-empty">
            <History size={26} />
            <strong>Todavía no hay versiones</strong>
            <p>Se crearán automáticamente mientras editas esta pizarra.</p>
          </div>
        ) : (
          versions.map((version) => (
            <article key={version.id} className="version-item">
              <div className="version-copy">
                <strong>{version.label}</strong>
                <span>
                  <Clock3 size={12} /> {formatVersionTime(version.at)} ·{' '}
                  {version.snapshot.items.length} elementos
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => restore(version)}
              >
                <RotateCcw size={14} /> Restaurar
              </button>
            </article>
          ))
        )}
      </div>
    </Modal>
  );
}
