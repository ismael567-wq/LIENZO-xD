export const REPO = 'ismael567-wq/LIENZO-xD';
export const RELEASES_URL = `https://github.com/${REPO}/releases`;

export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
}

export interface ReleaseInfo {
  tag: string;
  name: string;
  url: string;
  notes: string;
  publishedAt: string | null;
  assets: ReleaseAsset[];
}

export interface UpdateCheck {
  current: string;
  latest: string;
  available: boolean;
  release: ReleaseInfo | null;
  checkedAt: number;
}

function normalize(version: string): { parts: number[]; pre: string } {
  const clean = version.trim().replace(/^v/i, '');
  const [core, pre = ''] = clean.split('-', 2);
  const parts = core.split('.').map((part) => {
    const value = Number.parseInt(part.replace(/\D.*$/, ''), 10);
    return Number.isFinite(value) ? value : 0;
  });
  while (parts.length < 3) parts.push(0);
  return { parts, pre };
}

/** Compares two semantic versions. Returns 1 when `a` is newer, -1 when older, 0 when equal. */
export function compareVersions(a: string, b: string): number {
  const left = normalize(a);
  const right = normalize(b);
  const length = Math.max(left.parts.length, right.parts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left.parts[index] ?? 0) - (right.parts[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  if (left.pre === right.pre) return 0;
  if (!left.pre) return 1;
  if (!right.pre) return -1;
  return left.pre.localeCompare(right.pre, undefined, { numeric: true });
}

function normalizeRelease(raw: unknown): ReleaseInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const tag = String(source.tag_name ?? source.tag ?? '');
  if (!tag) return null;
  const assets = Array.isArray(source.assets) ? source.assets : [];
  return {
    tag,
    name: String(source.name ?? tag),
    url: String(source.html_url ?? source.url ?? `${RELEASES_URL}/tag/${tag}`),
    notes: String(source.body ?? ''),
    publishedAt: source.published_at ? String(source.published_at) : null,
    assets: assets
      .filter((asset): asset is Record<string, unknown> => Boolean(asset) && typeof asset === 'object')
      .map((asset) => ({
        name: String(asset.name ?? ''),
        url: String(asset.browser_download_url ?? asset.url ?? ''),
        size: Number(asset.size ?? 0),
      })),
  };
}

export function currentVersion(): string {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
}

export async function resolveVersion(): Promise<string> {
  try {
    const desktopVersion = await window.lienzoDesktop?.getVersion?.();
    if (desktopVersion) return desktopVersion;
  } catch {
    // Fall back to the version compiled into the bundle.
  }
  return currentVersion();
}

async function fetchRelease(): Promise<ReleaseInfo> {
  if (window.lienzoDesktop?.fetchLatestRelease) {
    const release = normalizeRelease(await window.lienzoDesktop.fetchLatestRelease());
    if (!release) throw new Error('La respuesta de GitHub no es válida.');
    return release;
  }

  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`GitHub respondió ${response.status}.`);
  const release = normalizeRelease(await response.json());
  if (!release) throw new Error('La respuesta de GitHub no es válida.');
  return release;
}

export async function checkForUpdates(): Promise<UpdateCheck> {
  const [version, release] = await Promise.all([resolveVersion(), fetchRelease()]);
  return {
    current: version,
    latest: release.tag,
    available: compareVersions(release.tag, version) > 0,
    release,
    checkedAt: Date.now(),
  };
}

export function preferredAsset(release: ReleaseInfo | null): ReleaseAsset | null {
  if (!release) return null;
  const assets = release.assets.filter((asset) => asset.url);
  return (
    assets.find((asset) => /setup/i.test(asset.name) && /\.exe$/i.test(asset.name)) ??
    assets.find((asset) => /\.exe$/i.test(asset.name)) ??
    assets[0] ??
    null
  );
}

export async function openExternal(url: string): Promise<void> {
  if (window.lienzoDesktop?.openExternal) {
    await window.lienzoDesktop.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function installRelease(asset: ReleaseAsset): Promise<{ started: boolean }> {
  if (window.lienzoDesktop?.installUpdate) {
    return window.lienzoDesktop.installUpdate({ url: asset.url, name: asset.name });
  }
  await openExternal(asset.url);
  return { started: false };
}
