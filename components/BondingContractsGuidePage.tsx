import React from "react";
import { FileText } from "lucide-react";
import MarkdownDocumentPage from "./MarkdownDocumentPage";
import { useSiteLanguage } from "../hooks/useSiteLanguage";
import { useBondingContractsGuideDocument } from "../hooks/useBondingContractsGuideDocument";

/**
 * Standalone bonding contracts explainer at `/guide/bonding-contracts/`.
 */
const BondingContractsGuidePage: React.FC = () => {
  const { locale } = useSiteLanguage();
  const guideDoc = useBondingContractsGuideDocument();

  return (
    <MarkdownDocumentPage
      icon={FileText}
      document={guideDoc}
      metaNote={
        locale === "en"
          ? "Explains BuyPranaBondV2 and SellPranaBondV2: reserves, create/claim rules, pause/treasury controls, and what PRANA Protocol can and cannot change after a bond is created."
          : "Giải thích BuyPranaBondV2 và SellPranaBondV2: reserves, quy tắc tạo/claim, pause/treasury, và PRANA Protocol có thể / không thể thay đổi gì sau khi bond đã tạo."
      }
    />
  );
};

export default BondingContractsGuidePage;
