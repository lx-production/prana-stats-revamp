import React, { Suspense, lazy } from "react";
import "./index.css";
import ReactDOM from "react-dom/client";
import AppFooter from "./components/AppFooter";
import PrivacyPage from "./components/PrivacyPage";
import SwapGuidePage from "./components/SwapGuidePage";
import TermsRiskPage from "./components/TermsRiskPage";
import LanguageToggle from "./components/LanguageToggle";
import StakingGuidePage from "./components/StakingGuidePage";
import { useAppPathname } from "./hooks/useAppPathname";
import FlutterShaderBackground from "./flutterShader.tsx";
import { useSpinningFavicon } from "./hooks/useSpinningFavicon.ts";
import { SiteLanguageProvider } from "./hooks/useSiteLanguage";
import {
  isStakePath,
  isPrivacyPath,
  isGuideSwapPath,
  isTermsRiskPath,
  isGuideStakingPath,
} from "./constants/appRoutes";

const StatsPage = lazy(() => import("./pages/StatsPage"));
const StakingEntry = lazy(() => import("./features/staking/StakingEntry"));

const pageFallback = (
  <div
    className="min-h-screen bg-[#050116]"
    aria-busy="true"
    aria-label="Loading"
  />
);

function App() {
  useSpinningFavicon();
  const pathname = useAppPathname();

  // Staking is its own lazy page (no shared homepage shell / stats prefetch).
  const body = isStakePath(pathname) ? (
    <Suspense fallback={pageFallback}>
      <StakingEntry />
    </Suspense>
  ) : (
    <div className="relative min-h-screen overflow-hidden bg-[#050116] text-white">
      <LanguageToggle />
      <FlutterShaderBackground />

      {isTermsRiskPath(pathname) ? (
        <>
          <TermsRiskPage />
          <AppFooter />
        </>
      ) : isPrivacyPath(pathname) ? (
        <>
          <PrivacyPage />
          <AppFooter />
        </>
      ) : isGuideSwapPath(pathname) ? (
        <>
          <SwapGuidePage />
          <AppFooter />
        </>
      ) : isGuideStakingPath(pathname) ? (
        <>
          <StakingGuidePage />
          <AppFooter />
        </>
      ) : (
        <Suspense fallback={pageFallback}>
          <StatsPage />
        </Suspense>
      )}
    </div>
  );

  return <SiteLanguageProvider>{body}</SiteLanguageProvider>;
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Root element with id "root" was not found.');
}

// Web3 providers live under lazy SwapEntry / StakingEntry — not the root shell.
ReactDOM.createRoot(rootElement).render(<App />);
