import React from "react";

import type { ReactNode } from "react";


/**
 * Render a plain-text markdown snippet with:
 * - **bold**
 * - `inline code`
 * Newlines stay as text so the parent can use whitespace-pre-line.
 */
export function renderInlineMarkdown(text: string): ReactNode[] {
  // Capture **bold** and `code` tokens; leave everything else as plain text.
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

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

    return <React.Fragment key={index}>{token}</React.Fragment>;
  });
}
