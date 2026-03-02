import { useMemo } from "react";
import faqMarkdown from "../faq.md?raw";
import { parseFaqMarkdown } from "../utils/faqParser";

export const useFaqItems = () =>
  useMemo(() => parseFaqMarkdown(faqMarkdown), []);
