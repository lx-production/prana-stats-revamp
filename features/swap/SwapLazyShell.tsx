import { Loader2, X } from 'lucide-react';
import { trapFocus } from '../../utils/focusTrap';
import React, { Component, useEffect, useRef } from 'react';

import type { ErrorInfo, ReactNode } from 'react';

type ShellProps = {
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** Shared modal chrome for Swap lazy loading / load-error UI (no Web3 imports). */
function SwapLazyShell({ onClose, title, children }: ShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Same focus trap as SwapModal; no restore so SWAP stays visually idle after Esc.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;

    return trapFocus(node, {
      restoreFocus: false,
      initialFocus: closeButtonRef.current,
      onEscape: () => {
        onCloseRef.current();
      },
    });
  }, []);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 outline-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="swap-lazy-title"
      tabIndex={-1}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close swap dialog"
        className="absolute inset-0 bg-black/55 backdrop-blur-md"
      />

      <div className="relative z-10 w-full max-w-lg overflow-visible rounded-3xl border border-white/15 bg-[#070b1f]/85 shadow-[0_28px_90px_rgba(0,0,0,0.7)] ring-1 ring-[#FCE8A9]/10">
        <div className="border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#F5D27A]/70">PRANA Trade</p>
              <h2 id="swap-lazy-title" className="mt-1 text-xl font-semibold text-white">
                {title}
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close swap dialog"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

type FallbackProps = {
  onClose: () => void;
};

/** Suspense fallback: modal shell + spinner; closing hides this immediately. */
export function SwapLazyFallback({ onClose }: FallbackProps) {
  return (
    <SwapLazyShell onClose={onClose} title="Swap on Polygon">
      <div
        className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-white/70"
        aria-busy="true"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#F5D27A]" aria-hidden="true" />
        <p className="text-sm">Loading swap…</p>
      </div>
    </SwapLazyShell>
  );
}

type ErrorBoundaryProps = {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Catches lazy-import failures so homepage stays usable.
 * Retry remounts the lazy tree; reload covers stale hashed assets after deploy.
 */
export class SwapLazyErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Swap lazy load failed', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // Closed while failed: hide UI; keep error so reopening can show recovery actions.
    if (!this.props.isOpen) return null;

    const secondaryActionClassName =
      'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-semibold text-white transition hover:bg-white/10';
    const primaryActionClassName =
      'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#7A5410]/40 bg-[linear-gradient(120deg,#FBE9A7_0%,#F4D46E_18%,#D6A13A_38%,#F7DE84_58%,#B77B22_100%)] px-6 py-4 font-semibold text-[#2B1B05] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),inset_0_-10px_18px_rgba(120,73,0,0.45),0_16px_36px_rgba(0,0,0,0.38)] transition hover:-translate-y-0.5';

    return (
      <SwapLazyShell onClose={this.props.onClose} title="Swap unavailable">
        <p className="text-sm text-white/75">
          The swap UI failed to load. You can try again, or reload the page if a new deploy
          replaced the old script.
        </p>
        <div className="flex flex-col gap-3">
          <button type="button" onClick={this.props.onRetry} className={primaryActionClassName}>
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
            className={secondaryActionClassName}
          >
            Reload page
          </button>
          <button type="button" onClick={this.props.onClose} className={secondaryActionClassName}>
            Close
          </button>
        </div>
      </SwapLazyShell>
    );
  }
}
