import { useMemo } from "react";
import { useSiteLanguage } from "./useSiteLanguage";
import guideBondingContractsEn from "../data/guide-bonding-contracts-en.md?raw";
import guideBondingContractsVi from "../data/guide-bonding-contracts-vi.md?raw";
import { parseSectionedMarkdown } from "../utils/parseSectionedMarkdown";

export function useBondingContractsGuideDocument() {
  const { locale } = useSiteLanguage();
  return useMemo(
    () =>
      parseSectionedMarkdown(
        locale === "en" ? guideBondingContractsEn : guideBondingContractsVi,
      ),
    [locale],
  );
}
