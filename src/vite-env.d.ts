/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  lienzoDesktop?: {
    isDesktop: boolean;
    serverUrl: string;
    lanUrl: string | null;
    platform: string;
  };
}
