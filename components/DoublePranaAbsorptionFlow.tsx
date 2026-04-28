import React from 'react';
import type { SiteLocale } from '../types/locale.types';
import { motion } from 'framer-motion';
import { useBondStats } from '../hooks/useBondStats';
import { formatCurrency } from '../utils/formatters';
import { useSiteLanguage } from '../hooks/useSiteLanguage';
import { ArrowRight, Clock3, LockKeyhole, ScrollText, ShoppingCart, Sparkles } from 'lucide-react';

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

const wbtcParticles: StreamParticle[] = Array.from({ length: 20 }, (_, index) => ({
  id: `wbtc-${index}`,
  top: 12 + ((index * 31) % 72),
  delay: index * 0.18,
  duration: 4.8 + (index % 5) * 0.28,
  size: 3 + (index % 4),
}));

const pranaParticles: StreamParticle[] = Array.from({ length: 30 }, (_, index) => ({
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

const absorbedPranaTokens = Array.from({ length: 12 }, (_, index) => {
  const radius = 78 + (index % 5) * 16;
  const distancePath = [radius, radius * 0.96, radius * 0.88, radius * 0.76, radius * 0.62, radius * 0.46, radius * 0.3, radius * 0.16, radius * 0.08, 0];
  const tokenTimes = [0, 0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.88, 0.94, 1];
  const spin = 720 + (index % 4) * 90;

  return {
    id: `absorbed-prana-${index}`,
    startAngle: index * 30 + 16,
    endAngle: index * 30 + 16 + 1320,
    distancePath,
    opacityPath: [0, 0.75, 0.96, 0.92, 0.82, 0.65, 0.38, 0.12, 0, 0],
    scalePath: [0.18, 0.82, 1, 0.92, 0.78, 0.58, 0.36, 0.16, 0, 0],
    tokenTimes,
    delay: index * 0.42,
    duration: (6.6 + (index % 4) * 0.34) * ROTATION_SLOWDOWN,
    repeatDelay: 0.65 + (index % 3) * 0.28,
    spin,
    size: index % 3 === 0 ? 'h-8 w-8' : 'h-7 w-7',
  };
});

const copyByLocale = {
  en: {
    sectionAria: 'Double PRANA absorption flow visualization',
    badge: 'Dual PRANA Bonding Effect',
    title: 'One WBTC payment creates two supply-side effects',
    intro:
      '1. PRANA is distributed gradually through vesting.\n2. The protocol uses the same paid WBTC to create market buy pressure, then removes the repurchased PRANA from circulation.',
    steps: [
      {
        title: '1. Buy PRANA bond',
        body:
          'Users pay WBTC into BuyPranaBondV2 and receive a claim on PRANA, instead of PRANA being released to the market immediately.',
        visual: 'bitcoin',
        accent: 'text-amber-300',
      },
      {
        title: '2. Vested release',
        body:
          'Bonded PRANA unlocks gradually across the selected vesting period, turning the first absorption into a paced emission.',
        visual: 'clock',
        accent: 'text-cyan-300',
      },
      {
        title: '3. Protocol buyback',
        body: 'The protocol routes the paid WBTC toward the main Uniswap pool to market buy PRANA.',
        visual: 'buyback',
        accent: 'text-fuchsia-300',
      },
      {
        title: '4. Permanent removal',
        body:
          'Bought-back PRANA crosses the event horizon: out of market circulation forever.',
        visual: 'pranaLock',
        accent: 'text-emerald-300',
      },
    ],
    flow: {
      firstAbsorptionTitle: 'Effect 1',
      secondAbsorptionTitle: 'Effect 2',
      userLabel: 'User',
      wbtcTitle: 'WBTC enters',
      contractLabel: 'Contract',
      contractTitle: 'BuyPranaBondV2',
      bondRoute: 'bond route',
      vestingRoute: 'vested PRANA',
      vestingLabel: 'Vesting',
      vestingTitle: 'Slow unlock',
      protocolLabel: 'Protocol',
      protocolTitle: 'WBTC from the BuyBond contract is used by the Protocol to buy PRANA from the DEX pool',
    },
    blackHole: {
      outOfCirculation: 'Out of circulation',
      sinkTitle: 'Permanent PRANA sink',
      accretion: 'Buyback accretion disk',
      eventHorizon: 'Event horizon',
      caption:
        'PRANA is bought by the Protocol from the DEX pool, enters the HODL absorption core, and never return to the market.',
      sellBondPranaLabel: 'PRANA withdrawn from market',
    },
    alt: {
      bitcoin: 'Bitcoin token icon',
      prana: 'PRANA token icon',
    },
  },
  vi: {
    sectionAria: 'Minh họa dòng hấp thụ kép PRANA',
    badge: 'Tác động kép PRANA Bonding',
    title: 'Một khoản WBTC tạo ra hai tác động lên nguồn cung',
    intro:
      '1. PRANA được phân phối chậm qua vesting.\n2. Giao thức dùng chính WBTC đã trả để tạo lực mua trên thị trường, rồi đưa PRANA mua lại ra khỏi lưu thông.',
    steps: [
      {
        title: '1. Mua PRANA bond',
        body:
          'Người dùng trả WBTC vào BuyPranaBondV2 và nhận quyền nhận PRANA, thay vì PRANA được đưa ra thị trường ngay lập tức.',
        visual: 'bitcoin',
        accent: 'text-amber-300',
      },
      {
        title: '2. Mở khóa theo vesting',
        body:
          'PRANA từ bond được mở khóa dần theo thời gian đã chọn, biến nhánh hấp thụ đầu tiên thành dòng phát hành có nhịp.',
        visual: 'clock',
        accent: 'text-cyan-300',
      },
      {
        title: '3. Giao thức mua lại',
        body:
          'Giao thức chuyển WBTC đã nhận về pool Uniswap chính để market buy PRANA.',
        visual: 'buyback',
        accent: 'text-fuchsia-300',
      },
      {
        title: '4. Rút khỏi lưu thông',
        body:
          'PRANA được mua lại đi qua chân trời sự kiện: rời khỏi nguồn cung thị trường vĩnh viễn.',
        visual: 'pranaLock',
        accent: 'text-emerald-300',
      },
    ],
    flow: {
      firstAbsorptionTitle: 'Tác động lần 1',
      secondAbsorptionTitle: 'Tác động lần 2',
      userLabel: 'Người dùng',
      wbtcTitle: 'WBTC đi vào',
      contractLabel: 'Hợp đồng',
      contractTitle: 'BuyPranaBondV2',
      bondRoute: 'nhánh bond',
      vestingRoute: 'PRANA vesting',
      vestingLabel: 'Vesting',
      vestingTitle: 'Mở khóa chậm',
      protocolLabel: 'Giao thức',
      protocolTitle: 'WBTC từ hợp đồng BuyBond được Protocol dùng để mua PRANA từ DEX pool',
    },
    blackHole: {
      outOfCirculation: 'Rời khỏi lưu thông',
      sinkTitle: 'Hố hấp thụ PRANA vĩnh viễn',
      accretion: 'Đĩa bồi tụ từ buyback',
      eventHorizon: 'Chân trời sự kiện',
      caption:
        'PRANA được Protocol mua khỏi DEX pool, đi vào tâm hấp thụ HODL và không bao giờ quay lại thị trường.',
      sellBondPranaLabel: 'PRANA đã rút khỏi thị trường',
    },
    alt: {
      bitcoin: 'Biểu tượng Bitcoin',
      prana: 'Biểu tượng PRANA',
    },
  },
} satisfies Record<SiteLocale, {
  sectionAria: string;
  badge: string;
  title: string;
  intro: string;
  steps: Array<{
    title: string;
    body: string;
    visual: 'bitcoin' | 'clock' | 'buyback' | 'pranaLock';
    accent: string;
  }>;
  flow: {
    firstAbsorptionTitle: string;
    secondAbsorptionTitle: string;
    userLabel: string;
    wbtcTitle: string;
    contractLabel: string;
    contractTitle: string;
    bondRoute: string;
    vestingRoute: string;
    vestingLabel: string;
    vestingTitle: string;
    protocolLabel: string;
    protocolTitle: string;
  };
  blackHole: {
    outOfCirculation: string;
    sinkTitle: string;
    accretion: string;
    eventHorizon: string;
    caption: string;
    sellBondPranaLabel: string;
  };
  alt: {
    bitcoin: string;
    prana: string;
  };
}>;

const TokenIcon: React.FC<{
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

const StepVisual: React.FC<{
  visual: 'bitcoin' | 'clock' | 'buyback' | 'pranaLock';
  accent: string;
  alt: typeof copyByLocale.en.alt;
}> = ({ visual, accent, alt }) => {
  if (visual === 'bitcoin') {
    return <TokenIcon token="bitcoin" alt={alt.bitcoin} className="h-4 w-4" />;
  }

  if (visual === 'pranaLock') {
    return (
      <span className="relative grid h-5 w-5 place-items-center">
        <TokenIcon token="prana" alt={alt.prana} className="h-4 w-4" />
        <LockKeyhole className="absolute -right-1 -top-1 h-3 w-3 text-emerald-200" aria-hidden="true" />
      </span>
    );
  }

  const Icon = visual === 'clock' ? Clock3 : ShoppingCart;
  return <Icon className={`h-4 w-4 ${accent}`} aria-hidden="true" />;
};

const VerticalParticleStream: React.FC<{
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

const ContainedParticleField: React.FC<{
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

const FlowNode: React.FC<{
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

const FlowConnector: React.FC<{
  className?: string;
}> = ({ className = '' }) => (
  <div className={`relative flex min-h-10 flex-1 justify-center ${className}`} aria-hidden="true">
    <div className="absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-cyan-100/55 to-transparent shadow-[0_0_18px_rgba(103,232,249,0.5)]" />
    <div className="absolute inset-y-1 w-2 rounded-full bg-gradient-to-b from-amber-200/0 via-amber-200/20 to-cyan-200/0 blur-sm" />
  </div>
);

const GravityWell: React.FC<{
  alt: typeof copyByLocale.en.alt;
}> = ({ alt }) => (
  <div className="relative mx-auto aspect-square w-[min(82vw,22rem)] sm:w-full" aria-hidden="true">
    <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(103,232,249,0.18)_0%,rgba(168,85,247,0.12)_34%,transparent_68%)] blur-xl" />

    <motion.div
      className="absolute inset-[4%] rounded-full border border-cyan-200/10"
      animate={{ rotate: 360 }}
      transition={{ duration: 28 * ROTATION_SLOWDOWN, repeat: Infinity, ease: 'linear' }}
    >
      <div className="absolute left-1/2 top-0 h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
      <div className="absolute bottom-3 right-8 h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.85)]" />
    </motion.div>

    <motion.div
      className="absolute inset-[8%] rounded-full bg-[conic-gradient(from_120deg,transparent_0deg,rgba(251,191,36,0.72)_42deg,rgba(217,70,239,0.44)_82deg,transparent_130deg,rgba(34,211,238,0.46)_205deg,rgba(251,191,36,0.64)_255deg,transparent_318deg)] blur-[0.5px] shadow-[0_0_54px_rgba(217,70,239,0.28)]"
      animate={{ rotate: 360, scale: [1, 1.015, 1] }}
      transition={{ duration: 16 * ROTATION_SLOWDOWN, repeat: Infinity, ease: 'linear' }}
    />
    <motion.div
      className="absolute inset-[15%] rounded-full border border-amber-100/25 bg-[radial-gradient(ellipse_at_center,transparent_32%,rgba(251,191,36,0.2)_47%,transparent_61%)]"
      animate={{ rotate: -360 }}
      transition={{ duration: 12 * ROTATION_SLOWDOWN, repeat: Infinity, ease: 'linear' }}
    />
    <motion.div
      className="absolute left-[9%] right-[9%] top-[39%] h-[22%] rounded-[999px] bg-[linear-gradient(90deg,transparent,rgba(251,191,36,0.92),rgba(34,211,238,0.58),rgba(217,70,239,0.78),transparent)] blur-sm"
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

    {absorbedPranaTokens.map((token) => (
      <motion.div
        key={token.id}
        className="absolute left-1/2 top-1/2 h-0 w-0"
        initial={{ rotate: token.startAngle }}
        animate={{ rotate: token.endAngle }}
        transition={{
          duration: token.duration,
          delay: token.delay,
          repeat: Infinity,
          repeatDelay: token.repeatDelay,
          ease: 'linear',
        }}
      >
        <motion.div
          className={`grid ${token.size} place-items-center rounded-full border border-cyan-100/20 bg-black/55 p-1 shadow-[0_0_20px_rgba(34,211,238,0.45)] backdrop-blur-sm`}
          initial={{
            x: token.distancePath[0],
            y: '-50%',
            opacity: 0,
            scale: 0.18,
            rotate: 0,
          }}
          animate={{
            x: token.distancePath,
            opacity: token.opacityPath,
            scale: token.scalePath,
            rotate: token.tokenTimes.map((stop) => -token.spin * stop),
          }}
          transition={{
            duration: token.duration,
            delay: token.delay,
            repeat: Infinity,
            repeatDelay: token.repeatDelay,
            ease: 'linear',
            times: token.tokenTimes,
          }}
        >
          <TokenIcon token="prana" alt={alt.prana} className="h-full w-full" />
        </motion.div>
      </motion.div>
    ))}

    {sinkParticles.map((particle) => (
      <motion.div
        key={particle.id}
        className="absolute left-1/2 top-1/2 h-0 w-0"
        initial={{ rotate: particle.startAngle }}
        animate={{ rotate: particle.endAngle }}
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
    ))}

  </div>
);

const DoublePranaAbsorptionFlow: React.FC = () => {
  const { locale } = useSiteLanguage();
  const copy = copyByLocale[locale];
  const { isLoading: isBondStatsLoading, sellBondPrana } = useBondStats();
  const sellBondPranaValue = isBondStatsLoading
    ? 'Loading...'
    : `${formatCurrency(sellBondPrana, 'PRANA')} PRANA`;

  return (
    <section
      className="relative z-20 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
      aria-label={copy.sectionAria}
    >
      <motion.div
        className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6 }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(245,158,11,0.18),transparent_30%),radial-gradient(circle_at_84%_24%,rgba(34,211,238,0.15),transparent_32%),radial-gradient(circle_at_70%_82%,rgba(217,70,239,0.16),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent" />

        <div className="relative grid gap-8 p-5 sm:p-6 lg:grid-cols-[0.98fr_1.02fr] lg:p-8">
          <div className="flex min-w-0 flex-col justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {copy.badge}
              </div>
              <h2 className="mt-4 max-w-2xl text-2xl font-semibold tracking-normal text-white sm:text-3xl">
                {copy.title}
              </h2>
              <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-6 text-white/68 sm:text-base">
                {copy.intro}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {copy.steps.map((step) => (
                <div key={step.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-2">
                    <StepVisual visual={step.visual} accent={step.accent} alt={copy.alt} />
                    <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/62">{step.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[39rem] min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4 sm:min-h-[34rem] lg:min-h-[31rem]">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:48px_48px] opacity-40" />

            <div className="relative grid h-full min-w-0 gap-5 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
              <div className="relative flex min-h-[21rem] min-w-0 flex-col gap-4 lg:min-h-[26rem]">
                <h3 className="w-full text-center text-sm font-semibold uppercase tracking-[0.2em] text-amber-100 lg:max-w-[14rem] lg:self-center">
                  {copy.flow.firstAbsorptionTitle}
                </h3>

                <div className="relative flex min-h-[21rem] min-w-0 flex-1 flex-col items-center">
                  <VerticalParticleStream
                    particles={wbtcParticles}
                    className="left-1/2 top-[5.2rem] z-10 h-[6.4rem] w-20 -translate-x-1/2"
                    particleClassName="bg-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.9)]"
                    token="bitcoin"
                  />

                  <FlowNode
                    title={copy.flow.wbtcTitle}
                    label={copy.flow.userLabel}
                    visual={<TokenIcon token="bitcoin" alt={copy.alt.bitcoin} className="h-7 w-7" />}
                    className="w-full lg:max-w-[14rem]"
                  >
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_68%,rgba(251,191,36,0.14),transparent_42%)]" />
                  </FlowNode>

                  <FlowConnector />

                  <FlowNode
                    title={copy.flow.contractTitle}
                    label={copy.flow.contractLabel}
                    visual={<ScrollText className="h-5 w-5 text-amber-200" aria-hidden="true" />}
                    className="w-full lg:max-w-[14rem] border-amber-200/20 bg-amber-300/[0.06]"
                  >
                    <ContainedParticleField
                      particles={wbtcParticles}
                      className="inset-x-8 bottom-5 top-[4.1rem]"
                      particleClassName="bg-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.9)]"
                      token="bitcoin"
                    />
                    <ContainedParticleField
                      particles={pranaParticles}
                      className="inset-x-7 bottom-5 top-[4.4rem]"
                      particleClassName="bg-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.95)]"
                      token="prana"
                      reverse
                    />
                  </FlowNode>

                  <FlowConnector className="opacity-90" />

                  <FlowNode
                    title={copy.flow.vestingTitle}
                    label={copy.flow.vestingLabel}
                    visual={<TokenIcon token="prana" alt={copy.alt.prana} className="h-7 w-7" />}
                    className="w-full lg:max-w-[14rem] border-cyan-200/20 bg-cyan-300/[0.06]"
                  >
                    <ContainedParticleField
                      particles={pranaParticles}
                      className="left-1/2 bottom-5 top-[4.2rem] w-28 -translate-x-1/2"
                      particleClassName="bg-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.95)]"
                      token="prana"
                    />
                  </FlowNode>
                </div>
              </div>

              <div className="relative flex min-h-[25rem] min-w-0 flex-col items-center justify-start lg:min-h-[29rem]">
                <h3 className="mb-4 w-full text-center text-sm font-semibold uppercase tracking-[0.2em] text-fuchsia-100">
                  {copy.flow.secondAbsorptionTitle}
                </h3>

                <div className="mb-2 flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/[0.06] px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.18em] text-fuchsia-200/70">{copy.flow.protocolLabel}</div>
                    <div className="mt-1 break-words font-semibold text-white">{copy.flow.protocolTitle}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <TokenIcon token="bitcoin" alt={copy.alt.bitcoin} className="h-5 w-5" />
                    <ArrowRight className="h-4 w-4 text-white/45" aria-hidden="true" />
                    <TokenIcon token="prana" alt={copy.alt.prana} className="h-5 w-5" />
                  </div>
                </div>

                <GravityWell alt={copy.alt} />

                <p className="mt-3 w-full text-center text-sm leading-6 text-white/62">
                  {copy.blackHole.caption}
                </p>
                <div className="mt-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-2 text-center">
                  <div className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-emerald-100/70">
                    {copy.blackHole.sellBondPranaLabel}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-emerald-50">
                    {sellBondPranaValue}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default DoublePranaAbsorptionFlow;
