import React from "react";
import LanguageToggle from "../components/LanguageToggle";
import { useSiteLanguage } from "../hooks/useSiteLanguage";

/**
 * Placeholder for Bước 1 — routing shell only.
 * Full staking UI lands in later steps.
 */
export default function StakingPage() {
  const { locale } = useSiteLanguage();
  const isEn = locale === "en";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050116] text-white">
      <LanguageToggle />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-24">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-white/45">
            PRANA Protocol
          </p>
          <h1 className="text-3xl font-medium tracking-wide sm:text-4xl">
            {isEn ? "Staking" : "Staking"}
          </h1>
          <p className="max-w-xl text-[15px] text-white/70">
            {isEn
              ? "Staking UI will move here from the standalone app. Routing and the homepage split are in place."
              : "Giao diện staking sẽ chuyển vào đây từ app riêng. Routing và tách homepage đã sẵn sàng."}
          </p>
        </div>

        <nav
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
          aria-label="Staking page links"
        >
          <a href="/" className="btn-hero btn-glass">
            {isEn ? "Back to home" : "Về trang chủ"}
          </a>
          <a href="/" className="btn-hero btn-glass">
            {isEn ? "View protocol statistics" : "Xem thống kê protocol"}
          </a>
        </nav>
      </main>
    </div>
  );
}
