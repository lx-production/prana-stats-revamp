import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Clock3,
  LockKeyhole,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';
import { useSiteLanguage } from '../hooks/useSiteLanguage';
import type { SiteLocale } from '../types/locale.types';

const BITCOIN_ICON = '/assets/icons/bitcoin.svg';
const PRANA_ICON = '/assets/icons/prana.svg';

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

const sinkParticles = Array.from({ length: 54 }, (_, index) => ({
  id: `sink-${index}`,
  angle: index * 6.67,
  radius: 42 + (index % 8) * 8,
  delay: index * 0.07,
  duration: 3.1 + (index % 7) * 0.2,
}));

const absorbedPranaTokens = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * 30 + 16) * (Math.PI / 180);
  const radius = 78 + (index % 5) * 16;
  const spiralStops = Array.from({ length: 26 }, (_, stopIndex) => stopIndex / 25);
  const xPath = spiralStops.map((stop, stopIndex) => {
    const pull = Math.pow(stop, 1.18);
    const nextRadius = radius * (1 - pull);
    return Math.cos(angle + Math.PI * 3.65 * stop + stopIndex * 0.01) * nextRadius;
  });
  const yPath = spiralStops.map((stop, stopIndex) => {
    const pull = Math.pow(stop, 1.18);
    const nextRadius = radius * (1 - pull);
    return Math.sin(angle + Math.PI * 3.65 * stop + stopIndex * 0.01) * nextRadius;
  });
  const opacityPath = spiralStops.map((stop) => {
    if (stop < 0.1) return stop * 9.5;
    if (stop > 0.82) return Math.max(0, (1 - stop) / 0.18);
    return 0.95;
  });
  const scalePath = spiralStops.map((stop) => {
    if (stop < 0.1) return 0.2 + stop * 8;
    return Math.max(0, 1 - Math.pow(stop, 1.65) * 0.92);
  });
  const spin = 840 + (index % 4) * 90;

  return {
    id: `absorbed-prana-${index}`,
    xPath,
    yPath,
    opacityPath,
    scalePath,
    times: spiralStops,
    delay: index * 0.42,
    duration: 6.2 + (index % 4) * 0.36,
    repeatDelay: 0.65 + (index % 3) * 0.28,
    spin,
    size: index % 3 === 0 ? 'h-8 w-8' : 'h-7 w-7',
  };
});

const copyByLocale = {
  en: {
    sectionAria: 'Double PRANA absorption flow visualization',
    badge: 'Double PRANA absorption',
    title: 'One WBTC payment creates two supply-side effects.',
    intro:
      'The bond path slows new PRANA distribution through vesting. The protocol path converts the same paid WBTC into market buy pressure, then removes the repurchased PRANA from circulation.',
    steps: [
      {
        title: '1. Bond purchase',
        body:
          'Users pay WBTC into BuyPranaBondV2 and receive a claim on PRANA instead of immediate market supply.',
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
      userLabel: 'User',
      wbtcTitle: 'WBTC enters',
      contractLabel: 'Contract',
      contractTitle: 'BuyPranaBondV2',
      bondRoute: 'bond route',
      vestingRoute: 'vested PRANA',
      vestingLabel: 'Chosen vesting period',
      vestingTitle: 'Slow unlock',
      protocolLabel: 'Protocol',
      protocolTitle: 'WBTC market buys PRANA',
    },
    blackHole: {
      outOfCirculation: 'Out of circulation',
      sinkTitle: 'Permanent PRANA sink',
      accretion: 'Buyback accretion disk',
      eventHorizon: 'Event horizon',
      caption:
        'Repurchased PRANA spirals inward and never returns to the market float.',
    },
    alt: {
      bitcoin: 'Bitcoin token icon',
      prana: 'PRANA token icon',
    },
  },
  vi: {
    sectionAria: 'Minh họa dòng hấp thụ kép PRANA',
    badge: 'Hấp thụ kép PRANA',
    title: 'Một khoản WBTC tạo ra hai tác động lên nguồn cung.',
    intro:
      'Nhánh bond làm PRANA được phân phối chậm qua vesting. Nhánh giao thức dùng chính WBTC đã trả để tạo lực mua trên thị trường, rồi đưa PRANA mua lại ra khỏi lưu thông.',
    steps: [
      {
        title: '1. Mua bond',
        body:
          'Người dùng trả WBTC vào BuyPranaBondV2 và nhận quyền nhận PRANA, thay vì đưa PRANA ra thị trường ngay lập tức.',
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
      userLabel: 'Người dùng',
      wbtcTitle: 'WBTC đi vào',
      contractLabel: 'Hợp đồng',
      contractTitle: 'BuyPranaBondV2',
      bondRoute: 'nhánh bond',
      vestingRoute: 'PRANA vesting',
      vestingLabel: 'Kỳ vesting đã chọn',
      vestingTitle: 'Mở khóa chậm',
      protocolLabel: 'Giao thức',
      protocolTitle: 'WBTC market buy PRANA',
    },
    blackHole: {
      outOfCirculation: 'Rời khỏi lưu thông',
      sinkTitle: 'Hố hấp thụ PRANA vĩnh viễn',
      accretion: 'Đĩa bồi tụ từ buyback',
      eventHorizon: 'Chân trời sự kiện',
      caption:
        'PRANA mua lại xoáy vào tâm hấp thụ và không quay lại nguồn cung thị trường.',
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

const ParticleStream: React.FC<{
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
          top: `${particle.top}%`,
          width: particle.size,
          height: particle.size,
        }}
        initial={{ x: '-12%', opacity: 0, scale: 0.7 }}
        animate={{ x: '112%', opacity: [0, 0.95, 0.8, 0], scale: [0.7, 1.15, 0.9] }}
        transition={{
          duration: particle.duration,
          delay: particle.delay,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {token && index % 7 === 0 ? (
          <TokenIcon token={token} decorative className="h-3.5 w-3.5 min-w-3.5" />
        ) : null}
      </motion.span>
    ))}
  </div>
);

const FlowNode: React.FC<{
  title: string;
  label: string;
  visual: React.ReactNode;
  className?: string;
}> = ({ title, label, visual, className = '' }) => (
  <motion.div
    className={`relative min-h-[9rem] rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md ${className}`}
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.45 }}
    transition={{ duration: 0.5 }}
  >
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10">
        {visual}
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-[0.22em] text-white/45">{label}</div>
        <div className="mt-1 text-base font-semibold text-white">{title}</div>
      </div>
    </div>
  </motion.div>
);

