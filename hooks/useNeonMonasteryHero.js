import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_SNAPBACK_DELAY = 6000;
const DEFAULT_BASE_FREQ = 52;

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;

    const handleChange = (event) => {
      setPrefersReducedMotion(event.matches);
    };

    setPrefersReducedMotion(query.matches);
    query.addEventListener("change", handleChange);

    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

export function useNeonMonasteryHero({ baseHumFrequency = DEFAULT_BASE_FREQ } = {}) {
  const [humOn, setHumOn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [velocity, setVelocity] = useState(0);
  const [showFallback, setShowFallback] = useState(false);
  const [coinReady, setCoinReady] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);

  const coinApiRef = useRef(null);
  const headingRef = useRef(null);
  const glitchTimerRef = useRef(null);
  const audioRef = useRef({ ctx: null, osc: null, gain: null });
  const parallaxOffsetRef = useRef(0);
  const velocityRef = useRef(0);
  const velocityFrameRef = useRef(null);
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();

  const toggleMenu = useCallback(() => setMenuOpen((state) => !state), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const toggleHum = useCallback(() => {
    setHumOn((state) => !state);
  }, []);

  const registerVelocity = useCallback((value) => {
    velocityRef.current = value;
    if (velocityFrameRef.current !== null) return;
    velocityFrameRef.current = window.requestAnimationFrame(() => {
      velocityFrameRef.current = null;
      setVelocity(velocityRef.current);
    });
  }, []);

  const markCoinReady = useCallback(() => {
    setCoinReady(true);
    setShowFallback(false);
  }, []);

  const markCoinFailed = useCallback(() => {
    setCoinReady(false);
    setShowFallback(true);
  }, []);

  const enableGlitch = useCallback(() => {
    if (prefersReducedMotion) return;
    setGlitchActive(true);
    if (glitchTimerRef.current) window.clearTimeout(glitchTimerRef.current);
    glitchTimerRef.current = window.setTimeout(() => {
      setGlitchActive(false);
      glitchTimerRef.current = null;
    }, 160);
  }, [prefersReducedMotion]);

  const handleHeadingHover = useCallback(() => {
    enableGlitch();
  }, [enableGlitch]);

  const handleHeadingBlur = useCallback(() => {}, []);

  const handleHeadingAnimationEnd = useCallback(() => {
    setGlitchActive(false);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;

    const element = headingRef.current;
    if (!element) return undefined;

    let hasTriggeredOnce = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasTriggeredOnce) {
          hasTriggeredOnce = true;
          enableGlitch();
        }
      });
    }, { threshold: 0.35 });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [enableGlitch, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setParallaxOffset(0);
      return undefined;
    }

    const onScroll = () => {
      const next = Math.max(0, window.scrollY * 0.12);
      parallaxOffsetRef.current = next;
      setParallaxOffset(next);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!humOn) {
      const current = audioRef.current;
      if (current?.osc) {
        try {
          current.osc.stop();
          current.gain.disconnect();
          current.osc.disconnect();
        } catch (_) {
          // noop
        }
      }
      if (current?.ctx) {
        try {
          current.ctx.close();
        } catch (_) {
          // noop
        }
      }
      audioRef.current = { ctx: null, osc: null, gain: null };
      return undefined;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return undefined;

    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = baseHumFrequency;
    gain.gain.value = prefersReducedMotion ? 0.02 : 0.035;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    audioRef.current = { ctx, osc: oscillator, gain };

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    return () => {
      try {
        oscillator.stop();
        gain.disconnect();
        oscillator.disconnect();
        ctx.close();
      } catch (_) {
        // noop
      }
      audioRef.current = { ctx: null, osc: null, gain: null };
    };
  }, [humOn, baseHumFrequency, prefersReducedMotion]);

  useEffect(() => {
    if (!humOn) return undefined;
    const audio = audioRef.current;
    if (!audio?.ctx) return undefined;

    const now = audio.ctx.currentTime;
    const clampedVelocity = Math.min(velocity, 6);
    const nextFrequency = baseHumFrequency + clampedVelocity * 4;
    const targetGain = prefersReducedMotion ? 0.025 : 0.035 + clampedVelocity * 0.012;

    try {
      audio.osc.frequency.setTargetAtTime(nextFrequency, now, 0.18);
      audio.gain.gain.setTargetAtTime(Math.min(0.085, targetGain), now, 0.24);
    } catch (_) {
      // noop
    }

    return undefined;
  }, [velocity, humOn, baseHumFrequency, prefersReducedMotion]);

  useEffect(() => () => {
    if (glitchTimerRef.current) {
      window.clearTimeout(glitchTimerRef.current);
      glitchTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (velocityFrameRef.current !== null) {
      window.cancelAnimationFrame(velocityFrameRef.current);
      velocityFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (coinReady) return undefined;
    const timeout = window.setTimeout(() => {
      if (!coinReady) {
        setShowFallback(true);
      }
    }, 2800);
    return () => window.clearTimeout(timeout);
  }, [coinReady]);

  const handleCoinKeyDown = useCallback((event) => {
    if (!coinApiRef.current) return;

    const nudges = {
      ArrowLeft: { dx: -1, dy: 0 },
      ArrowRight: { dx: 1, dy: 0 },
      ArrowUp: { dx: 0, dy: -1 },
      ArrowDown: { dx: 0, dy: 1 },
    };

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      coinApiRef.current.impulseSpin();
      return;
    }

    const nudge = nudges[event.key];
    if (nudge) {
      event.preventDefault();
      coinApiRef.current.nudge(nudge);
    }
  }, []);

  const citylineStyle = useMemo(
    () => ({ transform: `translate3d(0, ${parallaxOffset * -0.35}px, 0)` }),
    [parallaxOffset]
  );

  const marqueeItems = useMemo(
    () => ["Bonding V2", "Staking 12% APR", "Cross-chain ready"],
    []
  );

  const statChips = useMemo(
    () => [
      { label: "Price (sats)", value: "––" },
      { label: "Liquidity ratio", value: "––" },
      { label: "24h volume", value: "––" },
    ],
    []
  );

  return {
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
    snapbackDelay: DEFAULT_SNAPBACK_DELAY,
    snapbackTarget: { x: 0, y: (25 * Math.PI) / 180 },
  };
}

export default useNeonMonasteryHero;

