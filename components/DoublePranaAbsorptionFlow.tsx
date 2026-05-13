import React from 'react';
import InfoTooltip from './InfoTooltip';
import { motion } from 'framer-motion';
import { useBondStats } from '../hooks/useBondStats';
import { formatCurrency } from '../utils/formatters';
import { useBuyDips } from '../hooks/useBuyDips';
import { useSiteLanguage } from '../hooks/useSiteLanguage';
import { ArrowRight, ScrollText, Sparkles } from 'lucide-react';
import { copyByLocale } from './doublePranaAbsorptionFlow.copy';
import { ContainedParticleField, FlowConnector, FlowNode, GravityWell, StepVisual, TokenIcon, VerticalParticleStream, pranaParticles, wbtcParticles } from './DoublePranaAbsorptionFlow.parts';

const DoublePranaAbsorptionFlow: React.FC = () => {
  const { locale } = useSiteLanguage();
  const copy = copyByLocale[locale];
  const { isLoading: isBondStatsLoading, sellBondPrana } = useBondStats();
  const buyDipsData = useBuyDips();

  const totalWithdrawnPrana =
    sellBondPrana === null ? null : sellBondPrana + (buyDipsData.total_prana_bought ?? 0);

  const blackHoleValue = isBondStatsLoading || buyDipsData.isLoading
    ? 'Loading...'
    : `${formatCurrency(totalWithdrawnPrana, 'PRANA')} PRANA`;

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
                    className="w-full lg:max-w-[14rem] border-cyan-200/20 !bg-black/55"
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
                  <div className="relative inline-flex items-center justify-center gap-1.5 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-emerald-100/70">
                    <span>{copy.blackHole.sellBondPranaLabel}</span>
                    <InfoTooltip
                      ariaLabel="PRANA withdrawn from market explanation"
                      text="Buy the Dips + Sell Bonds Volume"
                      positionClassName="bottom-full right-0 mb-2"
                      widthClassName="w-[min(18rem,calc(100vw-2rem))]"
                    />
                  </div>
                  <div className="mt-1 text-sm font-semibold text-emerald-50">
                    {blackHoleValue}
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
