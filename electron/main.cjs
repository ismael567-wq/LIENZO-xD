const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { pathToFileURL } = require('node:url');

const REPO = 'ismael567-wq/LIENZO-xD';
const USER_AGENT = 'Lienzo-Desktop';

let mainWindow = null;
let serverInfo = null;

const debug = (...parts) => {
  if (!process.env.LIENZO_DEBUG) return;
  try {
    fs.appendFileSync(
      path.join(process.cwd(), 'electron-debug.log'),
      `${new Date().toISOString()} ${parts.join(' ')}\n`,
    );
  } catch {
    // Debug logging must never break startup.
  }
};

debug('boot', process.env.ELECTRON_RUN_AS_NODE, process.versions.electron);
debug('user-data', app.getPath('userData'));
app.on('before-quit', () => debug('before-quit'));

const gotLock = app.requestSingleInstanceLock();
debug('single-instance-lock', gotLock);
if (!gotLock) {
  app.quit();
}

async function startServer() {
  const serverModule = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'server-dist', 'collab.mjs')
    : path.join(__dirname, '..', 'server', 'collab.mjs');
  debug('server-import', serverModule);
  const { startCollabServer } = await import(pathToFileURL(serverModule).href);
  debug('server-imported');
  const staticDir = path.join(__dirname, '..', 'dist');
  const dataDir = path.join(app.getPath('userData'), 'boards');
  for (let port = 8787; port <= 8799; port += 1) {
    try {
      debug('server-try', port);
      const info = await startCollabServer({
        port,
        staticDir,
        dataDir,
        version: app.getVersion(),
      });
      debug('server-listening', port);
      return info;
    } catch (error) {
      debug('server-port-fail', port, error?.code ?? error?.message ?? String(error));
      if (error.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error('No hay puertos disponibles para la sala local.');
}

function createWindow() {
  const query = new URLSearchParams({
    desktop: '1',
    server: serverInfo ? `http://127.0.0.1:${serverInfo.port}` : '',
    lan: serverInfo?.lan?.[0] ?? '',
  });
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 940,
    minWidth: 980,
    minHeight: 660,
    backgroundColor: '#F4F1E8',
    title: 'Lienzo',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
      additionalArguments: [
        `--lienzo-server=${encodeURIComponent(query.get('server') ?? '')}`,
        `--lienzo-lan=${encodeURIComponent(query.get('lan') ?? '')}`,
      ],
    },
  });

  Menu.setApplicationMenu(null);
  const target = serverInfo ? `http://127.0.0.1:${serverInfo.port}` : null;
  if (target) mainWindow.loadURL(target);
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!target || !url.startsWith(target)) {
      if (/^https?:\/\//.test(url)) {
        event.preventDefault();
        shell.openExternal(url);
      }
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  debug('ready');
  try {
    serverInfo = await startServer();
    debug('server', serverInfo?.port, serverInfo?.lan?.join(','));
  } catch (error) {
    debug('server-error', error?.stack ?? String(error));
    console.error('[lienzo] no se pudo iniciar la sala local:', error);
  }
  createWindow();
  debug('window-created');
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error) => {
  debug('ready-error', error?.stack ?? String(error));
  console.error(error);
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  serverInfo?.close?.().catch(() => {});
});

ipcMain.handle('lienzo:version', () => app.getVersion());

ipcMain.handle('lienzo:latest-release', async () => {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`GitHub respondió ${response.status}.`);
  return response.json();
});

ipcMain.handle('lienzo:open-external', async (_event, url) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    throw new Error('URL no válida.');
  }
  await shell.openExternal(url);
});

ipcMain.handle('lienzo:install-update', async (_event, payload) => {
  const url = payload?.url;
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
    throw new Error('La actualización no tiene una URL válida.');
  }
  const safeName = String(payload?.name || 'Lienzo-Setup.exe').replace(/[^a-zA-Z0-9._-]/g, '_');
  const target = path.join(app.getPath('downloads'), safeName);

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`No se pudo descargar la actualización (${response.status}).`);
  }
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(target));

  // Launch the installer through the Windows shell so it runs with the user's
  // normal permissions. The wizard handles upgrades and preserves app data.
  const error = await shell.openPath(target);
  if (error) throw new Error(error);
  setTimeout(() => app.quit(), 1500);
  return { started: true };
});
