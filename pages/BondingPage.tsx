import React from 'react';
import { ArrowLeft } from 'lucide-react';
import AppFooter from '../components/AppFooter';
import LanguageToggle from '../components/LanguageToggle';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { useSiteLanguage } from '../hooks/useSiteLanguage';
import FlutterShaderBackground from '../flutterShader.tsx';

/**
 * Bonding route shell (Bước 1 placeholder).
 * Full Buy/Sell/claim UI lands in later steps — keep this free of stats/GLB imports.
 */
export default function BondingPage() {
  const { locale } = useSiteLanguage();

  usePageMetadata(
    'PRANA Bonding | PRANA Protocol',
    locale === 'en'
      ? 'Buy and sell PRANA bonds on Polygon — official PRANA Protocol bonding page.'
      : 'Mua và bán bond PRANA trên Polygon — trang bonding chính thức của PRANA Protocol.',
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050116] text-white">
      {/* Same fixed corner placement as homepage / staking shell */}
      <LanguageToggle />
      {/* Dimmer than homepage default so form content stays readable */}
      <FlutterShaderBackground brightness={0.32} />

      <main className="relative z-10 mx-auto flex max-w-5xl flex-col gap-8 px-4 py-16 sm:max-w-6xl sm:px-6 sm:py-20">
        <header className="space-y-4">
          <div className="space-y-3">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-white/45 transition hover:text-white/80"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {locale === 'en' ? 'Back to home' : 'Về trang chủ'}
            </a>
            <p className="text-sm uppercase tracking-[0.2em] text-white/45">
              PRANA Protocol
            </p>
            <h1 className="text-3xl font-medium tracking-wide sm:text-4xl">
              Bonding
            </h1>
            <p className="max-w-3xl text-[15px] text-white/70">
              {locale === 'en'
                ? 'Bonding UI is moving into the main app. Buy, sell, and claim flows will land here next.'
                : 'Giao diện Bonding đang được chuyển vào app chính. Flow mua, bán và claim sẽ xuất hiện tại đây.'}
            </p>
          </div>

          <a href="/" className="btn-hero btn-glass inline-flex w-fit">
            {locale === 'en' ? 'Protocol statistics' : 'Thống kê protocol'}
          </a>
        </header>
      </main>

      <AppFooter />
    </div>
  );
}
