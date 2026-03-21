import { useMemo } from "react";
import faqEn from "../data/faq-en.md?raw";
import faqVi from "../data/faq-vi.md?raw";
import { parseFaqMarkdown } from "../utils/faqParser";
import { useSiteLanguage } from "./useSiteLanguage";

export const useFaqItems = () => {
  const { locale } = useSiteLanguage();
  return useMemo(
    () => parseFaqMarkdown(locale === "en" ? faqEn : faqVi),
    [locale],
  );
};
