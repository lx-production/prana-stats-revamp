import type { HeroHeadlines, HeroHeadlinesByLocale } from "../types/heroHeadlines.types";

export const heroHeadlinesByLocale: HeroHeadlinesByLocale = {
  en: {
    title: "Thickest Liquidity Density",
    subtitle: "Highest Protocol Reserve Ratio",
    tagline:
      "Liquidity Density and reserves you can verify — Top 1 in the entire market",
  },
  vi: {
    title: "Thanh Khoản Dày Nhất",
    subtitle: "Tỉ Lệ Dự Trữ Cao Nhất",
    tagline:
      "Độ dày thanh khoản và quỹ dự trữ có thể kiểm chứng — Top 1 toàn thị trường",
  },
};

export function formatHeroMessage(headlines: HeroHeadlines): string {
  return `${headlines.title}. ${headlines.subtitle}. ${headlines.tagline}.`;
}
