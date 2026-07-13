import type { BuildInfo } from '../types/buildInfo.types.ts';

/**
 * Frontend build identity injected by Vite (`config/vite.config.js` → `define`).
 * Falls back to a safe stub when the define is missing (e.g. odd test runners).
 */
export function getAppBuildInfo(): BuildInfo {
  if (typeof __APP_BUILD_INFO__ !== 'undefined') {
    return __APP_BUILD_INFO__;
  }

  return {
    commit: 'unknown',
    commitShort: 'unknown',
    branch: 'unknown',
    dirty: false,
    builtAt: '',
    repoUrl: 'https://github.com/lx-production/prana-stats-revamp',
  };
}
