const { contextBridge, ipcRenderer } = require('electron');

function argument(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  if (!found) return '';
  try {
    return decodeURIComponent(found.slice(prefix.length));
  } catch {
    return '';
  }
}

const serverUrl = argument('lienzo-server');
const lanUrl = argument('lienzo-lan');

contextBridge.exposeInMainWorld('lienzoDesktop', {
  isDesktop: true,
  serverUrl,
  lanUrl: lanUrl || null,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('lienzo:version'),
  fetchLatestRelease: () => ipcRenderer.invoke('lienzo:latest-release'),
  openExternal: (url) => ipcRenderer.invoke('lienzo:open-external', url),
  installUpdate: (payload) => ipcRenderer.invoke('lienzo:install-update', payload),
});
