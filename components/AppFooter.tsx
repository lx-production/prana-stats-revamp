import React from 'react';
import { getAppBuildInfo } from '../utils/appBuildInfo.ts';
import { buildIdentityUrl, formatBuildLabel } from '../utils/buildInfoUrls.ts';

/**
 * Site footer: release tag when HEAD is tagged, otherwise short SHA.
 * Links to the GitHub release or commit baked into the UI build.
 * Machine checks can still use `GET /api/version` for the running Node process.
 */
const AppFooter: React.FC = () => {
  const buildInfo = getAppBuildInfo();
  const href = buildIdentityUrl(buildInfo);
  const text = formatBuildLabel(buildInfo);
  // Hover shows full SHA even when the label is a tag.
  const title = buildInfo.tag
    ? `${buildInfo.tag} (${buildInfo.commit})`
    : buildInfo.commit;

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
            title={title}
          >
            {text}
          </a>
        ) : (
          <span className="font-mono text-white/55" title={title}>
            {text}
          </span>
        )}
      </p>
    </footer>
  );
};

export default AppFooter;
