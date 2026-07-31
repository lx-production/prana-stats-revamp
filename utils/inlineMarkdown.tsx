import React from "react";

import type { ReactNode } from "react";
import type { InlineMarkdownOptions } from "../types/inlineMarkdown.types";

/** One block after splitting body text into paragraphs vs lists. */
type MarkdownBlock =
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] };

/** Match markdown ordered items like `1. text`. */
const ORDERED_LIST_ITEM = /^(\d+)\.\s+(.+)$/;

/**
 * Split markdown body into paragraphs and consecutive list blocks.
 * Supports `- ` bullets and `1.` numbered lists. Does not nest lists.
 */
function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let listKind: "unordered-list" | "ordered-list" | null = null;

  const flushParagraph = () => {
    const joined = paragraphLines.join("\n").trim();
    if (joined) blocks.push({ type: "paragraph", text: joined });
    paragraphLines = [];
  };

  const flushList = () => {
    if (listKind && listItems.length > 0) {
      blocks.push({ type: listKind, items: listItems });
    }
    listItems = [];
    listKind = null;
  };

  // Start a list or keep appending; switch kind flushes the previous list.
  const pushListItem = (
    kind: "unordered-list" | "ordered-list",
    item: string,
  ) => {
    flushParagraph();
    if (listKind && listKind !== kind) flushList();
    listKind = kind;
    listItems.push(item);
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Unordered list item: "- text"
    if (trimmed.startsWith("- ")) {
      pushListItem("unordered-list", trimmed.slice(2));
      continue;
    }

    // Ordered list item: "1. text"
    const orderedMatch = ORDERED_LIST_ITEM.exec(trimmed);
    if (orderedMatch) {
      pushListItem("ordered-list", orderedMatch[2]);
      continue;
    }

    // Blank line ends the current paragraph or list.
    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

const INLINE_LINK_CLASS =
  "text-cyan-100 underline decoration-cyan-100/40 underline-offset-2 transition hover:text-white hover:decoration-white/60";

/**
 * Render a plain-text markdown snippet with:
 * - **bold**
 * - `inline code`
 * - [links](url) — external open in a new tab; hash links can call onHashLinkClick
 * Newlines stay as text so the parent can use whitespace-pre-line.
 */
export function renderInlineMarkdown(
  text: string,
  options: InlineMarkdownOptions = {},
): ReactNode[] {
  const { onHashLinkClick } = options;

  // Capture **bold**, `code`, and [label](url) tokens; leave everything else as plain text.
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return (
        <strong key={index} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }

    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code
          key={index}
          className="break-all rounded bg-white/10 px-1 py-0.5 font-mono text-[0.9em] text-cyan-100"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    // Markdown link: [label](url) — external vs same-site paths vs hash actions.
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isExternal = /^https?:\/\//i.test(href);

      if (isExternal) {
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="break-all rounded bg-white/10 px-1 py-0.5 font-mono text-[0.9em] text-cyan-100 underline decoration-cyan-100/40 underline-offset-2 transition hover:text-white hover:decoration-white/60"
          >
            {label}
          </a>
        );
      }

      // Hash links (e.g. #covenants): optional in-app action instead of scrolling.
      if (href.startsWith("#") && onHashLinkClick) {
        const hash = href.slice(1);
        return (
          <a
            key={index}
            href={href}
            className={INLINE_LINK_CLASS}
            onClick={(event) => {
              event.preventDefault();
              onHashLinkClick(hash);
            }}
          >
            {label}
          </a>
        );
      }

      // Internal paths (e.g. /terms, /privacy): same tab, plain text link.
      return (
        <a
          key={index}
          href={href}
          className={INLINE_LINK_CLASS}
        >
          {label}
        </a>
      );
    }

    return <React.Fragment key={index}>{token}</React.Fragment>;
  });
}

const LIST_CLASS = "space-y-1.5 pl-5 marker:text-slate-400";

/**
 * Render markdown body with paragraphs, `- ` / `1.` lists, and inline tokens.
 */
export function renderMarkdownBody(
  text: string,
  options: InlineMarkdownOptions = {},
): ReactNode[] {
  return parseMarkdownBlocks(text).map((block, index) => {
    if (block.type === "unordered-list") {
      return (
        <ul key={index} className={`list-disc ${LIST_CLASS}`}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item, options)}</li>
          ))}
        </ul>
      );
    }

    if (block.type === "ordered-list") {
      return (
        <ol key={index} className={`list-decimal ${LIST_CLASS}`}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item, options)}</li>
          ))}
        </ol>
      );
    }

    return (
      <p key={index} className="whitespace-pre-line">
        {renderInlineMarkdown(block.text, options)}
      </p>
    );
  });
}
