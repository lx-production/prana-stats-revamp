import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import InfoTooltip from './InfoTooltip';
import type { DoublePranaAltCopy, DoublePranaSideCopy } from '../types/doublePranaAbsorptionFlow.types';

const BITCOIN_ICON = '/assets/icons/bitcoin.svg';
const PRANA_ICON = '/assets/icons/prana.svg';
const ROTATION_SLOWDOWN = 2;

type StreamParticle = {
  id: string;
  top: number;
  delay: number;
  duration: number;
  size: number;
};

export const wbtcParticles: StreamParticle[] = Array.from({ length: 20 }, (_, index) => ({
  id: `wbtc-${index}`,
  top: 12 + ((index * 31) % 72),
  delay: index * 0.18,
  duration: 4.8 + (index % 5) * 0.28,
  size: 3 + (index % 4),
}));

export const pranaParticles: StreamParticle[] = Array.from({ length: 30 }, (_, index) => ({
  id: `prana-${index}`,
  top: 10 + ((index * 23) % 76),
  delay: index * 0.12,
  duration: 3.9 + (index % 6) * 0.18,
  size: 2 + (index % 5),
}));

const sinkParticles = Array.from({ length: 54 }, (_, index) => {
  const radius = 42 + (index % 8) * 8;

  return {
    id: `sink-${index}`,
    startAngle: index * 6.67,
    endAngle: index * 6.67 + 960,
    distancePath: [radius, radius * 0.94, radius * 0.82, radius * 0.66, radius * 0.48, radius * 0.3, radius * 0.12, 0],
    opacityPath: [0, 0.92, 0.95, 0.82, 0.58, 0.28, 0, 0],
    scalePath: [0.55, 1, 0.9, 0.74, 0.52, 0.28, 0, 0],
    times: [0, 0.12, 0.28, 0.45, 0.62, 0.78, 0.92, 1],
    delay: index * 0.07,
    duration: (4.8 + (index % 7) * 0.22) * ROTATION_SLOWDOWN,
  };
});

const PRANA_TOKEN_TIMES = [0, 0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.88, 0.94, 1];
const PRANA_TOKEN_COUNT_MIN = 6;
const PRANA_TOKEN_COUNT_MAX = 16;

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const randomInt = (min: number, max: number) => Math.floor(randomBetween(min, max + 1));

type AbsorbedPranaTokenParams = {
  startAngle: number;
  endAngle: number;
  distancePath: number[];
  opacityPath: number[];
  scalePath: number[];
  delay: number;
  duration: number;
  spin: number;
  size: string;
  spawnYOffset: number;
  sellStartOffset: number;
};

const createAbsorbedPranaTokenParams = (variant: 'buy' | 'sell'): AbsorbedPranaTokenParams => {
  const startRadius = randomBetween(52, 152);
  const distancePath = [
    startRadius,
    startRadius * randomBetween(0.9, 0.98),
    startRadius * randomBetween(0.76, 0.9),
    startRadius * randomBetween(0.58, 0.76),
    startRadius * randomBetween(0.38, 0.6),
    startRadius * randomBetween(0.2, 0.4),
    startRadius * randomBetween(0.08, 0.22),
    startRadius * randomBetween(0.02, 0.1),
    startRadius * randomBetween(0, 0.05),
    0,
  ];
  const startAngle = randomBetween(0, 360);
  const rotationAmount = randomBetween(840, 1620);

  return {
    startAngle,
    endAngle: startAngle + rotationAmount,
    distancePath,
    opacityPath: [0, randomBetween(0.62, 0.82), 0.96, 0.92, 0.82, 0.65, 0.38, 0.12, 0, 0],
    scalePath: [randomBetween(0.14, 0.24), 0.82, 1, 0.92, 0.78, 0.58, 0.36, 0.16, 0, 0],
    delay: randomBetween(0, 5.2),
    duration: randomBetween(5.2, 8.8) * ROTATION_SLOWDOWN,
    spin: randomBetween(480, 1140),
    size: Math.random() > 0.38 ? 'h-8 w-8' : 'h-7 w-7',
    spawnYOffset: randomBetween(-14, 14),
    sellStartOffset: variant === 'sell' ? randomBetween(8, 52) : 0,
  };
};

