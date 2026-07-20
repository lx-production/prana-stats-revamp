import { useMemo } from "react";
import { useSiteLanguage } from "./useSiteLanguage";
import privacyEn from "../data/privacy-en.md?raw";
import privacyVi from "../data/privacy-vi.md?raw";
import { parseTermsRiskMarkdown } from "../utils/termsRiskParser";

export function usePrivacyDocument() {
  const { locale } = useSiteLanguage();
  return useMemo(
    () => parseTermsRiskMarkdown(locale === "en" ? privacyEn : privacyVi),
    [locale],
  );
}
