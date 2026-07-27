import { useMemo } from "react";
import { useSiteLanguage } from "./useSiteLanguage";
import termsRiskEn from "../data/terms-risk-en.md?raw";
import termsRiskVi from "../data/terms-risk-vi.md?raw";
import { parseSectionedMarkdown } from "../utils/parseSectionedMarkdown";

export function useTermsRiskDocument() {
  const { locale } = useSiteLanguage();
  return useMemo(
    () => parseSectionedMarkdown(locale === "en" ? termsRiskEn : termsRiskVi),
    [locale],
  );
}
