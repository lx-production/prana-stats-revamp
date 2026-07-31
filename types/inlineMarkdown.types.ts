/** Optional callbacks when rendering inline markdown tokens. */
export type InlineMarkdownOptions = {
  /**
   * Called when the user clicks a hash link like `[label](#covenants)`.
   * `hash` is the fragment without `#` (e.g. `"covenants"`).
   */
  onHashLinkClick?: (hash: string) => void;
};
