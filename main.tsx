import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import PranaHero from "./hero3.tsx";
import PranaStats from "./components/PranaStats";
import PranaConverter from "./components/PranaConverter";
import TopHoldingAddresses from "./components/TopHoldingAddresses";
import Supply from "./components/Supply.tsx";
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
      />

      <main className="relative z-10 flex flex-col gap-6 pb-24">
        <PranaHero />
        <PranaStats />
        <PranaConverter />
        <TopHoldingAddressesProvider>
          <TopHoldingAddresses />
          <Supply />
        </TopHoldingAddressesProvider>
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
