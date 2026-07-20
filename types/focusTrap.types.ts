export type FocusTrapOptions = {
  /** Called on Escape (caller decides whether to close). */
  onEscape?: () => void;
  /** Element to focus first; defaults to first focusable in container. */
  initialFocus?: HTMLElement | null;
};