const createPranaTokenSlots = (count: number) =>
  Array.from({ length: count }, (_, index) => `prana-slot-${index}-${Math.random().toString(36).slice(2, 8)}`);

const PranaAbsorptionToken: React.FC<{
  alt: string;
  variant: 'buy' | 'sell';
}> = ({ alt, variant }) => {
  const [cycleKey, setCycleKey] = useState(0);
  const [token, setToken] = useState(() => createAbsorbedPranaTokenParams(variant));

  const handleCycleComplete = () => {
    setToken(createAbsorbedPranaTokenParams(variant));
    setCycleKey((current) => current + 1);
  };

  return (
    <motion.div
      key={cycleKey}
      className="absolute left-1/2 top-1/2 h-0 w-0"
      initial={{ rotate: token.startAngle + token.sellStartOffset }}
      animate={{ rotate: token.endAngle + token.sellStartOffset }}
      transition={{
        duration: token.duration,
        delay: token.delay,
        ease: 'linear',
      }}
      onAnimationComplete={handleCycleComplete}
    >
      <motion.div
        className={`grid ${token.size} place-items-center rounded-full border border-cyan-100/20 bg-black/55 p-1 shadow-[0_0_20px_rgba(34,211,238,0.45)] backdrop-blur-sm`}
        initial={{
          x: token.distancePath[0],
          y: `calc(-50% + ${token.spawnYOffset}px)`,
          opacity: 0,
          scale: token.scalePath[0],
          rotate: 0,
        }}
        animate={{
          x: token.distancePath,
          opacity: token.opacityPath,
          scale: token.scalePath,
          rotate: PRANA_TOKEN_TIMES.map((stop) => -token.spin * stop),
        }}
        transition={{
          duration: token.duration,
          delay: token.delay,
          ease: 'linear',
          times: PRANA_TOKEN_TIMES,
        }}
      >
        <TokenIcon token="prana" alt={alt} className="h-full w-full" />
      </motion.div>
    </motion.div>
  );
};

export const TokenIcon: React.FC<{
  token: 'bitcoin' | 'prana';
  alt?: string;
  className?: string;
  decorative?: boolean;
}> = ({ token, alt = '', className = '', decorative = false }) => (
  <img
    src={token === 'bitcoin' ? BITCOIN_ICON : PRANA_ICON}
    alt={decorative ? '' : alt}
    aria-hidden={decorative}
    className={className}
    draggable={false}
  />
);

