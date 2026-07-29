import React from "react";
import { Link2 } from "lucide-react";
import MarkdownDocumentPage from "./MarkdownDocumentPage";
import { GUIDE_UPDATED_DATE } from "../constants/guides";
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
      effectiveDateIso={GUIDE_UPDATED_DATE}
      dateLabel={locale === "en" ? "Updated: " : "Cập nhật: "}
      metaNote={
        locale === "en"
          ? "Covers the current PRANA Bonding flow: Approve, Buy (exact WBTC), Sell, vesting, claim, treasury, and quote limits."
          : "Mô tả luồng PRANA Bonding hiện tại: Approve, Buy (exact WBTC), Sell, vesting, claim, treasury, và giới hạn quote."
      }
    />
  );
};

export default BondingGuidePage;
