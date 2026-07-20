import React from 'react';
import { useSiteLanguage } from '../hooks/useSiteLanguage';

import type { LanguageToggleProps } from '../types/languageToggle.types';

/**
 * VI / EN site language control.
 * - `fixed` (default): homepage / legal shell corner placement
 * - `inline`: staking header row (flows with layout)
 */
const LanguageToggle: React.FC<LanguageToggleProps> = ({
  placement = 'fixed',
}) => {
  const { locale, setLocale } = useSiteLanguage();

  const shellClass =
    placement === 'fixed'
      ? 'fixed right-4 top-4 z-[60] pt-[max(0.25rem,env(safe-area-inset-top))] pr-[max(0.25rem,env(safe-area-inset-right))] shadow-lg'
      : 'relative z-10 shrink-0';

  return (
    <div
      className={`flex rounded-lg border border-white/15 bg-[#070b1f]/80 p-0.5 backdrop-blur-md ${shellClass}`}
      role="group"
      aria-label="Site language"
    >
      <button
        type="button"
        onClick={() => setLocale('vi')}
        className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
          locale === 'vi'
            ? 'bg-white/15 text-white'
            : 'text-white/55 hover:text-white/85'
        }`}
      >
        VI
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
          locale === 'en'
            ? 'bg-white/15 text-white'
            : 'text-white/55 hover:text-white/85'
        }`}
      >
        EN
      </button>
    </div>
  );
};

export default LanguageToggle;
