import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html } from "@react-three/drei";
import { motion } from "framer-motion";
import * as THREE from "three";

import useNeonMonasteryHero from "./hooks/useNeonMonasteryHero";
import useCoinController from "./hooks/useCoinController";

export default function NeonMonasteryHero({
  coinSrc = "/prana_mock_coin2.glb",
  fallbackSrc = "/prana-coin-fallback.png",
}) {
  const {
    humOn,
    toggleHum,
    menuOpen,
    toggleMenu,
    closeMenu,
    registerVelocity,
    markCoinReady,
    markCoinFailed,
    showFallback,
    coinReady,
    coinApiRef,
    handleCoinKeyDown,
    headingRef,
    glitchActive,
    handleHeadingHover,
    handleHeadingBlur,
    handleHeadingAnimationEnd,
    prefersReducedMotion,
    citylineStyle,
    marqueeItems,
    statChips,
    snapbackDelay,
    snapbackTarget,
  } = useNeonMonasteryHero();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#07030E] via-[#06020E] to-[#04020A] text-white">
      <BackgroundLayers
        prefersReducedMotion={prefersReducedMotion}
        citylineStyle={citylineStyle}
      />

      <div className="relative z-10 mx-auto flex min-h-[92vh] w-full max-w-7xl flex-col px-4 pb-24 pt-16 sm:px-6 lg:px-10">
        <header className="relative mb-10 flex items-start justify-between text-xs text-white/60 lg:mb-14">
          <div className="hidden items-center gap-4 lg:flex">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-medium uppercase tracking-[0.18em] text-[11px] text-white/65">
              Non-custodial. On-chain.
            </span>
            <HumToggle humOn={humOn} toggleHum={toggleHum} />
          </div>

          <div className="ml-auto lg:hidden">
            <div className="relative">
              <button
                aria-expanded={menuOpen}
                aria-controls="neon-monastery-menu"
                onClick={toggleMenu}
                className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/35 text-white/80 transition hover:border-white/20 hover:text-white"
              >
                <Kebab className="h-5 w-5" />
                <span className="sr-only">Toggle hero menu</span>
              </button>
              {menuOpen ? (
                <div
                  id="neon-monastery-menu"
                  onMouseLeave={closeMenu}
                  className="absolute right-0 mt-3 w-60 rounded-2xl border border-white/10 bg-black/75 p-3 text-sm text-white/80 shadow-2xl backdrop-blur-xl"
                >
                  <MenuRow
                    label="Hum"
                    description="Soft ambient tone"
                    checked={humOn}
                    onChange={() => {
                      toggleHum();
                      closeMenu();
                    }}
                  />
                  <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
                    Non-custodial. On-chain.
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-10 lg:grid-cols-[0.42fr_0.58fr] lg:gap-16">
          <div className="order-2 flex flex-col justify-center gap-6 lg:order-1">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}>
              <h1
                ref={headingRef}
                data-text="Spin the Coin. Feel the Signal."
                onMouseEnter={handleHeadingHover}
                onMouseLeave={handleHeadingBlur}
                onFocus={handleHeadingHover}
                onBlur={handleHeadingBlur}
                onAnimationEnd={handleHeadingAnimationEnd}
                className={[
                  "glitch-text text-balance text-4xl font-semibold leading-snug tracking-[0.12em] text-[#F5E6FF] sm:text-5xl lg:text-[3.55rem]",
                  "[font-family:'Space_Grotesk',_'Eurostile',_system-ui,_sans-serif]",
                  glitchActive ? "glitch-text--active" : "",
                ].join(" ")}
              >
                Spin the Coin. Feel the Signal.
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: "easeOut", delay: 0.05 }}
              className="max-w-xl text-base text-white/70 sm:text-lg [font-family:'Inter',_system-ui,_sans-serif]"
            >
              PRANA is a Bitcoin-denominated community asset for a conscious economy.
            </motion.p>

            <a
              href="#prana-stats"
              className="inline-flex text-sm text-white/70 underline underline-offset-6 transition hover:text-white sm:hidden"
            >
              Track PRANA Stats
            </a>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.12 }}
              className="hidden items-center gap-4 sm:flex"
            >
              <a
                href="#get-prana"
                className="group inline-flex items-center justify-center rounded-2xl border border-[#F5D27A]/30 bg-gradient-to-b from-black/45 to-[#11091E] px-6 py-3 text-sm font-semibold text-[#F5D27A] shadow-[0_0_35px_-14px_rgba(245,210,122,0.7)] transition hover:border-[#F5D27A]/60 hover:shadow-[0_0_48px_-14px_rgba(245,210,122,0.82)] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/70"
              >
                Get PRANA
                <ChevronRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
              </a>
              <a
                href="#prana-stats"
                className="inline-flex items-center text-sm font-medium text-white/70 transition hover:text-white"
              >
                Track PRANA Stats
              </a>
            </motion.div>

            <div className="flex items-center gap-3 text-xs text-white/60">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Tip: Drag to rotate
              </span>
              <span className="hidden sm:inline text-white/45">Non-custodial. On-chain.</span>
            </div>

            <div className="mt-4 hidden flex-wrap gap-3 text-xs text-white/65 md:flex">
              {statChips.map((chip) => (
                <StatChip key={chip.label} label={chip.label} value={chip.value} />
              ))}
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <CoinStage
              coinSrc={coinSrc}
              fallbackSrc={fallbackSrc}
              showFallback={showFallback}
              coinReady={coinReady}
              prefersReducedMotion={prefersReducedMotion}
              onVelocityChange={registerVelocity}
              onReady={markCoinReady}
              onError={markCoinFailed}
              coinApiRef={coinApiRef}
              snapbackDelay={snapbackDelay}
              snapbackTarget={snapbackTarget}
              onKeyDown={handleCoinKeyDown}
            />
          </div>
        </div>

        <div className="mt-12">
          <RoadmapMarquee items={marqueeItems} />
        </div>
      </div>

      <MobileStickyCTA humOn={humOn} toggleHum={toggleHum} />

      <style>{`
        .scanline-layer {
          background: repeating-linear-gradient(180deg, rgba(255,255,255,0.11) 0 1px, transparent 1px 4px);
          animation: scanline-shift 22s linear infinite;
        }
        .glitch-text {
          position: relative;
          filter: drop-shadow(0 0 0.14rem rgba(180,120,255,.32));
        }
        .glitch-text::before,
        .glitch-text::after {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0;
        }
        .glitch-text::before {
          color: rgba(0,229,255,.8);
          mix-blend-mode: screen;
        }
        .glitch-text::after {
          color: rgba(255,77,255,.75);
          mix-blend-mode: lighten;
        }
        .glitch-text--active::before,
        .glitch-text--active::after {
          opacity: 0.9;
          animation: glitch-rgb 120ms ease-in-out 1;
        }
        @keyframes glitch-rgb {
          0% { transform: translate(0,0); opacity: 0.6; }
          50% { transform: translate(-1px,1px); opacity: 0.9; }
          100% { transform: translate(1px,-1px); opacity: 0; }
        }
        @keyframes scanline-shift {
          0% { background-position: 0 0; }
          100% { background-position: 0 220px; }
        }
        @keyframes incense-rise {
          0% { transform: translate3d(calc(var(--x-amp) * -1), 20%, 0); opacity: 0; }
          20% { opacity: var(--fade, 0.28); }
          60% { transform: translate3d(calc(var(--x-amp)), -30%, 0); }
          80% { opacity: var(--fade, 0.28); }
          100% { transform: translate3d(calc(var(--x-amp) * -1), -90%, 0); opacity: 0; }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

function BackgroundLayers({ prefersReducedMotion, citylineStyle }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="scanline-layer absolute inset-0 opacity-[0.018] mix-blend-overlay" />
      <IncenseParticles count={prefersReducedMotion ? 12 : 30} prefersReducedMotion={prefersReducedMotion} />
      <CitySilhouette style={citylineStyle} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_35%,rgba(245,210,122,0.18)_0,rgba(0,0,0,0)_68%)]" />
    </div>
  );
}

function CoinStage({
  coinSrc,
  fallbackSrc,
  showFallback,
  coinReady,
  prefersReducedMotion,
  onVelocityChange,
  onReady,
  onError,
  coinApiRef,
  snapbackDelay,
  snapbackTarget,
  onKeyDown,
}) {
  const coinLabel = "Interactive PRANA coin. Use drag or arrow keys to rotate.";

  return (
    <div className="relative">
      <div className="absolute -inset-x-6 inset-y-8 -z-10 rounded-[2.75rem] bg-[radial-gradient(circle_at_center,rgba(245,210,122,0.32)_0%,rgba(91,58,176,0.18)_35%,rgba(0,0,0,0)_72%)] blur-3xl opacity-70" />
      <div className="relative overflow-visible rounded-[1.75rem] border border-white/10 bg-gradient-to-b from-[#0F071C]/80 to-[#04020A] p-[1px] backdrop-blur">
        <div
          role="img"
          aria-label={coinLabel}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="relative rounded-[1.7rem] border border-white/5 bg-black/30 outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]/70"
        >
          <div className="relative h-[48vh] min-h-[320px] w-full rounded-[1.7rem] bg-[radial-gradient(circle_at_top,rgba(0,229,255,0.15),rgba(0,0,0,0)_72%)] pb-6 pt-6 lg:h-[64vh]">
            {!coinReady && !showFallback ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <SkeletonLoader />
              </div>
            ) : null}
            {showFallback ? (
              <img
                src={fallbackSrc}
                alt="PRANA coin fallback"
                className="h-full w-full rounded-[1.6rem] object-contain"
                loading="lazy"
              />
            ) : (
              <Canvas camera={{ position: [0, 0, 3.6], fov: 35 }} dpr={[1, 2]} className="rounded-[1.6rem]">
                <ambientLight intensity={0.45} />
                <pointLight position={[6, 6, 6]} intensity={65} color="#A77BFF" />
                <pointLight position={[-6, -3, 2.5]} intensity={35} color="#22D3EE" />
                <Environment preset="city" />
                <Suspense fallback={<Html center><SkeletonLoader /></Html>}>
                  <group position={[0, 0, 0]}>
                    <GlassOrb prefersReducedMotion={prefersReducedMotion} />
                    <InteractiveCoin
                      coinSrc={coinSrc}
                      isReducedMotion={prefersReducedMotion}
                      onVelocityChange={onVelocityChange}
                      onReady={onReady}
                      onError={onError}
                      apiRef={coinApiRef}
                      snapbackDelay={snapbackDelay}
                      snapbackTarget={snapbackTarget}
                    />
                  </group>
                </Suspense>
              </Canvas>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/12 bg-black/40 px-4 py-1.5 text-xs text-white/60 backdrop-blur">
      <span className="relative block h-1.5 w-16 overflow-hidden rounded-full bg-white/12">
        <span className="absolute inset-0 animate-pulse rounded-full bg-white/45" />
      </span>
      Loading coin…
    </div>
  );
}

function InteractiveCoin({
  coinSrc,
  isReducedMotion,
  onVelocityChange,
  onReady,
  onError,
  apiRef,
  snapbackDelay,
  snapbackTarget,
}) {
  const {
    gltf,
    groupRef,
    ringMaterialRef,
    pointerHandlers,
    impulseSpin,
    nudge,
  } = useCoinController({
    coinSrc,
    isReducedMotion,
    onVelocityChange,
    snapbackDelay,
    snapbackTarget,
    onReady,
    onError,
  });

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      impulseSpin,
      nudge,
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, impulseSpin, nudge]);

  return (
    <group ref={groupRef} {...pointerHandlers} dispose={null}>
      {gltf ? (
        <primitive object={gltf.scene} scale={1.08} />
      ) : (
        <mesh scale={1.08}>
          <cylinderGeometry args={[1, 1, 0.12, 96]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.95} roughness={0.22} />
        </mesh>
      )}
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={1.05}>
        <ringGeometry args={[0.94, 1.07, 96]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color="#22D3EE"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function GlassOrb({ prefersReducedMotion }) {
  const orbRef = useRef(null);
  useFrame((_, dt) => {
    if (prefersReducedMotion || !orbRef.current) return;
    orbRef.current.rotation.y += dt * 0.06;
  });
  return (
    <mesh ref={orbRef} scale={1.24}>
      <sphereGeometry args={[1.08, 64, 64]} />
      <meshPhysicalMaterial
        transparent
        transmission={0.97}
        roughness={0.1}
        thickness={0.7}
        metalness={0.18}
        ior={1.22}
        color="#E2DAFF"
        opacity={0.11}
      />
    </mesh>
  );
}

function HumToggle({ humOn, toggleHum }) {
  return (
    <button
      type="button"
      onClick={toggleHum}
      aria-pressed={humOn}
      className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
    >
      <span className="relative inline-flex h-4 w-7 items-center rounded-full border border-white/25 bg-black/60">
        <span
          className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition ${
            humOn
              ? "left-[1.55rem] bg-[#F5D27A] shadow-[0_0_0.55rem_rgba(245,210,122,0.6)]"
              : "left-1 bg-white/70"
          }`}
        />
      </span>
      {humOn ? "Hum: On" : "Hum: Off"}
    </button>
  );
}

