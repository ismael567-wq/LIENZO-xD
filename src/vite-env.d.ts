/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  lienzoDesktop?: {
    isDesktop: boolean;
    serverUrl: string;
    lanUrl: string | null;
    platform: string;
    getVersion: () => Promise<string>;
    fetchLatestRelease: () => Promise<unknown>;
    openExternal: (url: string) => Promise<void>;
    installUpdate: (payload: {
      url: string;
      name: string;
    }) => Promise<{ started: boolean }>;
  };
}

declare const __APP_VERSION__: string;
