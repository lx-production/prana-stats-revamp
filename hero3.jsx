import { useEffect, useMemo, useRef, useState } from "react";

const COIN_MODEL_URL = new URL("./prana_mock_coin2.glb", import.meta.url).href;

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

export default function OnChainMandalaHero() {
  const mvReady = useModelViewer();

  const heroRef = useRef(null);
  const mvRef = useRef(null);
  const canvasRef = useRef(null);
  const haloRef = useRef(null);

  const [reduced, setReduced] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(true);

  // Respect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // Auto-hide tooltip after 3s or on first interaction
  useEffect(() => {
    if (!tooltipVisible) return;
    const tid = setTimeout(() => setTooltipVisible(false), 3000);
    const kill = () => setTooltipVisible(false);
    window.addEventListener("pointerdown", kill, { once: true });
    return () => {
      clearTimeout(tid);
      window.removeEventListener("pointerdown", kill);
    };
  }, [tooltipVisible]);

  // Scroll progress → mandala scale (0.8 → 1.0)
  const scrollProgressRef = useRef(0);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const vpH = window.innerHeight || 1;
      const heroCenter = r.top + r.height * 0.5;
      const vpCenter = vpH * 0.5;
      const d = Math.min(1, Math.max(0, 1 - Math.abs(heroCenter - vpCenter) / (vpH * 0.6)));
      scrollProgressRef.current = d;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Pointer influence → mandala rotation
  const pointerRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / Math.max(1, cx);
      const dy = (e.clientY - cy) / Math.max(1, cy);
      pointerRef.current = { x: dx, y: dy };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Mandala canvas renderer (2D for perf)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf, running = true;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const RINGS = 8;           // concentric rings
    const DOTS = 56;           // dots per ring base
    const BASE = 110;          // base radius px
    const GAP = 18;            // gap per ring px
    const twinkle = !reduced;

    const onVis = () => { /* pause when tab hidden for battery */ };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);

    let t = 0;
    (function loop() {
      if (!running) return;
      t += 0.016;
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2, cy = h / 2;

      const progress = scrollProgressRef.current;
      const scale = 0.8 + 0.2 * progress; // 0.8→1.0
      const rot = (pointerRef.current.x * 0.07) + (reduced ? 0 : t * 0.02);

      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, "#05011a");
      bgGrad.addColorStop(0.4, "#0b0933");
      bgGrad.addColorStop(1, "#020108");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      const aurora = ctx.createRadialGradient(cx, cy * 0.65, Math.max(w, h) * 0.05, cx, cy, Math.max(w, h) * 0.72);
      aurora.addColorStop(0, "rgba(104,64,240,0.28)");
      aurora.addColorStop(0.55, "rgba(36,20,94,0.42)");
      aurora.addColorStop(1, "rgba(6,4,18,0.9)");
      ctx.fillStyle = aurora;
      ctx.fillRect(0, 0, w, h);

      // Subtle vignette background layer
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.78);
      grad.addColorStop(0, "rgba(10,6,30,0)");
      grad.addColorStop(1, "rgba(4,3,15,0.82)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalAlpha = 0.65;
      const arcBase = BASE * 1.28 * scale;
      for (let i = 0; i < 3; i++) {
        const radius = arcBase + i * 34;
        const sway = Math.sin(t * 0.5 + i) * 0.2 + pointerRef.current.y * 0.04;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(sway + i * 0.58);
        ctx.beginPath();
        ctx.strokeStyle = i % 2 === 0 ? "rgba(124,146,255,0.32)" : "rgba(245,210,122,0.28)";
        ctx.lineWidth = 2.2 + i;
        ctx.shadowBlur = 26;
        ctx.shadowColor = "rgba(124,146,255,0.5)";
        ctx.arc(0, 0, radius, -Math.PI * 0.35, Math.PI * 0.35);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      // Gold/white halo ring behind coin
      ctx.beginPath();
      ctx.arc(cx, cy, BASE * 1.18 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(245,210,122,0.34)"; // ion-gold glow
      ctx.lineWidth = 2;
      ctx.stroke();

      // Dots
      for (let r = 0; r < RINGS; r++) {
        const radius = (BASE + r * GAP) * scale;
        const count = Math.max(20, Math.floor(DOTS - r * 2));
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + rot * (1 + r * 0.03);
          const x = cx + Math.cos(a) * radius;
          const y = cy + Math.sin(a) * radius;
          const jitter = twinkle ? (Math.sin(t * 3 + r * 1.3 + i) * 0.02) : 0;
          const alpha = 0.06 + (jitter * 0.04);
          const isInner = r < 2;
          const hue = isInner ? 44 : 228 - r * 3;
          const sat = isInner ? 94 : 72;
          const light = isInner ? 66 : 58 - r * 2;
          const dotAlpha = Math.max(0.05, alpha * (isInner ? 1.4 : 1));
          ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${dotAlpha})`;
          ctx.beginPath();
          ctx.arc(x, y, r === 0 ? 1.6 : 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced]);

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
      aria-label="PRANA hero section with interactive coin and reactive mandala background"
    >
      {/* Background mandala (canvas) */}
      <div className="absolute inset-0 -z-10">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

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
              auto-rotate={!reduced}
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
          Turn Value into Vibration
        </h1>
        <p className="mt-4 text-[15px] sm:text-base text-white/70">
          Stake, bond, and trade within a Bitcoin-priced flow.
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

        {/* Tooltip (aria-live polite, hidden after first interaction or 3s) */}
        {tooltipVisible && (
          <div className="mt-3 text-xs text-white/50" aria-live="polite">
            Tip: Try a slow spin
          </div>
        )}

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
