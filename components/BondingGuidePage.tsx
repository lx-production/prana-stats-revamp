import React from "react";
import { Link2 } from "lucide-react";
import MarkdownDocumentPage from "./MarkdownDocumentPage";
import { useSiteLanguage } from "../hooks/useSiteLanguage";
import { useBondingGuideDocument } from "../hooks/useBondingGuideDocument";

/**
 * Standalone Bonding user guide at `/guide/bonding/`.
 */
const BondingGuidePage: React.FC = () => {
  const { locale } = useSiteLanguage();
  const guideDoc = useBondingGuideDocument();

  return (
    <MarkdownDocumentPage
      icon={Link2}
      document={guideDoc}
      metaNote={
        locale === "en"
          ? "Covers the current PRANA Bonding flow: Approve, Buy (exact WBTC), Sell, vesting, claim, treasury, and quote limits."
          : "Mô tả luồng PRANA Bonding hiện tại: Approve, Buy (exact WBTC), Sell, vesting, claim, treasury, và giới hạn quote."
      }
    />
  );
};

export default BondingGuidePage;
