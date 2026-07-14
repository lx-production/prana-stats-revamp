import type { HeroHeadlines, HeroHeadlinesByLocale } from "../types/heroHeadlines.types";

export const heroHeadlinesByLocale: HeroHeadlinesByLocale = {
  en: {
    title: "Swap from the Official UI",
    subtitle: "7 tokens on Polygon",
    tagline:
      "The on-chain PRANA trading gateway supported by Triết Học Đường Phố",
  },
  vi: {
    title: "Swap từ UI chính thức",
    subtitle: "7 token trên Polygon",
    tagline:
      "Cổng giao dịch PRANA on-chain được hỗ trợ bởi Triết Học Đường Phố",
  },
};

export function formatHeroMessage(headlines: HeroHeadlines): string {
  return `${headlines.title}. ${headlines.subtitle}. ${headlines.tagline}.`;
}
