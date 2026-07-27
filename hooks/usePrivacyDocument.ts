import { useMemo } from "react";
import { useSiteLanguage } from "./useSiteLanguage";
import privacyEn from "../data/privacy-en.md?raw";
import privacyVi from "../data/privacy-vi.md?raw";
import { parseSectionedMarkdown } from "../utils/parseSectionedMarkdown";

export function usePrivacyDocument() {
  const { locale } = useSiteLanguage();
  return useMemo(
    () => parseSectionedMarkdown(locale === "en" ? privacyEn : privacyVi),
    [locale],
  );
}
