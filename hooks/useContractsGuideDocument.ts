import { useMemo } from "react";
import { useSiteLanguage } from "./useSiteLanguage";
import guideContractsEn from "../data/guide-contracts-en.md?raw";
import guideContractsVi from "../data/guide-contracts-vi.md?raw";
import { parseSectionedMarkdown } from "../utils/parseSectionedMarkdown";

export function useContractsGuideDocument() {
  const { locale } = useSiteLanguage();
  return useMemo(
    () =>
      parseSectionedMarkdown(
        locale === "en" ? guideContractsEn : guideContractsVi,
      ),
    [locale],
  );
}
