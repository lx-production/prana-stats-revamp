import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, useGLTF } from "@react-three/drei";
import { motion, useMotionValue, useSpring, useTransform, animate } from "framer-motion";

/**
 * PRANA – Temple of Light (Hero Mockup)
 * - Dark, minimal, cyber‑spiritual
 * - .glb coin at ~60vh, drag to rotate, click → quick 15° inertial spin
 * - Sri Yantra wireframe background reacts (lag ~120ms via spring)
 * - Helper chip, stat chips, mobile sticky CTA bar
 *
 * Swap `glbUrl` to your real 3D coin. Keep it optimized (<1.2MB) for fast paint.
 */

export default function PranaHero() {
  // TODO: replace with your actual coin path
  const glbUrl = "/prana_mock_coin2.glb"; // e.g. "/assets/coin-prana.glb"

  // Rotation state (radians). We use MotionValue so the 3D scene and UI background can stay in sync.
  const rotY = useMotionValue(0);
  const tiltX = useMotionValue(0);

  // Lagging background motion to simulate 120ms glow delay
  const lagY = useSpring(rotY, { stiffness: 80, damping: 20 });
  const lagTilt = useSpring(tiltX, { stiffness: 80, damping: 20 });

  // Background transforms derived from lagging motion
  const bgShiftX = useTransform(lagY, (v) => `${v * 40}px`); // subtle parallax shift
  const bgSkew = useTransform(lagY, (v) => `${v * 2}deg`);
  const bgBlur = useTransform(lagTilt, (v) => `${Math.abs(v) * 12 + 24}px`);

  // Drag handling
  const dragRef = useRef(null);
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const onPointerDown = (e) => {
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e) => {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    rotY.set(rotY.get() + dx * 0.006);
    // limit tilt for a classy feel
    const nextTilt = Math.max(-0.25, Math.min(0.25, tiltX.get() + dy * -0.004));
    tiltX.set(nextTilt);
    last.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  const onClickSpin = () => {
    // quick 15° inertial spin using framer-motion animate
    const target = rotY.get() + (15 * Math.PI) / 180;
    animate(rotY, target, { type: "spring", stiffness: 300, damping: 18 });
  };

  // Helper: prevent text selection while dragging
  useEffect(() => {
    const el = dragRef.current;
    if (!el) return;
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-[#0a0a0b] text-white">
      {/* Micro‑grain + vignette */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 opacity-[0.06] mix-blend-soft-light" style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(255,255,255,.08) 0, rgba(255,255,255,0) 60%)," +
            "radial-gradient(circle at 80% 40%, rgba(255,255,255,.06) 0, rgba(255,255,255,0) 55%)," +
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 2px)"
        }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.6)_60%,rgba(0,0,0,0.95)_100%)]" />
      </div>

      {/* Sri Yantra wireframe background (ultra faint, pulsing) */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ translateX: bgShiftX, skewX: bgSkew }}
        aria-hidden
      >
        <motion.svg
          width="1400" height="1400" viewBox="0 0 100 100"
          className="opacity-[0.005]"
          animate={{ opacity: [0.004, 0.007, 0.004] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Minimalist yantra – concentric circles + triangles + square gate */}
          <g fill="none" stroke="#b9f2ff" strokeWidth="0.2">
            <circle cx="50" cy="50" r="34" />
            <circle cx="50" cy="50" r="28" />
            <circle cx="50" cy="50" r="20" />
            <polygon points="50,16 67,66 33,66" />
            <polygon points="50,84 33,34 67,34" />
            <polygon points="16,50 66,33 66,67" />
            <polygon points="84,50 34,67 34,33" />
            {/* Square gate */}
            <rect x="14" y="14" width="72" height="72" />
          </g>
        </motion.svg>
        {/* Glow behind coin with slight blur lag */}
        <motion.div
          className="absolute h-[60vmin] w-[60vmin] rounded-full"
          style={{ filter: `blur(${bgBlur.get()})` }}
        >
          <div className="h-full w-full rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(29,185,255,0.14)_0%,rgba(29,185,255,0.08)_30%,rgba(255,215,0,0.06)_60%,transparent_70%)]" />
        </motion.div>
      </motion.div>

      {/* Content container */}
      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-7xl flex-col items-center justify-between px-4 sm:px-6">
        {/* Top copy */}
        <header className="pt-10 text-center md:pt-14">
          <h1 className="text-balance font-semibold tracking-[0.18em] text-white/95 [font-family:var(--font-display,_'Space_Grotesk',_'Eurostile',_system-ui,_sans-serif)] text-3xl leading-tight sm:text-4xl md:text-5xl">
            PRANA – Energy priced in Bitcoin
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-sm text-white/70 sm:text-base md:text-lg [font-family:var(--font-body,_Inter,_Satoshi,_system-ui,_sans-serif)]">
            A cyber-spiritual asset engineered to outperform, anchored in sats.
          </p>
          {/* Desktop CTAs */}
          <div className="mt-6 hidden items-center gap-3 md:flex">
            <a
              href="#launch"
              className="group relative inline-flex items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-medium text-black transition focus:outline-none"
            >
              <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-200 to-amber-200 blur-sm opacity-80 group-hover:opacity-100" />
              <span className="relative rounded-2xl bg-gradient-to-r from-cyan-300 via-cyan-200 to-amber-200 px-5 py-2.5 shadow-[0_0_30px_rgba(0,255,255,0.15)]">Launch App</span>
            </a>
            <a
              href="#manifesto"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-white/90 backdrop-blur transition hover:border-cyan-300/40 hover:bg-white/[0.08]"
            >
              Read Manifesto
            </a>
          </div>
        </header>

        {/* 3D Coin Stage */}
        <section className="relative mt-6 w-full md:mt-2">
          <div
            ref={dragRef}
            onClick={onClickSpin}
            className="relative mx-auto h-[60vh] max-h-[78svh] w-full touch-none select-none overflow-visible md:h-[62vh]"
            role="button"
            aria-label="PRANA coin – drag to rotate; click to spin"
          >
            <Canvas shadows camera={{ position: [0, 0, 4.6], fov: 45 }}>
              <color attach="background" args={["#0a0a0b"]} />
              <ambientLight intensity={0.5} />
              <directionalLight position={[3, 4, 5]} intensity={1.4} castShadow />
              <spotLight position={[-4, 3, 2]} angle={0.4} intensity={1.1} penumbra={0.6} />
              <Environment preset="studio" />
              <React.Suspense fallback={<CenterLoader />}> 
                <CoinModel url={glbUrl} rotY={rotY} tiltX={tiltX} />
              </React.Suspense>
            </Canvas>

            {/* Helper chip */}
            <div className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 translate-y-4 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur">
              Drag to spin
            </div>
          </div>
        </section>

        {/* Bottom area with stat chips (desktop) */}
        <footer className="mb-24 hidden w-full items-end justify-between md:flex">
          <div className="flex items-center gap-2">
            <StatChip label="Price (sats)" value="45" accent="cyan" />
            <StatChip label="Liquidity ratio" value="10.8%" accent="amber" />
            <StatChip label="24h volume" value="12.3k" accent="cyan" />
          </div>
          {/* Spacer for aesthetic balance */}
          <div className="h-6 w-6" />
        </footer>
      </div>

      {/* Mobile sticky CTA bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto block w-full bg-gradient-to-t from-black/80 via-black/60 to-transparent p-4 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-3">
          <a
            href="#launch"
            className="group relative inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-black"
          >
            <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-300 via-cyan-200 to-amber-200 blur-sm opacity-80 group-hover:opacity-100" />
            <span className="relative rounded-xl bg-gradient-to-r from-cyan-300 via-cyan-200 to-amber-200 px-4 py-2.5">Launch App</span>
          </a>
          <a
            href="#manifesto"
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white/90 backdrop-blur"
          >
            Read Manifesto
          </a>
        </div>
        {/* Mobile stat chips */}
        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-white/70">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Price (sats): 45</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">LR: 10.8%</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Vol 24h: 12.3k</span>
        </div>
      </div>
    </div>
  );
}

