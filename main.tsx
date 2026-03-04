import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import PranaHero from "./hero3.tsx";
import PranaStats from "./components/PranaStats";
import PranaConverter from "./components/PranaConverter";
import TopHoldingAddresses from "./components/TopHoldingAddresses";
import Supply from "./components/Supply.tsx";
import Capital from "./components/Capital";
import SatsPriceChart from "./components/SatsPriceChart";
import PranaVndPriceChart from "./components/PranaVndPriceChart";
import FaqSection from "./components/FaqSection";
import { TopHoldingAddressesProvider } from "./hooks/useTopHoldingAddresses";
import NeuralShaderBackground from "./shader.tsx";
import { useSpinningFavicon } from "./hooks/useSpinningFavicon.ts";

function App() {
  useSpinningFavicon();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050116] text-white">
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
        <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <SatsPriceChart />
            <PranaVndPriceChart />
          </div>
        </section>
        <FaqSection />
      </main>
    </div>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Root element with id "root" was not found.');
}

ReactDOM.createRoot(rootElement).render(
  <App />,
);
