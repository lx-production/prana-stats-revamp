import { useEffect, useMemo, useRef, useState } from "react";
import { createOnKeyDown, createSpinCoin } from "./utils/modelViewerHelpers.js";

const COIN_MODEL_URL = new URL("./prana.glb", import.meta.url).href;
const CAMERA_ORBIT_BASE = { theta: 15, phi: 120, radius: "120%" };
const CAMERA_ORBIT_ATTR = `${CAMERA_ORBIT_BASE.theta}deg ${CAMERA_ORBIT_BASE.phi}deg ${CAMERA_ORBIT_BASE.radius}`;
const CAMERA_RADIUS_CLAMP = `auto auto ${CAMERA_ORBIT_BASE.radius}`;

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
    s.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
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
  const spinFrameRef = useRef(null);
  const [spinning, setSpinning] = useState(false);

  // Ensure default orbit after model load
  useEffect(() => {
    const mv = mvRef.current;
    if (!mv) return;
    let cancelled = false;
    const setOrbit = () => {
      const apply = () => {
        if (cancelled) return;
        try {
          mv.setAttribute("camera-orbit", CAMERA_ORBIT_ATTR);
          mv.setAttribute("min-camera-orbit", CAMERA_RADIUS_CLAMP);
          mv.setAttribute("max-camera-orbit", CAMERA_RADIUS_CLAMP);
          mv.cameraOrbit = CAMERA_ORBIT_ATTR;
          mv.jumpCameraToGoal?.();
        } catch {
          /* noop */
        }
      };
      if (mv.updateComplete) {
        mv.updateComplete.then(apply).catch(() => {});
      } else {
        requestAnimationFrame(apply);
      }
    };

    mv.addEventListener("load", setOrbit);
    if (mv.modelIsVisible) setOrbit();
    return () => {
      cancelled = true;
      mv.removeEventListener("load", setOrbit);
    };
  }, [mvReady]);

  // Create helper functions with current refs and state
  const onKeyDown = createOnKeyDown(mvRef);
  const spinCoin = createSpinCoin(mvRef, spinning, setSpinning, spinFrameRef);

  // Cleanup pending animation if unmounted
  useEffect(() => () => {
    if (spinFrameRef.current) cancelAnimationFrame(spinFrameRef.current);
    const mv = mvRef.current;
    if (mv) {
      mv.autoRotate = true;
      mv.setAttribute("camera-controls", "");
    }
  }, []);

  // Sizes
  const coinStyle = useMemo(() => ({
    width: "min(92vw, 880px)",
    height: "60vh",
  }), []);

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
            <model-viewer
              ref={mvRef}
              src={COIN_MODEL_URL}
              poster="/prana-coin-fallback.png"
              camera-orbit={CAMERA_ORBIT_ATTR}
              min-camera-orbit={CAMERA_RADIUS_CLAMP}
              max-camera-orbit={CAMERA_RADIUS_CLAMP}
              camera-controls
              interaction-prompt="none"
              exposure="1"
              shadow-intensity="0"
              auto-rotate
              auto-rotate-delay="0"
              rotation-per-second="10deg"
              style={coinStyle}
            />
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
        <h1 className="text-4xl font-medium tracking-wide">
          Định Giá Bằng Bitcoin
        </h1><br />
        <h2 className="text-4xl font-medium tracking-wide">
          Vận Hành Bằng Trí Tuệ
        </h2>
        <p className="mt-6 text-[15px] text-white/70">
          PRANA là cầu nối giữa sự chính xác của Code và sự thấu hiểu của Tâm
        </p>

        <div className="mt-12 flex flex-col sm:flex-row gap-4 sm:justify-center">
          <a
            href="https://prana.triethocduongpho.net/bond/" target="_blank"
            className="inline-flex justify-center rounded-2xl px-6 py-3 border border-white/12 text-white hover:border-white/24 transition"
          >
            Bond PRANA
          </a>
          <a
            href="https://prana.triethocduongpho.net/stake/" target="_blank"
            className="inline-flex justify-center rounded-2xl px-6 py-3 bg-[#F5D27A] text-black font-semibold shadow-[0_0_28px_rgba(245,210,122,.28)] hover:shadow-[0_0_40px_rgba(245,210,122,.38)] active:scale-[0.99] transition"
          >
            Stake PRANA
          </a>
          <a
            href="https://app.uniswap.org/explore/pools/polygon/0xf9A9Fce44AC9E68D7e0B87516fE21536446B1AED" target="_blank"
            className="inline-flex justify-center rounded-2xl px-6 py-3 border border-white/12 text-white hover:border-white/24 transition"
          >
            Trade PRANA
          </a>
        </div>
      </div>
    </section>
  );
}
