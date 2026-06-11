import React from 'react';
import { motion } from 'framer-motion';
import { useBondStats } from '../hooks/useBondStats';
import { formatCurrency } from '../utils/formatters';
import { useBuyDips } from '../hooks/useBuyDips';
import { useSiteLanguage } from '../hooks/useSiteLanguage';
import { ScrollText, Sparkles } from 'lucide-react';
import { copyByLocale } from './doublePranaAbsorptionFlow.copy';
import { AbsorptionLane, LaneMetric, StepVisual, TokenIcon } from './DoublePranaAbsorptionFlow.parts';

const DoublePranaAbsorptionFlow: React.FC = () => {
  const { locale } = useSiteLanguage();
  const copy = copyByLocale[locale];
  const { isLoading: isBondStatsLoading, sellBondPrana } = useBondStats();
  const buyDipsData = useBuyDips();

  const totalWithdrawnPrana =
    sellBondPrana === null ? null : sellBondPrana + (buyDipsData.total_prana_bought ?? 0);

  const formatPrana = (value: number | null) => `${formatCurrency(value, 'PRANA')} PRANA`;

  const buybackValue = buyDipsData.isLoading
    ? 'Loading...'
    : formatPrana(buyDipsData.total_prana_bought ?? null);
  const sellBondValue = isBondStatsLoading ? 'Loading...' : formatPrana(sellBondPrana);
  const combinedValue = isBondStatsLoading || buyDipsData.isLoading
    ? 'Loading...'
    : formatPrana(totalWithdrawnPrana);

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

          <div className="relative min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:48px_48px] opacity-40" />

            <div className="relative flex min-w-0 flex-col gap-5">
              <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-stretch">
                <AbsorptionLane
                  side={copy.buySide}
                  alt={copy.alt}
                  headerAccent="text-amber-100"
                  bridgeAccent="border-fuchsia-300/20 bg-fuchsia-300/[0.06] text-fuchsia-100"
                  entryVisual={<TokenIcon token="bitcoin" alt={copy.alt.bitcoin} className="h-5 w-5" />}
                  contractVisual={<ScrollText className="h-5 w-5 text-amber-200" aria-hidden="true" />}
                  vestingVisual={<TokenIcon token="prana" alt={copy.alt.prana} className="h-5 w-5" />}
                  metricValue={buybackValue}
                />

                <AbsorptionLane
                  side={copy.sellSide}
                  alt={copy.alt}
                  headerAccent="text-cyan-100"
                  bridgeAccent="border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100"
                  entryVisual={<TokenIcon token="prana" alt={copy.alt.prana} className="h-5 w-5" />}
                  contractVisual={<ScrollText className="h-5 w-5 text-emerald-200" aria-hidden="true" />}
                  vestingVisual={<TokenIcon token="bitcoin" alt={copy.alt.bitcoin} className="h-5 w-5" />}
                  metricValue={sellBondValue}
                  gravityWellVariant="sell"
                />
              </div>

              <LaneMetric
                label={copy.combinedMetric.label}
                tooltip={copy.combinedMetric.tooltip}
                ariaLabel={copy.combinedMetric.label}
                value={combinedValue}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default DoublePranaAbsorptionFlow;
