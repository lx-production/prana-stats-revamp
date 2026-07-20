import React from "react";

import type { ReactNode } from "react";


/**
 * Render a plain-text markdown snippet with:
 * - **bold**
 * - `inline code`
 * - [links](url) — open in a new tab with rel="nofollow noopener noreferrer"
 * Newlines stay as text so the parent can use whitespace-pre-line.
 */
export function renderInlineMarkdown(text: string): ReactNode[] {
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

    // Markdown link: [label](url) — external vs same-site paths style differently.
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

      // Internal paths (e.g. /terms, /privacy): same tab, plain text link.
      return (
        <a
          key={index}
          href={href}
          className="text-cyan-100 underline decoration-cyan-100/40 underline-offset-2 transition hover:text-white hover:decoration-white/60"
        >
          {label}
        </a>
      );
    }

    return <React.Fragment key={index}>{token}</React.Fragment>;
  });
}
