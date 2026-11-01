import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileJson,
  Image as ImageIcon,
  Link2,
  Loader2,
  Monitor,
  QrCode,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import QRCode from 'qrcode';
import type { Board } from '../types';
import { currentBoardOf, useLienzo } from '../store/boardStore';
import { copyToClipboard, defaultServerBase, normalizeServerBase } from '../lib/net';
import { exportBoardJSON, exportBoardPNG } from '../lib/export';
import { parseBoardFile } from '../lib/storage';
import { Modal } from './Modal';
import { initials } from './Logo';

type Tab = 'live' | 'export' | 'import';

export function ShareDialog() {
  const open = useLienzo((state) => state.ui.share);
  const board = useLienzo((state) => currentBoardOf(state));
  const setUi = useLienzo((state) => state.setUi);
  const collab = useLienzo((state) => state.collab);
  const connectCollab = useLienzo((state) => state.connectCollab);
  const disconnectCollab = useLienzo((state) => state.disconnectCollab);
  const refreshServerInfo = useLienzo((state) => state.refreshServerInfo);
  const showToast = useLienzo((state) => state.showToast);
  const userName = useLienzo((state) => state.userName);
  const [tab, setTab] = useState<Tab>('live');
  const [serverInput, setServerInput] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTab('live');
    setCopied(false);
    setImportError(null);
    const initial =
      collab.localServerUrl ??
      window.lienzoDesktop?.serverUrl ??
      defaultServerBase();
    setServerInput(initial);
    void refreshServerInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const lanBase =
    collab.lanUrls[0] ?? window.lienzoDesktop?.lanUrl ?? null;
  const shareBase = lanBase ?? collab.localServerUrl ?? serverInput;
  const link = board && shareBase ? `${shareBase}/#/b/${board.id}` : '';
  const isLoopback = /localhost|127\.0\.0\.1/.test(shareBase);

  useEffect(() => {
    let cancelled = false;
    if (!open || !link || tab !== 'live') {
      setQr(null);
      return;
    }
    QRCode.toDataURL(link, {
      margin: 1,
      width: 320,
      errorCorrectionLevel: 'M',
      color: { dark: '#0E5B4F', light: '#FFFDF7' },
    })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, link, tab]);

  if (!open || !board) return null;

  const close = () => setUi('share', false);
  const copyLink = async () => {
    const ok = await copyToClipboard(link);
    setCopied(ok);
    showToast(
      ok ? 'Enlace de la sala copiado.' : 'No se pudo copiar el enlace.',
      ok ? 'success' : 'error',
    );
    setTimeout(() => setCopied(false), 1800);
  };

  const startRoom = async () => {
    const normalized = normalizeServerBase(serverInput);
    if (!normalized) {
      showToast('La dirección del servidor no es válida.', 'error');
      return;
    }
    setServerInput(normalized);
    await connectCollab(normalized);
    await refreshServerInfo();
  };

  const doImport = async (file: File) => {
    try {
      const text = await file.text();
      const imported = parseBoardFile(text);
      useLienzo.getState().importBoard(imported);
      close();
      showToast(`«${imported.name}» importado.`, 'success');
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : 'No se pudo importar el archivo.',
      );
    }
  };

  return (
    <Modal
      title="Compartir tablero"
      eyebrow="Colabora sin nube"
      subtitle="Invita a tu equipo en la misma red local o llévate una copia."
      onClose={close}
      size="lg"
    >
      <div className="share-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'live'}
          className={tab === 'live' ? 'is-active' : ''}
          onClick={() => setTab('live')}
        >
          <Wifi size={15} /> Sala en vivo
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'export'}
          className={tab === 'export' ? 'is-active' : ''}
          onClick={() => setTab('export')}
        >
          <Download size={15} /> Exportar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'import'}
          className={tab === 'import' ? 'is-active' : ''}
          onClick={() => setTab('import')}
        >
          <FileJson size={15} /> Importar
        </button>
      </div>

      {tab === 'live' ? (
        <div className="share-live">
          <div className={`room-status is-${collab.status}`}>
            <span className="room-status-icon">
              {collab.status === 'on' ? (
                <Wifi size={17} />
              ) : collab.status === 'connecting' ? (
                <Loader2 size={17} className="spin" />
              ) : collab.status === 'error' ? (
                <WifiOff size={17} />
              ) : (
                <ShieldCheck size={17} />
              )}
            </span>
            <div>
              <strong>
                {collab.status === 'on'
                  ? 'Sala local activa'
                  : collab.status === 'connecting'
                    ? 'Conectando a la sala…'
                    : collab.status === 'error'
                      ? 'No se pudo abrir la sala'
                      : 'Modo local'}
              </strong>
              <span>
                {collab.status === 'on'
                  ? `${collab.peers.length + 1} persona${collab.peers.length === 0 ? '' : 's'} conectada${collab.peers.length === 0 ? '' : 's'} · sin salir de tu red`
                  : collab.status === 'error'
                    ? collab.error ?? 'Revisa que el servidor de sala esté activo.'
                    : 'Tus cambios se guardan en este dispositivo. Activa una sala para colaborar.'}
              </span>
            </div>
            {collab.status === 'on' ? (
              <button type="button" className="btn btn-soft btn-sm" onClick={disconnectCollab}>
                Detener
              </button>
            ) : collab.status === 'connecting' ? null : (
              <button type="button" className="btn btn-primary btn-sm" onClick={startRoom}>
                Iniciar sala
              </button>
            )}
          </div>

          {collab.status === 'on' ? (
            <>
              <div className="share-link-card">
                <div className="share-qr">
                  {qr ? (
                    <img src={qr} alt="Código QR para abrir el tablero en el móvil" />
                  ) : (
                    <div className="qr-placeholder">
                      <QrCode size={30} />
                      <span>Generando QR…</span>
                    </div>
                  )}
                  <span className="share-qr-hint">
                    <Smartphone size={13} /> Escanea con el móvil
                  </span>
                </div>
                <div className="share-link-info">
                  <span className="eyebrow">Enlace de la sala</span>
                  <div className="share-link-value">
                    <Link2 size={15} />
                    <input readOnly value={link} onFocus={(event) => event.target.select()} />
                    <button type="button" className="btn btn-soft btn-sm" onClick={copyLink}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <p>
                    Abre este enlace desde cualquier dispositivo de tu red. Lienzo funciona en
                    web, móvil y escritorio. Los cambios se sincronizan en tiempo real.
                  </p>
                  {isLoopback ? (
                    <div className="share-warning">
                      <Monitor size={14} />
                      Estás usando una dirección local. Para el móvil, sustituye <code>localhost</code>{' '}
                      por la IP de tu equipo o usa el QR.
                    </div>
                  ) : null}
                  <div className="share-people">
                    <span className="avatar" style={{ background: collab.selfColor }}>
                      {initials(userName)}
                    </span>
                    {collab.peers.map((peer) => (
                      <span
                        key={peer.id}
                        className="avatar"
                        style={{ background: peer.color }}
                        title={peer.name}
                      >
                        {initials(peer.name)}
                      </span>
                    ))}
                    <small>
                      <Users size={12} /> {collab.peers.length + 1} en la sala
                    </small>
                  </div>
                </div>
              </div>

              <details className="share-advanced">
                <summary>Servidor y puerto</summary>
                <div className="share-server-row">
                  <input
                    value={serverInput}
                    onChange={(event) => setServerInput(event.target.value)}
                    placeholder={defaultServerBase()}
                    aria-label="Dirección del servidor de sala"
                  />
                  <button type="button" className="btn btn-soft btn-sm" onClick={startRoom}>
                    <RefreshCw size={14} /> Reconectar
                  </button>
                </div>
                <p>
                  Por defecto Lienzo usa el puerto <code>8787</code>. En escritorio, el servidor se
                  inicia automáticamente. En web, ejecuta <code>npm run server</code>.
                </p>
              </details>
            </>
          ) : (
            <div className="share-start">
              <div className="share-start-icon">
                <Share2 size={24} />
              </div>
              <h3>Colabora en tu propia red</h3>
              <p>
                Inicia una sala local y comparte el QR. Sin cuentas, sin servidores externos y sin
                que tus tableros salgan de tu red.
              </p>
              <div className="share-server-row">
                <input
                  value={serverInput}
                  onChange={(event) => setServerInput(event.target.value)}
                  placeholder="http://192.168.1.10:8787"
                  aria-label="Dirección del servidor de sala"
                />
                <button type="button" className="btn btn-primary" onClick={startRoom}>
                  Iniciar sala
                </button>
              </div>
              {collab.status === 'error' ? (
                <div className="share-error">
                  <WifiOff size={15} />
                  <div>
                    <strong>El servidor no responde.</strong>
                    <p>
                      En una terminal del proyecto ejecuta:
                      <code>npm run server</code>
                      y vuelve a intentarlo. En escritorio no necesitas hacer nada.
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="share-perks">
                <span><Wifi size={14} /> Tiempo real en LAN</span>
                <span><ShieldCheck size={14} /> Sin nube</span>
                <span><Users size={14} /> Cursor y presencia</span>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'export' ? (
        <div className="share-export">
          <button
            type="button"
            className="export-card"
            onClick={async () => {
              try {
                await exportBoardPNG(board);
                showToast('PNG exportado.', 'success');
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'Error al exportar.', 'error');
              }
            }}
          >
            <span className="export-icon"><ImageIcon size={22} /></span>
            <div>
              <strong>Imagen PNG</strong>
              <p>Todo el tablero en alta resolución, perfecto para presentar o imprimir.</p>
            </div>
            <Download size={17} />
          </button>
          <button
            type="button"
            className="export-card"
            onClick={() => {
              exportBoardJSON(board);
              showToast('Archivo Lienzo exportado.', 'success');
            }}
          >
            <span className="export-icon"><FileJson size={22} /></span>
            <div>
              <strong>Archivo Lienzo (.json)</strong>
              <p>El tablero completo y editable. Ideal para compartir o respaldar.</p>
            </div>
            <Download size={17} />
          </button>
          <p className="share-export-note">
            Los archivos se generan en tu dispositivo. Nada se sube a internet.
          </p>
        </div>
      ) : null}

      {tab === 'import' ? (
        <div className="share-import">
          <div
            className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) void doImport(file);
            }}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter') fileRef.current?.click();
            }}
          >
            <FileJson size={30} />
            <strong>Arrastra un archivo .lienzo.json</strong>
            <span>o haz clic para elegirlo</span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void doImport(file);
            }}
          />
          {importError ? <div className="share-error">{importError}</div> : null}
          <p className="share-export-note">
            Importar crea una copia nueva en este dispositivo y la abre. No sobrescribe tableros
            existentes.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