export const VerticalParticleStream: React.FC<{
  particles: StreamParticle[];
  className: string;
  particleClassName: string;
  token?: 'bitcoin' | 'prana';
}> = ({ particles, className, particleClassName, token }) => (
  <div className={`pointer-events-none absolute overflow-hidden ${className}`} aria-hidden="true">
    {particles.map((particle, index) => (
      <motion.span
        key={particle.id}
        className={`absolute grid place-items-center rounded-full ${particleClassName}`}
        style={{
          left: `${particle.top}%`,
          width: particle.size,
          height: particle.size * 4.2,
        }}
        initial={{ top: '-18%', opacity: 0, scale: 0.72 }}
        animate={{ top: '118%', opacity: [0, 0.95, 0.82, 0], scale: [0.72, 1.12, 0.88] }}
        transition={{
          duration: particle.duration * 1.08,
          delay: particle.delay,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        {token && index % 4 === 0 ? (
          <TokenIcon token={token} decorative className="h-3.5 w-3.5 min-w-3.5" />
        ) : null}
      </motion.span>
    ))}
  </div>
);

export const ContainedParticleField: React.FC<{
  particles: StreamParticle[];
  className?: string;
  particleClassName: string;
  token?: 'bitcoin' | 'prana';
  reverse?: boolean;
}> = ({ particles, className = '', particleClassName, token, reverse = false }) => (
  <div className={`pointer-events-none absolute overflow-hidden ${className}`} aria-hidden="true">
    {particles.map((particle, index) => {
      const xStart = 16 + ((index * 29) % 68);
      const xEnd = reverse ? xStart - 10 - (index % 4) * 4 : xStart + 10 + (index % 4) * 4;
      const yStart = 18 + ((index * 17) % 62);
      const yEnd = yStart + (index % 2 === 0 ? 10 : -8);

      return (
        <motion.span
          key={particle.id}
          className={`absolute grid place-items-center rounded-full ${particleClassName}`}
          style={{
            left: `${xStart}%`,
            top: `${yStart}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            x: [`0%`, `${xEnd - xStart}%`, '0%'],
            y: ['0%', `${yEnd - yStart}%`, '0%'],
            opacity: [0.18, 0.88, 0.46, 0.18],
            scale: [0.72, 1.12, 0.92, 0.72],
          }}
          transition={{
            duration: particle.duration * 0.95,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {token && index % 8 === 0 ? (
            <TokenIcon token={token} decorative className="h-3.5 w-3.5 min-w-3.5" />
          ) : null}
        </motion.span>
      );
    })}
  </div>
);

export const FlowNode: React.FC<{
  title: string;
  label: string;
  visual: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}> = ({ title, label, visual, className = '', children }) => (
  <motion.div
    className={`relative min-h-[9rem] min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md ${className}`}
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.45 }}
    transition={{ duration: 0.5 }}
  >
    {children}
    <div className="relative z-10 flex items-center gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10">
        {visual}
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-[0.22em] text-white/45">{label}</div>
        <div className="mt-1 break-words text-base font-semibold text-white">{title}</div>
      </div>
    </div>
  </motion.div>
);

export const FlowConnector: React.FC<{
  className?: string;
}> = ({ className = '' }) => (
  <div className={`relative flex min-h-10 flex-1 justify-center ${className}`} aria-hidden="true">
    <div className="absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-cyan-100/55 to-transparent shadow-[0_0_18px_rgba(103,232,249,0.5)]" />
    <div className="absolute inset-y-1 w-2 rounded-full bg-gradient-to-b from-amber-200/0 via-amber-200/20 to-cyan-200/0 blur-sm" />
  </div>
);

export const GravityWell: React.FC<{
  alt: DoublePranaAltCopy;
  variant?: 'buy' | 'sell';
}> = ({ alt, variant = 'buy' }) => {
  const [pranaTokenSlots, setPranaTokenSlots] = useState(() =>
    createPranaTokenSlots(randomInt(PRANA_TOKEN_COUNT_MIN, PRANA_TOKEN_COUNT_MAX)),
  );

  useEffect(() => {
    let timeoutId = 0;

    const scheduleNextCountShift = () => {
      timeoutId = window.setTimeout(() => {
        setPranaTokenSlots((currentSlots) => {
          const delta = Math.random() > 0.45 ? 1 : -1;
          const nextCount = Math.min(
            PRANA_TOKEN_COUNT_MAX,
            Math.max(PRANA_TOKEN_COUNT_MIN, currentSlots.length + delta),
          );

          if (nextCount === currentSlots.length) {
            return currentSlots;
          }

          if (nextCount > currentSlots.length) {
            const extraSlots = createPranaTokenSlots(nextCount - currentSlots.length);
            return [...currentSlots, ...extraSlots];
          }

          return currentSlots.slice(0, nextCount);
        });

        scheduleNextCountShift();
      }, randomBetween(7000, 13000));
    };

    scheduleNextCountShift();

    return () => window.clearTimeout(timeoutId);
  }, []);

  const phase = variant === 'sell' ? 136 : 0;
  const haloClassName = variant === 'sell'
    ? 'absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18)_0%,rgba(34,211,238,0.12)_36%,transparent_68%)] blur-xl'
    : 'absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(103,232,249,0.18)_0%,rgba(168,85,247,0.12)_34%,transparent_68%)] blur-xl';
  const diskClassName = variant === 'sell'
    ? 'absolute inset-[8%] rounded-full bg-[conic-gradient(from_260deg,transparent_0deg,rgba(34,211,238,0.68)_38deg,rgba(16,185,129,0.5)_96deg,transparent_150deg,rgba(251,191,36,0.48)_224deg,rgba(34,211,238,0.62)_284deg,transparent_330deg)] blur-[0.5px] shadow-[0_0_54px_rgba(16,185,129,0.25)]'
    : 'absolute inset-[8%] rounded-full bg-[conic-gradient(from_120deg,transparent_0deg,rgba(251,191,36,0.72)_42deg,rgba(217,70,239,0.44)_82deg,transparent_130deg,rgba(34,211,238,0.46)_205deg,rgba(251,191,36,0.64)_255deg,transparent_318deg)] blur-[0.5px] shadow-[0_0_54px_rgba(217,70,239,0.28)]';
  const streamClassName = variant === 'sell'
    ? 'absolute left-[9%] right-[9%] top-[39%] h-[22%] rounded-[999px] bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.82),rgba(16,185,129,0.7),rgba(251,191,36,0.72),transparent)] blur-sm'
    : 'absolute left-[9%] right-[9%] top-[39%] h-[22%] rounded-[999px] bg-[linear-gradient(90deg,transparent,rgba(251,191,36,0.92),rgba(34,211,238,0.58),rgba(217,70,239,0.78),transparent)] blur-sm';

  return (
  <div className="relative mx-auto w-full max-w-[22rem] overflow-hidden" aria-hidden="true">
    <div className="relative aspect-square w-full">
    <div className={haloClassName} />
    <div className="absolute inset-0" style={{ transform: `rotate(${phase}deg)` }}>

    <motion.div
      className="absolute inset-[4%] rounded-full border border-cyan-200/10"
      animate={{ rotate: 360 }}
      transition={{ duration: 28 * ROTATION_SLOWDOWN, repeat: Infinity, ease: 'linear' }}
    >
      <div className="absolute left-1/2 top-0 h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
      <div className="absolute bottom-3 right-8 h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.85)]" />
    </motion.div>

    <motion.div
      className={diskClassName}
      animate={{ rotate: 360, scale: [1, 1.015, 1] }}
      transition={{ duration: 16 * ROTATION_SLOWDOWN, repeat: Infinity, ease: 'linear' }}
    />
    <motion.div
      className="absolute inset-[15%] rounded-full border border-amber-100/25 bg-[radial-gradient(ellipse_at_center,transparent_32%,rgba(251,191,36,0.2)_47%,transparent_61%)]"
      animate={{ rotate: -360 }}
      transition={{ duration: 12 * ROTATION_SLOWDOWN, repeat: Infinity, ease: 'linear' }}
    />
    <motion.div
      className={streamClassName}
      animate={{ opacity: [0.58, 0.95, 0.58], scaleX: [0.94, 1.03, 0.94] }}
      transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
    />

    <motion.div
      className="absolute inset-[23%] rounded-full border border-cyan-200/25 bg-[conic-gradient(from_180deg,transparent,rgba(34,211,238,0.28),transparent,rgba(217,70,239,0.32),transparent)]"
      animate={{ rotate: -360, scale: [1, 1.04, 1] }}
      transition={{ duration: 7.4 * ROTATION_SLOWDOWN, repeat: Infinity, ease: 'easeInOut' }}
    />
    <div className="absolute inset-[33%] rounded-full border border-white/10 bg-[radial-gradient(circle_at_center,rgba(0,0,0,1)_0%,rgba(0,0,0,0.98)_54%,rgba(24,9,42,0.92)_70%,rgba(168,85,247,0.32)_100%)] shadow-[0_0_38px_rgba(0,0,0,1),0_0_88px_rgba(168,85,247,0.76),inset_0_0_36px_rgba(0,0,0,1)]" />
    <div className="absolute inset-[42%] rounded-full bg-black shadow-[0_0_24px_rgba(0,0,0,1)]" />

    {pranaTokenSlots.map((slotId) => (
      <PranaAbsorptionToken key={slotId} alt={alt.prana} variant={variant} />
    ))}

    {sinkParticles.map((particle, index) => {
      const sellStartOffset = variant === 'sell' ? -24 - (index % 6) * 7 : 0;

      return (
      <motion.div
        key={particle.id}
        className="absolute left-1/2 top-1/2 h-0 w-0"
        initial={{ rotate: particle.startAngle + sellStartOffset }}
        animate={{ rotate: particle.endAngle + sellStartOffset }}
        transition={{
          duration: particle.duration,
          delay: particle.delay,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        <motion.span
          className="absolute left-0 top-0 h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(103,232,249,0.95)]"
          initial={{
            x: particle.distancePath[0],
            y: '-50%',
            opacity: 0,
            scale: 0.55,
          }}
          animate={{
            x: particle.distancePath,
            opacity: particle.opacityPath,
            scale: particle.scalePath,
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'linear',
            times: particle.times,
          }}
        />
      </motion.div>
      );
    })}

    </div>
    </div>
  </div>
  );
};

const LaneNode: React.FC<{
  label: string;
  title: string;
  visual: React.ReactNode;
  className?: string;
}> = ({ label, title, visual, className = '' }) => (
  <div
    className={`flex w-full min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 backdrop-blur-md ${className}`}
  >
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/10">
      {visual}
    </div>
    <div className="min-w-0">
      <div className="text-[0.6rem] uppercase tracking-[0.2em] text-white/45">{label}</div>
      <div className="mt-0.5 break-words text-sm font-semibold text-white">{title}</div>
    </div>
  </div>
);

const LaneConnector: React.FC = () => (
  <div
    className="relative h-5 w-px bg-gradient-to-b from-cyan-100/10 via-cyan-100/60 to-cyan-100/10 shadow-[0_0_14px_rgba(103,232,249,0.45)]"
    aria-hidden="true"
  />
);

const laneMetricStyles = {
  emerald: {
    container: 'rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-2 text-center',
    label: 'relative inline-flex items-center justify-center gap-1.5 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-emerald-100/70',
    value: 'mt-1 text-base font-semibold text-emerald-50',
  },
  cyan: {
    container: 'rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-center',
    label: 'relative inline-flex items-center justify-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-cyan-100/70',
    value: 'mt-1 text-base font-semibold text-cyan-100',
  },
} as const;

export const LaneMetric: React.FC<{
  label: string;
  tooltip: string;
  ariaLabel: string;
  value: string;
  className?: string;
  variant?: keyof typeof laneMetricStyles;
}> = ({ label, tooltip, ariaLabel, value, className = '', variant = 'emerald' }) => {
  const styles = laneMetricStyles[variant];

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.label}>
        <span>{label}</span>
        <InfoTooltip
          ariaLabel={ariaLabel}
          text={tooltip}
          positionClassName="top-full left-1/2 mt-2 -translate-x-1/2"
          widthClassName="w-[min(18rem,calc(100vw-2rem))]"
        />
      </div>
      <div className={styles.value}>{value}</div>
    </div>
  );
};

export const AbsorptionLane: React.FC<{
  side: DoublePranaSideCopy;
  alt: DoublePranaAltCopy;
  headerAccent: string;
  bridgeAccent: string;
  entryVisual: React.ReactNode;
  contractVisual: React.ReactNode;
  vestingVisual: React.ReactNode;
  metricValue: string;
  gravityWellVariant?: 'buy' | 'sell';
}> = ({ side, alt, headerAccent, bridgeAccent, entryVisual, contractVisual, vestingVisual, metricValue, gravityWellVariant = 'buy' }) => (
  <div className="relative flex h-full min-w-0 flex-col items-center">
    <h3 className={`w-full text-center text-sm font-semibold uppercase tracking-[0.2em] ${headerAccent}`}>
      {side.laneTitle}
    </h3>

    <div className="mt-4 flex w-full min-w-0 flex-col items-center">
      <LaneNode label={side.user.label} title={side.user.title} visual={entryVisual} />
      <LaneConnector />
      <LaneNode label={side.contract.label} title={side.contract.title} visual={contractVisual} />
      <LaneConnector />
      <LaneNode label={side.vesting.label} title={side.vesting.title} visual={vestingVisual} />
    </div>

    <div className={`mt-3 w-full break-words rounded-xl border px-3 py-2 text-center text-xs font-medium ${bridgeAccent}`}>
      {side.bridgeTitle}
    </div>

    <div className="w-full min-w-0">
      <GravityWell alt={alt} variant={gravityWellVariant} />
    </div>

    <div className="min-h-0 flex-1" aria-hidden="true" />

    <p className="mt-2 min-h-[3.75rem] w-full text-center text-xs leading-5 text-white/62">
      {side.sinkCaption}
    </p>

    <LaneMetric
      label={side.metricLabel}
      tooltip={side.metricTooltip}
      ariaLabel={side.metricLabel}
      value={metricValue}
      className="mt-2 w-full"
    />
  </div>
);
