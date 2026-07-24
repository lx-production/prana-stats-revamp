import React from 'react';
import { useSiteLanguage } from '../hooks/useSiteLanguage';
import { getAppBuildInfo } from '../utils/appBuildInfo.ts';
import { buildIdentityUrl, formatBuildLabel } from '../utils/buildInfoUrls.ts';
import {
  PRIVACY_PATH,
  TERMS_RISK_PATH,
  GUIDE_SWAP_CANONICAL_PATH,
  GUIDE_STAKING_CANONICAL_PATH,
} from '../constants/appRoutes.ts';

/**
 * Site footer: release tag when HEAD is tagged, otherwise short SHA.
 * Links to the GitHub release or commit baked into the UI build.
 * Machine checks can still use `GET /api/version` for the running Node process.
 */
const AppFooter: React.FC = () => {
  const { locale } = useSiteLanguage();
  const buildInfo = getAppBuildInfo();
  const href = buildIdentityUrl(buildInfo);
  const text = formatBuildLabel(buildInfo);
  // Hover shows full SHA even when the label is a tag.
  const title = buildInfo.tag
    ? `${buildInfo.tag} (${buildInfo.commit})`
    : buildInfo.commit;

  return (
    <footer className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-10 pt-2 sm:px-6 lg:px-8">
      <p className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-white/45">
        <a
          href={TERMS_RISK_PATH}
          className="underline-offset-2 hover:text-white/75 hover:underline"
        >
          {locale === 'en' ? 'Terms / Risk Disclosure' : 'Điều khoản / Công bố rủi ro'}
        </a>
        <span aria-hidden="true" className="text-white/25">
          ·
        </span>
        <a
          href={PRIVACY_PATH}
          className="underline-offset-2 hover:text-white/75 hover:underline"
        >
          {locale === 'en' ? 'Privacy Policy' : 'Chính sách quyền riêng tư'}
        </a>
        <span aria-hidden="true" className="text-white/25">
          ·
        </span>
        <a
          href={GUIDE_SWAP_CANONICAL_PATH}
          className="underline-offset-2 hover:text-white/75 hover:underline"
        >
          {locale === 'en' ? 'Swap guide' : 'Hướng dẫn Swap'}
        </a>
        <span aria-hidden="true" className="text-white/25">
          ·
        </span>
        <a
          href={GUIDE_STAKING_CANONICAL_PATH}
          className="underline-offset-2 hover:text-white/75 hover:underline"
        >
          {locale === 'en' ? 'Staking guide' : 'Hướng dẫn Staking'}
        </a>
      </p>
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
        )}{' '}
        by Triết Học Đường Phố with 💖
      </p>
    </footer>
  );
};

export default AppFooter;
