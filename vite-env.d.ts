/// <reference types="vite/client" />

import type { BuildInfo } from './types/buildInfo.types.ts';

declare module "*?raw" {
  const content: string;
  export default content;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}

declare global {
  /** Injected by `config/vite.config.js` via `define`. */
  const __APP_BUILD_INFO__: BuildInfo;
}

export {};