function MenuRow({ label, description, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition hover:bg-white/5"
      aria-pressed={checked}
    >
      <div>
        <div className="text-sm font-semibold text-white">{label}</div>
        {description ? <div className="text-xs text-white/60">{description}</div> : null}
      </div>
      <span className="relative inline-flex h-6 w-11 items-center rounded-full border border-white/20 bg-black/50">
        <span
          className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition ${
            checked
              ? "left-[1.55rem] bg-[#F5D27A] shadow-[0_0_0.5rem_rgba(245,210,122,0.55)]"
              : "left-1 bg-white/70"
          }`}
        />
      </span>
    </button>
  );
}

function RoadmapMarquee({ items = [] }) {
  const content = useMemo(() => [...items, ...items], [items]);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/45 py-2 pl-4 pr-0 backdrop-blur">
      <div className="flex min-w-max items-center gap-6 whitespace-nowrap text-sm text-white/70 [animation:marquee_18s_linear_infinite]">
        {content.map((txt, index) => (
          <span key={`${txt}-${index}`} className="inline-flex items-center gap-3">
            <Dot className="h-2.5 w-2.5 text-[#F5D27A]/70" />
            {txt}
          </span>
        ))}
      </div>
    </div>
  );
}

function CitySilhouette({ style }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-center opacity-[0.025]">
      <svg
        width="1600"
        height="400"
        viewBox="0 0 1600 400"
        style={style}
        className="max-w-none"
        aria-hidden
      >
        <g fill="none" stroke="url(#cityGradient)" strokeWidth="2">
          <path d="M0 320 L120 320 L140 260 L160 320 L260 320 L280 200 L320 200 L360 320 L520 320 L540 240 L560 240 L580 320 L720 320 L740 180 L780 180 L800 320 L960 320 L980 240 L1000 240 L1020 320 L1180 320 L1200 220 L1240 220 L1280 320 L1440 320 L1460 260 L1480 260 L1500 320 L1600 320" />
          <path d="M0 360 L80 360 L100 300 L160 300 L180 360 L300 360 L320 280 L360 280 L380 360 L540 360 L560 300 L600 300 L620 360 L780 360 L800 260 L840 260 L860 360 L1000 360 L1020 300 L1060 300 L1080 360 L1240 360 L1260 280 L1300 280 L1320 360 L1600 360" strokeOpacity="0.6" />
        </g>
        <defs>
          <linearGradient id="cityGradient" x1="0" x2="1" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor="#00E5FF" />
            <stop offset="0.5" stopColor="#FF4DFF" />
            <stop offset="1" stopColor="#00E5FF" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5">
      <span className="text-white/50">{label}</span>
      <span className="font-semibold text-white/85">{value}</span>
    </span>
  );
}

function MobileStickyCTA({ humOn, toggleHum }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 block bg-gradient-to-t from-black/85 via-black/60 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-xl flex-col gap-3">
        <a
          href="#get-prana"
          className="inline-flex w-full items-center justify-center rounded-2xl border border-[#F5D27A]/40 bg-[#F5D27A] px-6 py-4 text-sm font-semibold text-black shadow-[0_0_38px_-16px_rgba(245,210,122,0.75)]"
        >
          Get PRANA
        </a>
        <button
          type="button"
          onClick={toggleHum}
          aria-pressed={humOn}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-xs font-semibold text-white/70"
        >
          <span className="relative inline-flex h-4 w-7 items-center rounded-full border border-white/20 bg-black/60">
            <span
              className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition ${
                humOn ? "left-[1.55rem] bg-[#F5D27A]" : "left-1 bg-white/70"
              }`}
            />
          </span>
          {humOn ? "Hum: On" : "Hum: Off"}
        </button>
      </div>
    </div>
  );
}

