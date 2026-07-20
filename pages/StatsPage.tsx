import React from "react";
import Supply from "../components/Supply";
import Capital from "../components/Capital";
import PranaHero from "../hero3.tsx";
import Liquidity from "../components/Liquidity";
import Timeline from "../components/Timeline";
import AppFooter from "../components/AppFooter";
import FaqSection from "../components/FaqSection";
import BasicStats from "../components/BasicStats";
import BondingStats from "../components/BondingStats";
import StakingStats from "../components/StakingStats";
import PranaConverter from "../components/PranaConverter";
import { preloadHeroAssets } from "../utils/preloadHeroAssets";
import PriceChartsSection from "../components/PriceChartsSection";
import TopHoldingAddresses from "../components/TopHoldingAddresses";
import { prefetchInitialJson } from "../utils/prefetchInitialJson.ts";
import DoublePranaAbsorptionFlow from "../components/DoublePranaAbsorptionFlow";
import PranaPerformanceSection from "../components/PranaPerformanceSection";
import { TopHoldingAddressesProvider } from "../hooks/useTopHoldingAddresses";

// Warm stats + hero assets only when this lazy chunk loads (not on `/stake/`).
prefetchInitialJson();
preloadHeroAssets();

/** Homepage content — shell (shader, language toggle) stays in main.tsx. */
export default function StatsPage() {
  return (
    <>
      <main className="relative z-10 flex flex-col gap-6 pb-24">
        <PranaHero />
        <TopHoldingAddressesProvider>
          <section className="relative z-20 mx-auto mt-12 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              <BasicStats />
              <BondingStats />
              <StakingStats />
            </div>
          </section>
          <Liquidity />
          <section className="relative z-20 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              <PranaPerformanceSection />
            </div>
          </section>
          <PranaConverter />
          <DoublePranaAbsorptionFlow />
          <Capital />
          <TopHoldingAddresses />
          <Supply />
        </TopHoldingAddressesProvider>
        <PriceChartsSection />
        <Timeline />
        <FaqSection />
      </main>
      <AppFooter />
    </>
  );
}
