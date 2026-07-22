import React, { Suspense, lazy } from "react";
import "./index.css";
import ReactDOM from "react-dom/client";
import AppFooter from "./components/AppFooter";
import PrivacyPage from "./components/PrivacyPage";
import TermsRiskPage from "./components/TermsRiskPage";
import LanguageToggle from "./components/LanguageToggle";
import { useAppPathname } from "./hooks/useAppPathname";
import FlutterShaderBackground from "./flutterShader.tsx";
import { useSpinningFavicon } from "./hooks/useSpinningFavicon.ts";
import { SiteLanguageProvider } from "./hooks/useSiteLanguage";
import { Web3Providers } from "./features/web3/Web3Providers";
import {
  isStakePath,
  isPrivacyPath,
  isTermsRiskPath,
} from "./constants/appRoutes";

const StatsPage = lazy(() => import("./pages/StatsPage"));
const StakingPage = lazy(() => import("./pages/StakingPage"));

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
      <StakingPage />
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

ReactDOM.createRoot(rootElement).render(
  <Web3Providers>
    <App />
  </Web3Providers>,
);
