import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import PranaHero from "./hero3.tsx";
import PranaStats from "./components/PranaStats";
import PranaConverter from "./components/PranaConverter";
import TopHoldingAddresses from "./components/TopHoldingAddresses";
import Supply from "./components/Supply.tsx";
import Capital from "./components/Capital";
import PriceChartsSection from "./components/PriceChartsSection";
import FaqSection from "./components/FaqSection";
import Timeline from "./components/Timeline";
import { TopHoldingAddressesProvider } from "./hooks/useTopHoldingAddresses";
import { SiteLanguageProvider } from "./hooks/useSiteLanguage";
import LanguageToggle from "./components/LanguageToggle";
import NeuralShaderBackground from "./shader.tsx";
import { useSpinningFavicon } from "./hooks/useSpinningFavicon.ts";
import { prefetchInitialJson } from "./utils/prefetchInitialJson.ts";

prefetchInitialJson();

function App() {
  useSpinningFavicon();

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
        <PranaStats />
        <PranaConverter />
        <TopHoldingAddressesProvider>
          <Capital />
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