const GravityWell: React.FC<{
  alt: typeof copyByLocale.en.alt;
}> = ({ alt }) => (
  <div className="relative mx-auto aspect-square w-[min(82vw,22rem)] sm:w-full" aria-hidden="true">
    <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(103,232,249,0.18)_0%,rgba(168,85,247,0.12)_34%,transparent_68%)] blur-xl" />

    <motion.div
      className="absolute inset-[4%] rounded-full border border-cyan-200/10"
      animate={{ rotate: 360 }}
      transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
    >
      <div className="absolute left-1/2 top-0 h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
      <div className="absolute bottom-3 right-8 h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.85)]" />
    </motion.div>

    <motion.div
      className="absolute inset-[8%] rounded-full bg-[conic-gradient(from_120deg,transparent_0deg,rgba(251,191,36,0.72)_42deg,rgba(217,70,239,0.44)_82deg,transparent_130deg,rgba(34,211,238,0.46)_205deg,rgba(251,191,36,0.64)_255deg,transparent_318deg)] blur-[0.5px] shadow-[0_0_54px_rgba(217,70,239,0.28)]"
      animate={{ rotate: 360, scale: [1, 1.015, 1] }}
      transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
    />
    <motion.div
      className="absolute inset-[15%] rounded-full border border-amber-100/25 bg-[radial-gradient(ellipse_at_center,transparent_32%,rgba(251,191,36,0.2)_47%,transparent_61%)]"
      animate={{ rotate: -360 }}
      transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
    />
    <motion.div
      className="absolute left-[9%] right-[9%] top-[39%] h-[22%] rounded-[999px] bg-[linear-gradient(90deg,transparent,rgba(251,191,36,0.92),rgba(34,211,238,0.58),rgba(217,70,239,0.78),transparent)] blur-sm"
      animate={{ opacity: [0.58, 0.95, 0.58], scaleX: [0.94, 1.03, 0.94] }}
      transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
    />

    <motion.div
      className="absolute inset-[23%] rounded-full border border-cyan-200/25 bg-[conic-gradient(from_180deg,transparent,rgba(34,211,238,0.28),transparent,rgba(217,70,239,0.32),transparent)]"
      animate={{ rotate: -360, scale: [1, 1.04, 1] }}
      transition={{ duration: 7.4, repeat: Infinity, ease: 'easeInOut' }}
    />
    <div className="absolute inset-[33%] rounded-full border border-white/10 bg-[radial-gradient(circle_at_center,rgba(0,0,0,1)_0%,rgba(0,0,0,0.98)_54%,rgba(24,9,42,0.92)_70%,rgba(168,85,247,0.32)_100%)] shadow-[0_0_38px_rgba(0,0,0,1),0_0_88px_rgba(168,85,247,0.76),inset_0_0_36px_rgba(0,0,0,1)]" />
    <div className="absolute inset-[42%] rounded-full bg-black shadow-[0_0_24px_rgba(0,0,0,1)]" />

    {absorbedPranaTokens.map((token) => (
      <motion.div
        key={token.id}
        className={`absolute left-1/2 top-1/2 grid ${token.size} place-items-center rounded-full border border-cyan-100/20 bg-black/55 p-1 shadow-[0_0_20px_rgba(34,211,238,0.45)] backdrop-blur-sm`}
        initial={{
          x: token.xPath[0],
          y: token.yPath[0],
          opacity: 0,
          rotate: 0,
          scale: 0.2,
        }}
        animate={{
          x: token.xPath,
          y: token.yPath,
          opacity: token.opacityPath,
          rotate: token.times.map((stop) => token.spin * stop),
          scale: token.scalePath,
        }}
        transition={{
          duration: token.duration,
          delay: token.delay,
          repeat: Infinity,
          repeatDelay: token.repeatDelay,
          ease: 'linear',
          times: token.times,
        }}
      >
        <TokenIcon token="prana" alt={alt.prana} className="h-full w-full" />
      </motion.div>
    ))}

    {sinkParticles.map((particle) => (
      <motion.span
        key={particle.id}
        className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(103,232,249,0.95)]"
        initial={{
          x: Math.cos((particle.angle * Math.PI) / 180) * particle.radius,
          y: Math.sin((particle.angle * Math.PI) / 180) * particle.radius,
          opacity: 0,
          scale: 1,
        }}
        animate={{
          x: 0,
          y: 0,
          opacity: [0, 0.95, 0],
          scale: [1, 0.58, 0],
        }}
        transition={{
          duration: particle.duration,
          delay: particle.delay,
          repeat: Infinity,
          ease: 'easeIn',
        }}
      />
    ))}

  </div>
);

