import { useEffect, useState } from 'react';
import { fetchApiBuildInfo } from '../utils/versionApi.ts';

import type { BuildInfo } from '../types/buildInfo.types.ts';

/** Load `/api/version` once so the footer can compare UI vs API SHA. */
export function useApiBuildInfo(): BuildInfo | null {
  const [apiBuildInfo, setApiBuildInfo] = useState<BuildInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchApiBuildInfo()
      .then((info) => {
        if (!cancelled) setApiBuildInfo(info);
      })
      .catch(() => {
        // Footer still shows the UI SHA if the version endpoint is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return apiBuildInfo;
}
