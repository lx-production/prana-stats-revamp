import { fetchJson } from './fetchJson.ts';

import type { BuildInfo } from '../types/buildInfo.types.ts';

/** Fetch the running Node process build identity from `/api/version`. */
export function fetchApiBuildInfo(): Promise<BuildInfo> {
  return fetchJson<BuildInfo>('/api/version');
}
