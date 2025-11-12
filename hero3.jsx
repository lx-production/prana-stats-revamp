import { useEffect, useMemo, useRef, useState } from "react";

const COIN_MODEL_URL = new URL("./prana.glb", import.meta.url).href;

/**
 * On-Chain Mandala — PRANA hero section
 * React + Tailwind, dark-first, mobile-native.
 *
 * This component auto-loads <model-viewer> from a CDN so you can preview
 * without editing <head>. Replace href/src URLs and CTA links as needed.
 */

// Hook: load the <model-viewer> web component
function useModelViewer() {
  const [ready, setReady] = useState(() => !!customElements.get("model-viewer"));
  useEffect(() => {
    if (ready) return;
    const existing = document.querySelector('script[data-prana-mv]');
    if (existing) {
      existing.addEventListener("load", () => setReady(true), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.type = "module";
    s.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    s.setAttribute("data-prana-mv", "");
    s.addEventListener("load", () => setReady(true), { once: true });
    s.addEventListener("error", () => setReady(false), { once: true });
    document.head.appendChild(s);
  }, [ready]);
  return ready;
}

export default function PranaHero() {
  const mvReady = useModelViewer();
  const heroRef = useRef(null);
  const mvRef = useRef(null);
  const haloRef = useRef(null);

  // Breath pulse on click/tap
  const pulse = () => {
    const halo = haloRef.current;
    if (!halo) return;
    halo.animate(
      [
        { transform: "scale(1)", opacity: 0.28 },
        { transform: "scale(1.08)", opacity: 0.45 },
        { transform: "scale(1)", opacity: 0.28 },
      ],
      { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
  };

  // Idle orientation snap after 6s of no interaction
  useEffect(() => {
    const mv = mvRef.current;
    if (!mv) return;
    let idleTimer;
    const snap = () => (mv.cameraOrbit = "20deg 70deg 110%");
    const reset = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(snap, 6000);
    };
    mv.addEventListener("pointerdown", reset);
    mv.addEventListener("pointerup", reset);
    mv.addEventListener("camera-change", reset);
    reset();
    return () => {
      clearTimeout(idleTimer);
      mv.removeEventListener("pointerdown", reset);
      mv.removeEventListener("pointerup", reset);
      mv.removeEventListener("camera-change", reset);
    };
  }, [mvReady]);

  // Keyboard access: ←/→ rotate, Enter pulses
  const onKeyDown = (e) => {
    if (!mvRef.current) return;
    if (e.key === "Enter") {
      pulse();
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      try {
        const mv = mvRef.current;
        const orbit = mv.getCameraOrbit ? mv.getCameraOrbit() : null;
        if (orbit) {
          const delta = e.key === "ArrowLeft" ? -5 : 5; // deg
          const thetaDeg = orbit.theta * (180 / Math.PI) + delta;
          const phiDeg = orbit.phi * (180 / Math.PI);
          const radiusPct = Math.round(orbit.radius * 100);
          mv.cameraOrbit = `${thetaDeg.toFixed(1)}deg ${phiDeg.toFixed(1)}deg ${radiusPct}%`;
        }
      } catch {}
    }
  };

  // Sizes
  const coinStyle = useMemo(() => ({
    width: "min(92vw, 880px)",
    height: "56vh",
  }), []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-[92vh] overflow-hidden bg-gradient-to-b from-[#050116] via-[#060323] to-[#02010b] text-white pb-[env(safe-area-inset-bottom)]"
      aria-label="PRANA hero section with interactive coin"
    >

      {/* Vignette overlay for edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 1200px at 50% 50%, rgba(34,18,88,0.2) 25%, rgba(6,3,22,0.78) 100%)",
        }}
      />

      {/* Soft halo bloom behind coin */}
      <div
        ref={haloRef}
        className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 blur-3xl opacity-30"
        style={{
          width: 680,
          height: 680,
          background:
            "radial-gradient(closest-side, rgba(245,210,122,0.35), rgba(245,210,122,0) 65%)",
        }}
      />

      {/* Coin block */}
      <div className="relative pt-16 sm:pt-24 flex items-center justify-center">
        <div
          role="img"
          aria-label="Interactive PRANA coin. Drag, use arrow keys, or press Enter to pulse."
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="outline-none focus-visible:ring-2 focus-visible:ring-[#F5D27A]/60 rounded-2xl"
        >
          {mvReady ? (
            <model-viewer
              ref={mvRef}
              src={COIN_MODEL_URL}
              poster="/prana-coin-fallback.png"
              camera-controls
              disable-zoom
              interaction-prompt="none"
              exposure="1"
              shadow-intensity="0"
              auto-rotate
              auto-rotate-delay="6000"
              rotation-per-second="1.2deg" /* ~0.2 rpm */
              style={coinStyle}
              onClick={pulse}
            />
          ) : (
            <img
              src="/prana-coin-fallback.png"
              alt="PRANA coin (static fallback)"
              style={coinStyle}
              className="select-none"
              onClick={pulse}
            />
          )}
        </div>
      </div>

      {/* Copy & CTAs */}
      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center mt-8">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-wide">
          Định Giá Bằng Bitcoin - Vận Hành Bằng Trí Tuệ
        </h1>
        <p className="mt-4 text-[15px] sm:text-base text-white/70">
          PRANA là cầu nối giữa sự chính xác của Code và sự thấu hiểu của Tâm.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-4 sm:justify-center">
          <a
            href="#trade"
            className="inline-flex justify-center rounded-2xl px-6 py-3 bg-[#F5D27A] text-black font-semibold shadow-[0_0_28px_rgba(245,210,122,.28)] hover:shadow-[0_0_40px_rgba(245,210,122,.38)] active:scale-[0.99] transition"
          >
            Trade WBTC ↔ PRANA
          </a>
          <a
            href="#stake"
            className="inline-flex justify-center rounded-2xl px-6 py-3 border border-white/12 text-white hover:border-white/24 transition"
          >
            Stake PRANA
          </a>
        </div>

        {/* Optional stat chips (non-interactive placeholders / wire-ready) */}
        <div className="mt-6 flex flex-wrap justify-center gap-2 opacity-80 select-none">
          <span className="rounded-full border border-white/10 px-3 py-1 text-[12px] text-white/70">Price (sats): —</span>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[12px] text-white/70">Liquidity ratio: —</span>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[12px] text-white/70">24h volume: —</span>
        </div>
      </div>

      {/* Safe-area friendly bottom spacer on tiny viewports */}
      <div className="h-8 sm:h-12" />
    </section>
  );
}
