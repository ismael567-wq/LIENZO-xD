import { describe, expect, it } from 'vitest';
import { compareVersions, preferredAsset, type ReleaseInfo } from '../src/lib/updates';

function release(assets: Array<{ name: string; url: string; size?: number }>): ReleaseInfo {
  return {
    tag: 'v1.2.1',
    name: 'Lienzo 1.2.1',
    url: 'https://github.com/ismael567-wq/LIENZO-xD/releases/tag/v1.2.1',
    notes: '',
    publishedAt: null,
    assets: assets.map((asset) => ({ size: 0, ...asset })),
  };
}

describe('compareVersions', () => {
  it('detects a newer patch version', () => {
    expect(compareVersions('1.2.1', '1.2.0')).toBe(1);
    expect(compareVersions('v1.2.0', '1.2.1')).toBe(-1);
  });

  it('treats equal versions as equal', () => {
    expect(compareVersions('1.2.1', 'v1.2.1')).toBe(0);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
  });

  it('ranks a stable release above its prerelease', () => {
    expect(compareVersions('1.2.1', '1.2.1-beta.1')).toBe(1);
    expect(compareVersions('1.2.1-beta.1', '1.2.1')).toBe(-1);
  });

  it('compares prerelease identifiers numerically', () => {
    expect(compareVersions('1.2.1-beta.2', '1.2.1-beta.10')).toBe(-1);
  });

  it('ignores a leading v and trailing metadata', () => {
    expect(compareVersions('v2.0.0', '1.9.9')).toBe(1);
  });
});

describe('preferredAsset', () => {
  it('prefers the Windows setup installer over the portable build', () => {
    const asset = preferredAsset(
      release([
        { name: 'Lienzo-1.2.1-portable.exe', url: 'https://example.com/portable.exe' },
        { name: 'Lienzo-Setup-1.2.1.exe', url: 'https://example.com/setup.exe' },
      ]),
    );
    expect(asset?.name).toBe('Lienzo-Setup-1.2.1.exe');
  });

  it('falls back to any executable when there is no setup', () => {
    const asset = preferredAsset(
      release([{ name: 'Lienzo-1.2.1-portable.exe', url: 'https://example.com/portable.exe' }]),
    );
    expect(asset?.name).toBe('Lienzo-1.2.1-portable.exe');
  });

  it('returns null when there is no release', () => {
    expect(preferredAsset(null)).toBeNull();
  });
});
