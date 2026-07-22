export type FocusTrapOptions = {
  /** Called on Escape (caller decides whether to close). */
  onEscape?: () => void;
  /** Element to focus first; defaults to first focusable in container. */
  initialFocus?: HTMLElement | null;
  /**
   * When true (default), return focus to the trigger on cleanup.
   * Set false to leave no focused trigger (e.g. hero SWAP after Esc).
   */
  restoreFocus?: boolean;
};
