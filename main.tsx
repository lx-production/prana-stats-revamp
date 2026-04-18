import React from "react";
import "./index.css";
import ReactDOM from "react-dom/client";
import PranaHero from "./hero3.tsx";
import Supply from "./components/Supply";
import Capital from "./components/Capital";
import PranaStats from "./components/PranaStats";
import FaqSection from "./components/FaqSection";
import Timeline from "./components/Timeline";
import NeuralShaderBackground from "./shader.tsx";
import LanguageToggle from "./components/LanguageToggle";
import PranaConverter from "./components/PranaConverter";
import TopHoldingAddresses from "./components/TopHoldingAddresses";
import PriceChartsSection from "./components/PriceChartsSection";
import { SiteLanguageProvider } from "./hooks/useSiteLanguage";
import { useSpinningFavicon } from "./hooks/useSpinningFavicon.ts";
import { prefetchInitialJson } from "./utils/prefetchInitialJson.ts";
import { TopHoldingAddressesProvider } from "./hooks/useTopHoldingAddresses";

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
