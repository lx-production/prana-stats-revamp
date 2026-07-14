import React, { useRef, useState } from "react";
import Covenants from "./components/Covenants";
import SwapModal from "./components/SwapModal";
import { useSiteLanguage } from "./hooks/useSiteLanguage";
import { useHeroHeadlines } from "./hooks/useHeroHeadlines";
import { useHeroCoinModel } from "./hooks/useHeroCoinModel";

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
          <a
            href="https://prana.triethocduongpho.net/stake/" target="_blank" rel="noopener"
            title="Lãi suất cố định 15% APR"
            className="inline-flex min-w-[200px] justify-center rounded-2xl px-10 py-3 border border-[#7A5410]/40 bg-[linear-gradient(120deg,#FBE9A7_0%,#F4D46E_18%,#D6A13A_38%,#F7DE84_58%,#B77B22_100%)] text-[#2B1B05] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-10px_18px_rgba(120,73,0,0.45),0_14px_30px_rgba(0,0,0,0.35)] ring-1 ring-[#FCE8A9]/40 hover:border-[#9A6B1A]/55 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-12px_20px_rgba(120,73,0,0.55),0_18px_40px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition duration-300"
          >
            STAKE
          </a>
          <a
            href="https://prana.triethocduongpho.net/bond/" target="_blank" rel="noopener"
            className="inline-flex min-w-[200px] justify-center rounded-2xl px-10 py-3 border border-white/20 bg-gradient-to-b from-white/15 via-white/8 to-white/5 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-lg ring-1 ring-white/15 hover:border-white/40 hover:bg-white/10 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_16px_38px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition duration-300"
          >
            BOND (OTC)
          </a>
          <button
            type="button"
            onClick={() => setIsSwapOpen(true)}
            className="inline-flex min-w-[200px] justify-center rounded-2xl px-10 py-3 border border-white/20 bg-gradient-to-b from-white/15 via-white/8 to-white/5 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-lg ring-1 ring-white/15 hover:border-white/40 hover:bg-white/10 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_16px_38px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition duration-300"
          >
            SWAP
          </button>
          <button
            type="button"
            onClick={() => setIsCovenantsOpen(true)}
            className="inline-flex min-w-[200px] justify-center rounded-2xl px-10 py-3 border border-white/20 bg-gradient-to-b from-white/15 via-white/8 to-white/5 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-lg ring-1 ring-white/15 hover:border-white/40 hover:bg-white/10 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_16px_38px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition duration-300"
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
