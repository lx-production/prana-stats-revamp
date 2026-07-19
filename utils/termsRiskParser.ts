import type { TermsRiskDocument, TermsRiskSection } from "../types/termsRisk.types";

/** Turn a heading into a stable URL-friendly id. */
function slugifyHeading(heading: string): string {
  return heading
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Parse Terms / Risk Disclosure markdown:
 * - first `#` line → title
 * - paragraphs before the first `##` → intro
 * - each `##` block → a section
 */
export function parseTermsRiskMarkdown(markdown: string): TermsRiskDocument {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  let title = "";
  const introLines: string[] = [];
  const sections: TermsRiskSection[] = [];

  let currentHeading = "";
  let bodyLines: string[] = [];
  let pastTitle = false;

  const pushSection = () => {
    if (!currentHeading) return;
    sections.push({
      id: slugifyHeading(currentHeading) || `section-${sections.length + 1}`,
      heading: currentHeading,
      body: bodyLines.join("\n").trim().replace(/\n{3,}/g, "\n\n"),
    });
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("# ") && !pastTitle) {
      title = trimmed.slice(2).trim();
      pastTitle = true;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      pushSection();
      currentHeading = trimmed.slice(3).trim();
      bodyLines = [];
      continue;
    }

    if (!pastTitle) continue;

    if (!currentHeading) {
      introLines.push(rawLine);
      continue;
    }

    bodyLines.push(rawLine);
  }

  pushSection();

  return {
    title: title || "Terms / Risk Disclosure",
    intro: introLines.join("\n").trim().replace(/\n{3,}/g, "\n\n"),
    sections,
  };
}
