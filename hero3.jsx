import { useEffect, useMemo, useRef, useState } from "react";

const COIN_MODEL_URL = new URL("./prana.glb", import.meta.url).href;
const CAMERA_ORBIT_BASE = { theta: 15, phi: 120, radius: "120%" };
const CAMERA_ORBIT_ATTR = `${CAMERA_ORBIT_BASE.theta}deg ${CAMERA_ORBIT_BASE.phi}deg ${CAMERA_ORBIT_BASE.radius}`;
const CAMERA_RADIUS_CLAMP = `auto auto ${CAMERA_ORBIT_BASE.radius}`;

// Parse "xdeg ydeg zdeg" orientation into degrees
const parseOrientationDeg = (orientation) => {
  const matches = Array.from(String(orientation || "").matchAll(/(-?\d+(?:\.\d+)?)deg/gi));
  if (matches.length >= 3) return matches.slice(0, 3).map((m) => parseFloat(m[1]));
  return [0, 0, 0];
};

const formatOrientationDeg = (x, y, z) => `${x}deg ${y}deg ${z}deg`;

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

  // Keyboard access: ←/→ rotate
  const onKeyDown = (e) => {
    if (!mvRef.current) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      try {
        const mv = mvRef.current;
        const orbit = mv.getCameraOrbit ? mv.getCameraOrbit() : null;
        if (orbit) {
          const delta = e.key === "ArrowLeft" ? -10 : 10; // deg
          const thetaDeg = orbit.theta * (180 / Math.PI) + delta;
          const phiDeg = orbit.phi * (180 / Math.PI);
          const orbitString = `${thetaDeg.toFixed(1)}deg ${phiDeg.toFixed(1)}deg ${orbit.radius.toFixed(2)}m`;
          mv.cameraOrbit = orbitString;
          mv.jumpCameraToGoal?.();
        }
      } catch {}
    }
  };

  // Click-to-spin: rotate the coin 360° at 30°/s
  const spinCoin = () => {
    const mv = mvRef.current;
    if (!mv || spinning) return;

    const SPIN_SPEED_DEG_PER_S = 360;
    const durationMs = (360 / SPIN_SPEED_DEG_PER_S) * 1000; // 12s
    const [xDeg, yDeg, zDeg] = parseOrientationDeg(mv.getAttribute("orientation") || mv.orientation || "0deg 0deg 0deg");
    const targetYDeg = yDeg + 360;
    const autoWasOn = mv.autoRotate;
    const hadCameraControls = mv.hasAttribute("camera-controls");

    mv.autoRotate = false;
    if (hadCameraControls) mv.removeAttribute("camera-controls");
    setSpinning(true);

    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const currentY = yDeg + (targetYDeg - yDeg) * progress;
      mv.orientation = formatOrientationDeg(xDeg, currentY, zDeg);
      if (progress < 1) {
        spinFrameRef.current = requestAnimationFrame(animate);
      } else {
        mv.orientation = formatOrientationDeg(xDeg, targetYDeg, zDeg);
        if (autoWasOn) mv.autoRotate = true;
        if (hadCameraControls) mv.setAttribute("camera-controls", "");
        spinFrameRef.current = null;
        setSpinning(false);
      }
    };

    spinFrameRef.current = requestAnimationFrame(animate);
  };

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
    height: "55vh",
  }), []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-[92vh] overflow-hidden text-white pb-[env(safe-area-inset-bottom)]"
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

        <div className="mt-6 flex flex-col sm:flex-row gap-4 sm:justify-center">
          <a
            href="#trade"
            className="inline-flex justify-center rounded-2xl px-6 py-3 bg-[#F5D27A] text-black font-semibold shadow-[0_0_28px_rgba(245,210,122,.28)] hover:shadow-[0_0_40px_rgba(245,210,122,.38)] active:scale-[0.99] transition"
          >
            Trade PRANA
          </a>
          <a
            href="#stake"
            className="inline-flex justify-center rounded-2xl px-6 py-3 border border-white/12 text-white hover:border-white/24 transition"
          >
            Stake PRANA
          </a>
        </div>
      </div>

      {/* Safe-area friendly bottom spacer on tiny viewports */}
      <div className="h-8 sm:h-12" />
    </section>
  );
}
