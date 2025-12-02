import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import PranaHero from "./hero3.jsx";
import PranaStats from "./components/PranaStats";
import NeuralShaderBackground from "./shader.jsx";

function App() {
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

      <main className="relative z-10 flex flex-col gap-12 pb-24">
        <PranaHero />
        <PranaStats />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
