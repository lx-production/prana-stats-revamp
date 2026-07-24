import React from "react";
import { ArrowLeftRight } from "lucide-react";
import LegalMarkdownPage from "./LegalMarkdownPage";
import { GUIDE_UPDATED_DATE } from "../constants/guides";
import { useSiteLanguage } from "../hooks/useSiteLanguage";
import { useSwapGuideDocument } from "../hooks/useSwapGuideDocument";

/**
 * Standalone Swap user guide at `/guide/swap/`.
 */
const SwapGuidePage: React.FC = () => {
  const { locale } = useSiteLanguage();
  const guideDoc = useSwapGuideDocument();

  return (
    <LegalMarkdownPage
      icon={ArrowLeftRight}
      document={guideDoc}
      effectiveDateIso={GUIDE_UPDATED_DATE}
      dateLabel={locale === "en" ? "Updated: " : "Cập nhật: "}
      metaNote={
        locale === "en"
          ? "Covers the current PRANA Swap wallet flow: approve, exact allowance, slippage, minimum received, pending transactions, and revoke."
          : "Mô tả luồng ví PRANA Swap hiện tại: approve, exact allowance, slippage, minimum received, giao dịch pending, và revoke."
      }
    />
  );
};

export default SwapGuidePage;
