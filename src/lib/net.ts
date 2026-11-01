import type { ServerInfo } from '../types';

export function isDesktop(): boolean {
  return Boolean(typeof window !== 'undefined' && window.lienzoDesktop?.isDesktop);
}

export function desktopServerBase(): string | null {
  if (typeof window === 'undefined') return null;
  return window.lienzoDesktop?.serverUrl ?? null;
}

export function defaultServerBase(): string {
  const desktop = desktopServerBase();
  if (desktop) return desktop;
  if (typeof window === 'undefined') return 'http://127.0.0.1:8787';
  const { protocol, hostname, port, origin } = window.location;
  if (protocol === 'file:') return 'http://127.0.0.1:8787';
  if (port === '8787' || port === '8788' || port === '8789') return origin;
  if (!hostname) return 'http://127.0.0.1:8787';
  return `${protocol}//${hostname}:8787`;
}

export function normalizeServerBase(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (value.startsWith('ws://')) value = `http://${value.slice(5)}`;
  if (value.startsWith('wss://')) value = `https://${value.slice(6)}`;
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  try {
    const url = new URL(value);
    if (!url.port) url.port = '8787';
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.origin;
  } catch {
    return null;
  }
}

export function wsUrlFromBase(base: string): string {
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = '';
  url.hash = '';
  return url.toString();
}

export async function fetchServerInfo(base?: string): Promise<ServerInfo | null> {
  const target = base ?? defaultServerBase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${target}/api/info`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as ServerInfo;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function lanShareUrl(base: string, boardId: string): string {
  try {
    const url = new URL(base);
    return `${url.origin}/#/b/${boardId}`;
  } catch {
    return `${base}/#/b/${boardId}`;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.focus();
      area.select();
      const result = document.execCommand('copy');
      area.remove();
      return result;
    } catch {
      return false;
    }
  }
}
