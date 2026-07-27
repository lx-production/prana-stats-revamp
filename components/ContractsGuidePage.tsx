import React from "react";
import { FileText } from "lucide-react";
import MarkdownDocumentPage from "./MarkdownDocumentPage";
import { GUIDE_UPDATED_DATE } from "../constants/guides";
import { useSiteLanguage } from "../hooks/useSiteLanguage";
import { useContractsGuideDocument } from "../hooks/useContractsGuideDocument";

/**
 * Standalone staking contracts explainer at `/guide/staking-contracts/`.
 */
const ContractsGuidePage: React.FC = () => {
  const { locale } = useSiteLanguage();
  const guideDoc = useContractsGuideDocument();

  return (
    <MarkdownDocumentPage
      icon={FileText}
      document={guideDoc}
      effectiveDateIso={GUIDE_UPDATED_DATE}
      dateLabel={locale === "en" ? "Updated: " : "Cập nhật: "}
      metaNote={
        locale === "en"
          ? "Explains the Staking and Interest contracts: how principal and interest are separated, what stakers should know, and what the PRANA Protocol owner can and cannot do on-chain."
          : "Giải thích Hợp đồng Staking và Interest: cách tách vốn gốc với lãi, những gì người stake cần biết, và owner PRANA Protocol có thể / không thể làm gì on-chain."
      }
    />
  );
};

export default ContractsGuidePage;
