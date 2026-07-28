import { useMemo } from "react";
import { useSiteLanguage } from "./useSiteLanguage";
import guideBondingEn from "../data/guide-bonding-en.md?raw";
import guideBondingVi from "../data/guide-bonding-vi.md?raw";
import { parseSectionedMarkdown } from "../utils/parseSectionedMarkdown";

export function useBondingGuideDocument() {
  const { locale } = useSiteLanguage();
  return useMemo(
    () =>
      parseSectionedMarkdown(
        locale === "en" ? guideBondingEn : guideBondingVi,
      ),
    [locale],
  );
}
