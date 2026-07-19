import { useMemo } from "react";
import { useSiteLanguage } from "./useSiteLanguage";
import termsRiskEn from "../data/terms-risk-en.md?raw";
import termsRiskVi from "../data/terms-risk-vi.md?raw";
import { parseTermsRiskMarkdown } from "../utils/termsRiskParser";

export function useTermsRiskDocument() {
  const { locale } = useSiteLanguage();
  return useMemo(
    () => parseTermsRiskMarkdown(locale === "en" ? termsRiskEn : termsRiskVi),
    [locale],
  );
}
