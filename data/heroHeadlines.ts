import type { HeroHeadlines, HeroHeadlinesByLocale } from "../types/heroHeadlines.types";

export const heroHeadlinesByLocale: HeroHeadlinesByLocale = {
  en: {
    title: "Strongest Liquidity",
    subtitle: "Highest Protocol Reserve Ratio",
    tagline:
      "Liquidity Density and Reserves you can verify — Top 1 in the entire market",
  },
  vi: {
    title: "Thanh Khoản Mạnh Nhất",
    subtitle: "Tỉ Lệ Dự Trữ Cao Nhất",
    tagline:
      "Sức khỏe thanh khoản và quỹ dự trữ có thể kiểm chứng — Top 1 toàn thị trường",
  },
};

export function formatHeroMessage(headlines: HeroHeadlines): string {
  return `${headlines.title}. ${headlines.subtitle}. ${headlines.tagline}.`;
}
