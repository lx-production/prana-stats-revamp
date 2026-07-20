import type { FocusTrapOptions } from '../types/focusTrap.types';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Visible, enabled focusable elements inside a container. */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => {
    if (element.closest('[aria-hidden="true"]')) return false;
    // Prefer elements that actually paint (includes fixed-position dialogs).
    return element.getClientRects().length > 0;
  });
}

/**
 * Trap Tab inside `container`, handle Escape, restore focus on cleanup.
 * Returns a disposer — call it when the dialog closes/unmounts.
 */
export function trapFocus(
  container: HTMLElement,
  options: FocusTrapOptions = {},
): () => void {
  const previouslyFocused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  const focusInitial = () => {
    const target =
      options.initialFocus ?? getFocusableElements(container)[0] ?? container;
    target.focus();
  };

  // Defer so the dialog is in the DOM and paint has started.
  const focusTimer = window.setTimeout(focusInitial, 0);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      options.onEscape?.();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', onKeyDown);

  return () => {
    window.clearTimeout(focusTimer);
    document.removeEventListener('keydown', onKeyDown);
    previouslyFocused?.focus?.();
  };
}
