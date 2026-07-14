import React from "react";
import "./index.css";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import PranaHero from "./hero3.tsx";
import Supply from "./components/Supply";
import Capital from "./components/Capital";
import Liquidity from "./components/Liquidity";
import Timeline from "./components/Timeline";
import FaqSection from "./components/FaqSection";
import BasicStats from "./components/BasicStats";
import BondingStats from "./components/BondingStats";
import FlutterShaderBackground from "./flutterShader.tsx";
import StakingStats from "./components/StakingStats";
import AppFooter from "./components/AppFooter";
import LanguageToggle from "./components/LanguageToggle";
import PranaConverter from "./components/PranaConverter";
import PriceChartsSection from "./components/PriceChartsSection";
import TopHoldingAddresses from "./components/TopHoldingAddresses";
import DoublePranaAbsorptionFlow from "./components/DoublePranaAbsorptionFlow";
import PranaPerformanceSection from "./components/PranaPerformanceSection";
import { SiteLanguageProvider } from "./hooks/useSiteLanguage";
import { useSpinningFavicon } from "./hooks/useSpinningFavicon.ts";
import { prefetchInitialJson } from "./utils/prefetchInitialJson.ts";
import { wagmiConfig } from "./utils/wagmiConfig";
import { TopHoldingAddressesProvider } from "./hooks/useTopHoldingAddresses";

prefetchInitialJson();

const queryClient = new QueryClient();

function App() {
  useSpinningFavicon();

  return (
    <SiteLanguageProvider>
    <div className="relative min-h-screen overflow-hidden bg-[#050116] text-white">
      <LanguageToggle />
      <FlutterShaderBackground
        className="select-none"
        opacity={1}
        brightness={0.5}
        gamma={1.05}
        speed={0.1}
        darkTint={0.5}
        darkTintColor={[0.02, 0.0, 0.08]}
        iterations={50}
        maxDpr={1.15}
        targetFps={30}
        renderScale={0.9}
      />

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
    </div>
    </SiteLanguageProvider>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Root element with id "root" was not found.');
}

ReactDOM.createRoot(rootElement).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>,
);
