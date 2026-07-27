import { useMemo } from "react";
import { useSiteLanguage } from "./useSiteLanguage";
import guideSwapEn from "../data/guide-swap-en.md?raw";
import guideSwapVi from "../data/guide-swap-vi.md?raw";
import { parseSectionedMarkdown } from "../utils/parseSectionedMarkdown";

export function useSwapGuideDocument() {
  const { locale } = useSiteLanguage();
  return useMemo(
    () => parseSectionedMarkdown(locale === "en" ? guideSwapEn : guideSwapVi),
    [locale],
  );
}
