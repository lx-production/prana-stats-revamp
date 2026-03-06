import { useMemo } from "react";
import manifestoMarkdown from "../manifesto.md?raw";
import { parseFaqMarkdown } from "../utils/faqParser";

export const useManifestoItems = () =>
  useMemo(() => parseFaqMarkdown(manifestoMarkdown), []);
