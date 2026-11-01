const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

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
