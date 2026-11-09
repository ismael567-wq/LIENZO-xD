import { del, get, set } from 'idb-keyval';
import type { FileItem } from '../types';

const FOLDER = 'tiza-files';
const KEY_PREFIX = 'lienzo:file:';
const CHUNK_SIZE = 4 * 1024 * 1024;

interface WritableStreamLike {
  write: (data: Blob | ArrayBuffer | Uint8Array) => Promise<void>;
  close: () => Promise<void>;
  truncate?: (size: number) => Promise<void>;
}

interface FileHandleLike {
  getFile: () => Promise<File>;
  createWritable: () => Promise<WritableStreamLike>;
}

interface DirHandleLike {
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<DirHandleLike>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileHandleLike>;
  removeEntry: (name: string, options?: { recursive?: boolean }) => Promise<void>;
}

const idbKey = (fileId: string) => `${KEY_PREFIX}${fileId}`;

function opfsStorage(): { getDirectory?: () => Promise<DirHandleLike> } | null {
  if (typeof navigator === 'undefined') return null;
  const storage = navigator.storage as unknown as {
    getDirectory?: () => Promise<DirHandleLike>;
  };
  return storage && typeof storage.getDirectory === 'function' ? storage : null;
}

async function opfsDir(create = false): Promise<DirHandleLike | null> {
  const storage = opfsStorage();
  if (!storage?.getDirectory) return null;
  try {
    const root = await storage.getDirectory();
    return await root.getDirectoryHandle(FOLDER, { create });
  } catch {
    return null;
  }
}

/**
 * Guarda un binario en OPFS troceado. Si OPFS no está disponible (Safari
 * antiguo, modo privado) cae a IndexedDB, que también soporta Blob.
 */
export async function saveStoredFile(
  fileId: string,
  blob: Blob,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  const dir = await opfsDir(true);
  if (dir) {
    try {
      const handle = await dir.getFileHandle(fileId, { create: true });
      const writable = await handle.createWritable();
      const total = Math.max(1, Math.ceil(blob.size / CHUNK_SIZE));
      for (let index = 0; index < total; index += 1) {
        const start = index * CHUNK_SIZE;
        const end = Math.min(blob.size, start + CHUNK_SIZE);
        await writable.write(blob.slice(start, end));
        onProgress?.((index + 1) / total);
      }
      await writable.close();
      return;
    } catch {
      // Fall through to IndexedDB.
    }
  }
  await set(idbKey(fileId), blob);
  onProgress?.(1);
}

export async function hasStoredFile(fileId: string): Promise<boolean> {
  const dir = await opfsDir();
  if (dir) {
    try {
      const handle = await dir.getFileHandle(fileId);
      await handle.getFile();
      return true;
    } catch {
      // Try IndexedDB.
    }
  }
  try {
    return Boolean(await get<Blob>(idbKey(fileId)));
  } catch {
    return false;
  }
}

export async function loadStoredFile(fileId: string): Promise<Blob | null> {
  const dir = await opfsDir();
  if (dir) {
    try {
      const handle = await dir.getFileHandle(fileId);
      const file = await handle.getFile();
      if (file.size > 0) return file;
    } catch {
      // Try IndexedDB.
    }
  }
  try {
    const blob = await get<Blob>(idbKey(fileId));
    return blob ?? null;
  } catch {
    return null;
  }
}

export async function deleteStoredFile(fileId: string): Promise<void> {
  const dir = await opfsDir();
  if (dir) {
    try {
      await dir.removeEntry(fileId);
    } catch {
      // Ignore missing entries.
    }
  }
  try {
    await del(idbKey(fileId));
  } catch {
    // Ignore.
  }
}

export async function readStoredFileAsText(fileId: string): Promise<string> {
  const blob = await loadStoredFile(fileId);
  if (!blob) return '';
  return blob.text();
}

export function guessFileKind(mime: string, name: string): FileItem['kind'] {
  const lower = name.toLowerCase();
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(lower)) return 'video';
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/.test(lower)) {
    return 'audio';
  }
  if (mime.includes('csv') || lower.endsWith('.csv')) return 'csv';
  if (mime.includes('spreadsheet') || /\.(xlsx?|ods)$/.test(lower)) return 'sheet';
  if (
    mime.includes('word') ||
    mime.includes('presentation') ||
    /\.(docx?|pptx?|odt|odp|rtf)$/.test(lower)
  ) {
    return 'doc';
  }
  return 'file';
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/** Crea una URL local para abrir o descargar el archivo guardado. */
export async function storedFileUrl(fileId: string): Promise<string | null> {
  const blob = await loadStoredFile(fileId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function downloadStoredFile(fileId: string, name: string): Promise<void> {
  const url = await storedFileUrl(fileId);
  if (!url) throw new Error('El archivo no está disponible en este dispositivo.');
  const link = document.createElement('a');
  link.href = url;
  link.download = name || 'archivo';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function openStoredFile(fileId: string): Promise<void> {
  const url = await storedFileUrl(fileId);
  if (!url) throw new Error('El archivo no está disponible en este dispositivo.');
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* -------------------------------------------------------------------------- */
/* Sincronización de archivos por la LAN (nota técnica 73)                     */
/* -------------------------------------------------------------------------- */

export async function uploadFileToServer(
  baseUrl: string,
  fileId: string,
  blob: Blob,
  onProgress?: (ratio: number) => void,
  mime?: string,
): Promise<void> {
  const base = baseUrl.replace(/\/$/, '');
  const total = Math.max(1, Math.ceil(blob.size / CHUNK_SIZE));
  for (let index = 0; index < total; index += 1) {
    const start = index * CHUNK_SIZE;
    const end = Math.min(blob.size, start + CHUNK_SIZE);
    const response = await fetch(`${base}/api/files/${encodeURIComponent(fileId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-chunk-index': String(index),
        'x-chunk-total': String(total),
        ...(mime ? { 'x-file-mime': mime } : {}),
      },
      body: blob.slice(start, end),
    });
    if (!response.ok) throw new Error('No se pudo subir el archivo a la sala.');
    onProgress?.((index + 1) / total);
  }
}

export async function downloadFileFromServer(
  baseUrl: string,
  fileId: string,
): Promise<Blob | null> {
  const base = baseUrl.replace(/\/$/, '');
  try {
    const response = await fetch(`${base}/api/files/${encodeURIComponent(fileId)}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

/** Si el binario no existe en local, lo pide a la sala y lo guarda en OPFS. */
export async function ensureLocalFile(
  fileId: string,
  baseUrl?: string | null,
): Promise<Blob | null> {
  const local = await loadStoredFile(fileId);
  if (local) return local;
  if (!baseUrl) return null;
  const remote = await downloadFileFromServer(baseUrl, fileId);
  if (!remote) return null;
  await saveStoredFile(fileId, remote);
  return remote;
}
