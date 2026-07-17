import { resolveBuildInfo } from '../../utils/resolveBuildInfo.ts';

import type { BuildInfo } from '../../types/buildInfo.types.ts';

// Resolve once at process start so every `/api/version` response matches this checkout.
const processBuildInfo: BuildInfo = resolveBuildInfo();

/** Running Node server identity (git tag + SHA at process start). */
export function loadVersionInfo(): BuildInfo {
  return processBuildInfo;
}