const DoublePranaAbsorptionFlow: React.FC = () => {
  const { locale } = useSiteLanguage();
  const copy = copyByLocale[locale];

  return (
    <section
      className="relative z-20 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
      aria-label={copy.sectionAria}
    >
      <motion.div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#070414]/80 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl"
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
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/68 sm:text-base">
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

          <div className="relative min-h-[39rem] overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4 sm:min-h-[34rem] lg:min-h-[31rem]">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:48px_48px] opacity-40" />

            <div className="relative grid h-full gap-5 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
              <div className="relative flex min-h-[21rem] flex-col justify-between gap-4 lg:min-h-[26rem]">
                <ParticleStream
                  particles={wbtcParticles}
                  className="left-[18%] right-[14%] top-[4.6rem] h-16"
                  particleClassName="bg-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.9)]"
                  token="bitcoin"
                />
                <ParticleStream
                  particles={pranaParticles}
                  className="left-[18%] right-[-8%] bottom-[4.7rem] h-20"
                  particleClassName="bg-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.95)]"
                  token="prana"
                />

                <FlowNode
                  title={copy.flow.wbtcTitle}
                  label={copy.flow.userLabel}
                  visual={<TokenIcon token="bitcoin" alt={copy.alt.bitcoin} className="h-7 w-7" />}
                  className="max-w-[13rem]"
                />

                <div className="absolute left-[42%] top-[5.4rem] hidden items-center gap-2 text-white/45 sm:flex">
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs uppercase tracking-[0.16em]">{copy.flow.bondRoute}</span>
                </div>

                <FlowNode
                  title={copy.flow.contractTitle}
                  label={copy.flow.contractLabel}
                  visual={<Sparkles className="h-5 w-5 text-amber-200" aria-hidden="true" />}
                  className="ml-auto max-w-[14rem] border-amber-200/20 bg-amber-300/[0.06]"
                />

                <div className="absolute left-[36%] bottom-[5.2rem] hidden items-center gap-2 text-white/45 sm:flex">
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs uppercase tracking-[0.16em]">{copy.flow.vestingRoute}</span>
                </div>

                <FlowNode
                  title={copy.flow.vestingTitle}
                  label={copy.flow.vestingLabel}
                  visual={<TokenIcon token="prana" alt={copy.alt.prana} className="h-7 w-7" />}
                  className="max-w-[13rem] border-cyan-200/20 bg-cyan-300/[0.06]"
                />
              </div>

              <div className="relative flex min-h-[25rem] flex-col items-center justify-center lg:min-h-[29rem]">
                <div className="mb-2 flex w-full items-center justify-between gap-3 rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/[0.06] px-4 py-3 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-fuchsia-200/70">{copy.flow.protocolLabel}</div>
                    <div className="mt-1 font-semibold text-white">{copy.flow.protocolTitle}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <TokenIcon token="bitcoin" alt={copy.alt.bitcoin} className="h-5 w-5" />
                    <ArrowRight className="h-4 w-4 text-white/45" aria-hidden="true" />
                    <TokenIcon token="prana" alt={copy.alt.prana} className="h-5 w-5" />
                  </div>
                </div>

                <GravityWell alt={copy.alt} />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default DoublePranaAbsorptionFlow;
