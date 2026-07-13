import React from 'react';
import { useApiBuildInfo } from '../hooks/useApiBuildInfo.ts';
import { getAppBuildInfo } from '../utils/appBuildInfo.ts';
import { commitUrl, formatBuildSha } from '../utils/buildInfoUrls.ts';

import type { BuildInfo } from '../types/buildInfo.types.ts';

/** One muted SHA link (and optional dirty marker) for the footer. */
function ShaLink({ info, label }: { info: BuildInfo; label: string }) {
  const href = commitUrl(info.repoUrl, info.commit);
  const text = formatBuildSha(info);

  return (
    <span>
      {label}{' '}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-white/55 underline-offset-2 hover:text-white/80 hover:underline"
          title={info.commit}
        >
          {text}
        </a>
      ) : (
        <span className="font-mono text-white/55" title={info.commit}>
          {text}
        </span>
      )}
    </span>
  );
}

/**
 * Site footer: shows the Vite-injected UI SHA and the live `/api/version` SHA
 * so anyone can confirm prod matches a public GitHub commit.
 */
const AppFooter: React.FC = () => {
  const uiBuildInfo = getAppBuildInfo();
  const apiBuildInfo = useApiBuildInfo();

  return (
    <footer className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-10 pt-2 sm:px-6 lg:px-8">
      <p className="text-center text-xs text-white/35">
        <ShaLink info={uiBuildInfo} label="Build" />
        {apiBuildInfo ? (
          <>
            <span className="mx-2 text-white/20" aria-hidden="true">
              ·
            </span>
            <ShaLink info={apiBuildInfo} label="API" />
          </>
        ) : null}
      </p>
    </footer>
  );
};

export default AppFooter;