function CenterLoader() {
  return (
    <Html center>
      <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/70 backdrop-blur">
        Loading coin…
      </div>
    </Html>
  );
}

function CoinModel({ url, rotY, tiltX }) {
  const group = useRef();
  const { scene } = useGLTF(url, true);

  useEffect(() => {
    scene.traverse((n) => {
      // Mild PBR emphasis for a classy gold feel
      if (n.isMesh && n.material) {
        if ("metalness" in n.material) n.material.metalness = 1.0;
        if ("roughness" in n.material) n.material.roughness = 0.2;
      }
    });
  }, [scene]);

  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.y = rotY.get();
    group.current.rotation.x = tiltX.get();
  });

  // Auto-scale to a tasteful size
  return (
    <group ref={group} dispose={null} position={[0, -0.1, 0]}>
      <primitive object={scene} scale={1.3} />
    </group>
  );
}

function StatChip({ label, value, accent = "cyan" }) {
  const accentClasses = useMemo(() => (
    accent === "amber"
      ? "from-amber-300/60 via-amber-200/40 to-transparent"
      : "from-cyan-300/60 via-cyan-200/40 to-transparent"
  ), [accent]);

  return (
    <div className="group relative inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/85 backdrop-blur">
      <span className={`absolute -inset-px rounded-2xl bg-gradient-to-r ${accentClasses} opacity-0 blur transition-opacity duration-300 group-hover:opacity-100`} />
      <span className="relative text-white/60">{label}</span>
      <span className="relative font-semibold text-white/95">{value}</span>
    </div>
  );
}

// Drei GLTF loader cache helper
useGLTF.preload && useGLTF.preload("/prana_mock_coin2.glb");
