import React from "react";
import "./index.css";
import ReactDOM from "react-dom/client";
import PranaHero from "./hero3.tsx";
import Supply from "./components/Supply";
import Capital from "./components/Capital";
import Timeline from "./components/Timeline";
import FaqSection from "./components/FaqSection";
import BasicStats from "./components/BasicStats";
import BondingStats from "./components/BondingStats";
import NeuralShaderBackground from "./shader.tsx";
import StakingStats from "./components/StakingStats";
import LanguageToggle from "./components/LanguageToggle";
import PranaConverter from "./components/PranaConverter";
import PranaPerformanceSection from "./components/PranaPerformanceSection";
import TopHoldingAddresses from "./components/TopHoldingAddresses";
import PriceChartsSection from "./components/PriceChartsSection";
import { useBasicStats } from "./hooks/useBasicStats";
import { SiteLanguageProvider } from "./hooks/useSiteLanguage";
import { useSpinningFavicon } from "./hooks/useSpinningFavicon.ts";
import { prefetchInitialJson } from "./utils/prefetchInitialJson.ts";
import { TopHoldingAddressesProvider } from "./hooks/useTopHoldingAddresses";
import { usePranaPerformanceSectionData } from "./hooks/usePranaPerformanceSectionData";

prefetchInitialJson();

function App() {
  useSpinningFavicon();
  const { error, basicStatsProps } = useBasicStats();
  const { performanceSectionProps } = usePranaPerformanceSectionData();

  return (
    <SiteLanguageProvider>
    <div className="relative min-h-screen overflow-hidden bg-[#050116] text-white">
      <LanguageToggle />
      <NeuralShaderBackground
        className="select-none"
        opacity={1}
        brightness={0.42}
        gamma={1.0}
        speed={0.08}
        flow={4.5}
        spin={0.04}
        iterations={64}
        maxDpr={1.15}
        targetFps={60}
        renderScale={0.9}
      />

      <main className="relative z-10 flex flex-col gap-6 pb-24">
        <PranaHero />
        <section className="relative z-20 mx-auto mt-12 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          {error ? (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            <BasicStats {...basicStatsProps} />
            <BondingStats />
            <StakingStats />
            <PranaPerformanceSection {...performanceSectionProps} />
          </div>
        </section>
        <PranaConverter />
        <Capital />
        <TopHoldingAddressesProvider>
          <TopHoldingAddresses />
          <Supply />
        </TopHoldingAddressesProvider>
        <PriceChartsSection />
        <Timeline />
        <FaqSection />
      </main>
    </div>
    </SiteLanguageProvider>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Root element with id "root" was not found.');
}

ReactDOM.createRoot(rootElement).render(
  <App />,
);
