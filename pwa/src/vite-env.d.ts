/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="@lofipix/ui/icons/types" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WEB_URL: string;
  readonly VITE_POWERSYNC_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
