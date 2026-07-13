import React from 'react';
import { getAppBuildInfo } from '../utils/appBuildInfo.ts';
import { commitUrl, formatBuildSha } from '../utils/buildInfoUrls.ts';

/**
 * Site footer: one short SHA linking to the GitHub commit baked into the UI build.
 * Machine checks can still use `GET /api/version` for the running Node process.
 */
const AppFooter: React.FC = () => {
  const buildInfo = getAppBuildInfo();
  const href = commitUrl(buildInfo.repoUrl, buildInfo.commit);
  const text = formatBuildSha(buildInfo);

  return (
    <footer className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-10 pt-2 sm:px-6 lg:px-8">
      <p className="text-center text-xs text-white/35">
        Build{' '}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-white/55 underline-offset-2 hover:text-white/80 hover:underline"
            title={buildInfo.commit}
          >
            {text}
          </a>
        ) : (
          <span className="font-mono text-white/55" title={buildInfo.commit}>
            {text}
          </span>
        )}
      </p>
    </footer>
  );
};

export default AppFooter;
