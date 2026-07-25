import { useMemo } from "react";
import { useSiteLanguage } from "./useSiteLanguage";
import guideContractsEn from "../data/guide-contracts-en.md?raw";
import guideContractsVi from "../data/guide-contracts-vi.md?raw";
import { parseTermsRiskMarkdown } from "../utils/termsRiskParser";

export function useContractsGuideDocument() {
  const { locale } = useSiteLanguage();
  return useMemo(
    () =>
      parseTermsRiskMarkdown(
        locale === "en" ? guideContractsEn : guideContractsVi,
      ),
    [locale],
  );
}
