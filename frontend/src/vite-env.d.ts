/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute backend URL. Empty (default) uses the dev-server proxy. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
