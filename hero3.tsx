import React, { useRef, useState } from "react";
import Covenants from "./components/Covenants";
import SwapModal from "./features/swap/SwapModal";
import { useSiteLanguage } from "./hooks/useSiteLanguage";
import { useHeroHeadlines } from "./hooks/useHeroHeadlines";
import { useHeroCoinModel } from "./hooks/useHeroCoinModel";
import { STAKE_CANONICAL_PATH } from "./constants/appRoutes";

export default function PranaHero() {
  const { locale } = useSiteLanguage();
  const heroHeadlines = useHeroHeadlines();
  const { mvRef, mvReady, onKeyDown, spinCoin, coinStyle, coinModelUrl, cameraOrbitAttr, cameraRadiusClamp } = useHeroCoinModel();

  const heroRef = useRef<HTMLElement | null>(null);
  const [isCovenantsOpen, setIsCovenantsOpen] = useState(false);
  const [isSwapOpen, setIsSwapOpen] = useState(false);

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden text-white pb-[env(safe-area-inset-bottom)]"
      aria-label="PRANA hero section with interactive coin"
    >

      {/* Coin block */}
      <div className="relative flex items-center justify-center">
        <div
          role="img"
          aria-label="Interactive PRANA coin. Drag or use arrow keys to control."
          tabIndex={0}
          onKeyDown={onKeyDown}
          onClick={spinCoin}
          className="outline-none focus-visible:ring-2 focus-visible:ring-[#F5D27A]/60 rounded-2xl"
        >
          {mvReady ? (
            React.createElement("model-viewer", {
              ref: mvRef,
              src: coinModelUrl,
              poster: "/prana-coin-fallback.png",
              "camera-orbit": cameraOrbitAttr,
              "min-camera-orbit": cameraRadiusClamp,
              "max-camera-orbit": cameraRadiusClamp,
              "camera-controls": true,
              "interaction-prompt": "none",
              exposure: "1",
              "shadow-intensity": "0",
              "auto-rotate": true,
              "auto-rotate-delay": "0",
              "rotation-per-second": "10deg",
              style: coinStyle,
            })
          ) : (
            <img
              src="/prana-coin-fallback.png"
              alt="PRANA coin (static fallback)"
              style={coinStyle}
              className="select-none"
            />
          )}
        </div>
      </div>

      {/* Copy & CTAs */}
      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center mt-8">
        <h1 className="text-3xl font-medium tracking-wide">
          {heroHeadlines.title}
        </h1><br />
        <h2 className="text-3xl font-medium tracking-wide">
          {heroHeadlines.subtitle}
        </h2>
        <p className="mt-6 text-[15px] text-white/70">
          {heroHeadlines.tagline}
        </p>

        <div className="mt-12 flex flex-col sm:flex-row gap-4 sm:justify-center">
          <button
            type="button"
            onClick={() => setIsSwapOpen(true)}
            className="btn-hero btn-gold-border"
          >
            SWAP
          </button>
          <a
            href={STAKE_CANONICAL_PATH}
            title="Lãi suất cố định 15% APR"
            className="btn-hero btn-glass"
          >
            STAKE
          </a>
          <a
            href="https://prana.triethocduongpho.net/bond/"
            target="_blank"
            rel="noopener"
            className="btn-hero btn-glass"
          >
            BOND (OTC)
          </a>
          <button
            type="button"
            onClick={() => setIsCovenantsOpen(true)}
            className="btn-hero btn-glass"
          >
            {locale === "en" ? "COVENANTS" : "GIAO ƯỚC"}
          </button>
        </div>
      </div>
      <Covenants
        isOpen={isCovenantsOpen}
        onClose={() => setIsCovenantsOpen(false)}
      />
      <SwapModal
        isOpen={isSwapOpen}
        onClose={() => setIsSwapOpen(false)}
      />
    </section>
  );
}
