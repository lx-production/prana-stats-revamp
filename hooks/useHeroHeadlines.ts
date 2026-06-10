import { useMemo } from "react";
import { heroHeadlinesByLocale } from "../data/heroHeadlines";
import { useSiteLanguage } from "./useSiteLanguage";

export function useHeroHeadlines() {
  const { locale } = useSiteLanguage();
  return useMemo(() => heroHeadlinesByLocale[locale], [locale]);
}
