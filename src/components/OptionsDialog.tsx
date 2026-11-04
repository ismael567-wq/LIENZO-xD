import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Grid3X3,
  Loader2,
  Magnet,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useLienzo } from '../store/boardStore';
import { hasPendingUpdate, useUpdates } from '../store/updateStore';
import { openExternal } from '../lib/updates';
import { Modal } from './Modal';

function statusLabel(status: ReturnType<typeof useUpdates.getState>['status']) {
  switch (status) {
    case 'checking':
      return 'Comprobando si hay una versión nueva…';
    case 'current':
      return 'Estás al día. No hay actualizaciones pendientes.';
    case 'available':
      return 'Hay una actualización disponible.';
    case 'installing':
      return 'Descargando e iniciando el instalador…';
    case 'error':
      return 'No se pudo comprobar la actualización.';
    default:
      return 'Lienzo comprueba si hay actualizaciones al iniciar.';
  }
}

export function OptionsDialog() {
  const open = useLienzo((state) => state.ui.options);
  const setUi = useLienzo((state) => state.setUi);
  const theme = useLienzo((state) => state.theme);
  const toggleTheme = useLienzo((state) => state.toggleTheme);
  const gridSize = useLienzo((state) => state.gridSize);
  const setGridSize = useLienzo((state) => state.setGridSize);
  const snapToGrid = useLienzo((state) => state.snapToGrid);
  const setSnapToGrid = useLienzo((state) => state.setSnapToGrid);

  const status = useUpdates((state) => state.status);
  const current = useUpdates((state) => state.current);
  const latest = useUpdates((state) => state.latest);
  const release = useUpdates((state) => state.release);
  const error = useUpdates((state) => state.error);
  const pending = useUpdates(hasPendingUpdate);
  const check = useUpdates((state) => state.check);
  const install = useUpdates((state) => state.install);

  if (!open) return null;

  const busy = status === 'checking' || status === 'installing';
  const isDesktop = Boolean(window.lienzoDesktop?.isDesktop);

  return (
    <Modal
      title="Opciones"
      eyebrow="Tu espacio, a tu manera"
      subtitle="Apariencia, lienzo y actualizaciones de Lienzo."
      onClose={() => setUi('options', false)}
      size="md"
    >
      <div className="options-stack">
        <section className="options-section">
          <div className="options-section-head">
            <h3>Apariencia</h3>
            <span>Se guarda en este dispositivo</span>
          </div>
          <div className="options-row">
            <div className="options-copy">
              <strong>Tema {theme === 'dark' ? 'oscuro' : 'claro'}</strong>
              <p>Cambia la interfaz y el lienzo al instante.</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              {theme === 'dark' ? 'Usar claro' : 'Usar oscuro'}
            </button>
          </div>
        </section>

        <section className="options-section">
          <div className="options-section-head">
            <h3>Lienzo</h3>
            <span>Ajustes de dibujo</span>
          </div>
          <div className="options-row">
            <div className="options-copy">
              <strong>Ajustar a cuadrícula</strong>
              <p>Alinea notas, formas y conectores a la rejilla.</p>
            </div>
            <button
              type="button"
              className={`options-toggle ${snapToGrid ? 'is-on' : ''}`}
              role="switch"
              aria-checked={snapToGrid}
              onClick={() => setSnapToGrid(!snapToGrid)}
            >
              <Magnet size={14} />
              {snapToGrid ? 'Activado' : 'Desactivado'}
            </button>
          </div>
          <div className="options-row options-row-wrap">
            <div className="options-copy">
              <strong>Tamaño de cuadrícula</strong>
              <p>Define la separación de la rejilla del lienzo.</p>
            </div>
            <div className="grid-size-row">
              {[16, 24, 32, 48].map((size) => (
                <button
                  key={size}
                  type="button"
                  className={gridSize === size ? 'is-active' : ''}
                  onClick={() => setGridSize(size)}
                  title={`Cuadrícula de ${size} px`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={`options-section update-section ${pending ? 'has-update' : ''}`}>
          <div className="options-section-head">
            <h3>
              <RefreshCw size={16} /> Actualizaciones
            </h3>
            <span>{isDesktop ? 'Windows · escritorio' : 'Navegador'}</span>
          </div>

          <div className="update-card">
            <div className="update-card-main">
              <span className="update-version">Versión {current || '…'}</span>
              <p>{statusLabel(status)}</p>
            </div>
            <span className={`update-pill is-${status}`}>
              {status === 'checking' || status === 'installing' ? (
                <Loader2 size={13} className="spin" />
              ) : status === 'available' ? (
                <Sparkles size={13} />
              ) : status === 'current' ? (
                <CheckCircle2 size={13} />
              ) : status === 'error' ? (
                <AlertCircle size={13} />
              ) : (
                <RefreshCw size={13} />
              )}
              {status === 'checking'
                ? 'Comprobando'
                : status === 'installing'
                  ? 'Instalando'
                  : status === 'available'
                    ? 'Nueva versión'
                    : status === 'current'
                      ? 'Al día'
                      : status === 'error'
                        ? 'Sin conexión'
                        : 'Automático'}
            </span>
          </div>

          {pending && latest ? (
            <div className="update-release">
              <div>
                <strong>Lienzo {latest} ya está disponible</strong>
                <p>
                  Descarga la nueva versión y tus tableros se conservarán. La app se cerrará
                  durante la instalación.
                </p>
              </div>
              <div className="update-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void install()}
                  disabled={busy}
                >
                  <Download size={15} />
                  {status === 'installing'
                    ? 'Descargando…'
                    : isDesktop
                      ? 'Descargar e instalar'
                      : 'Descargar instalador'}
                </button>
                {release ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void openExternal(release.url)}
                  >
                    <ExternalLink size={15} />
                    Ver en GitHub
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="update-error">
              <AlertCircle size={14} /> {error}
            </p>
          ) : null}

          <div className="update-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void check()}
              disabled={busy}
            >
              <RefreshCw size={15} className={status === 'checking' ? 'spin' : ''} />
              {status === 'checking' ? 'Comprobando…' : 'Buscar actualizaciones'}
            </button>
            {release ? (
              <button
                type="button"
                className="text-link"
                onClick={() => void openExternal(release.url)}
              >
                <ExternalLink size={14} /> Notas de la versión
              </button>
            ) : null}
          </div>
        </section>

        <p className="options-footnote">
          <Grid3X3 size={13} /> Lienzo guarda tus tableros en este dispositivo. Las
          actualizaciones solo reemplazan la aplicación, nunca tus datos.
        </p>
      </div>
    </Modal>
  );
}
