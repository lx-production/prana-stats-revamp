import { useMemo } from "react";
import { useSiteLanguage } from "./useSiteLanguage";

export function useHeroHeadlines() {
  const { locale } = useSiteLanguage();
  return useMemo(
    () =>
      locale === "en"
        ? {
            title: "Priced by Bitcoin",
            subtitle: "Powered by Wisdom",
            tagline:
              "PRANA is the bridge between the precision of Code and the understanding of Heart",
          }
        : {
            title: "Định Giá Bằng Bitcoin",
            subtitle: "Vận Hành Bằng Trí Tuệ",
            tagline:
              "PRANA là cầu nối giữa sự chính xác của Code và sự thấu hiểu của Tâm",
          },
    [locale],
  );
}