function Kebab(props) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <circle cx="10" cy="3.25" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="10" cy="16.75" r="1.5" />
    </svg>
  );
}

function ChevronRight(props) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path d="M7.4 4.4a1 1 0 0 1 1.4 0l4.5 4.5a1 1 0 0 1 0 1.4l-4.5 4.5a1 1 0 1 1-1.4-1.4L11.2 10 7.4 6.2a1 1 0 0 1 0-1.8z" />
    </svg>
  );
}

function Dot(props) {
  return (
    <svg viewBox="0 0 10 10" fill="currentColor" {...props}>
      <circle cx="5" cy="5" r="4" />
    </svg>
  );
}

function IncenseParticles({ count = 30, prefersReducedMotion = false }) {
  const seeds = useMemo(
    () =>
      new Array(count).fill(0).map(() => ({
        left: Math.random() * 100,
        delay: Math.random() * 4,
        duration: prefersReducedMotion ? 18 + Math.random() * 6 : 8 + Math.random() * 12,
        size: 1 + Math.random() * 3,
        blur: Math.random() * 2 + 0.4,
        opacity: prefersReducedMotion ? 0.12 : 0.18 + Math.random() * 0.12,
        amplitude: prefersReducedMotion ? 0 : Math.random() * 14 - 7,
      })),
    [count, prefersReducedMotion]
  );

  return (
    <div className="absolute inset-0" aria-hidden>
      {seeds.map((particle, index) => (
        <span
          key={index}
          className="absolute bottom-[-12%] block rounded-full bg-gradient-to-b from-[#8A7DFF]/45 to-[#22D3EE]/35"
          style={{
            left: `${particle.left}%`,
            width: `${particle.size}px`,
            height: `${particle.size * 12}px`,
            opacity: particle.opacity,
            filter: `blur(${particle.blur}px)` + (prefersReducedMotion ? "" : " saturate(140%)"),
            animation: `incense-rise ${particle.duration}s linear ${particle.delay}s infinite`,
            "--x-amp": `${particle.amplitude}px`,
            "--fade": `${particle.opacity}`,
          }}
        />
      ))}
    </div>
  );
}
 
