import { useMemo } from "react";
import covenantsEn from "../covenants-en.md?raw";
import covenantsVi from "../covenants-vi.md?raw";
import { parseFaqMarkdown } from "../utils/faqParser";
import { useSiteLanguage } from "./useSiteLanguage";

export const useCovenantsItems = () => {
  const { locale } = useSiteLanguage();
  return useMemo(
    () =>
      parseFaqMarkdown(locale === "en" ? covenantsEn : covenantsVi),
    [locale],
  );
};
