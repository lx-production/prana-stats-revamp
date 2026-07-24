import { useMemo } from "react";
import { useSiteLanguage } from "./useSiteLanguage";
import guideSwapEn from "../data/guide-swap-en.md?raw";
import guideSwapVi from "../data/guide-swap-vi.md?raw";
import { parseTermsRiskMarkdown } from "../utils/termsRiskParser";

export function useSwapGuideDocument() {
  const { locale } = useSiteLanguage();
  return useMemo(
    () => parseTermsRiskMarkdown(locale === "en" ? guideSwapEn : guideSwapVi),
    [locale],
  );
}
