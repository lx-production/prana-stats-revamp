/**
 * Minimal renderHook for characterization tests (happy-dom + React act).
 * Keeps hook tests free of @testing-library while providers are still at root.
 */
import { Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

import type { ReactNode } from 'react';

let domReady = false;

/** Install a happy-dom window once per process for React createRoot. */
export function ensureDom(): void {
  if (domReady) return;

  const window = new Window({ url: 'http://localhost/' });

  // Delegate to whatever is currently on globalThis so `mock.timers.enable()`
  // (which replaces the globals later) still drives `window.setTimeout` calls.
  // happy-dom types timer IDs as NodeJS.Timeout; browsers use number — bridge via unknown.
  window.setTimeout = ((handler: unknown, timeout?: number, ...args: unknown[]) =>
    globalThis.setTimeout(handler as never, timeout, ...(args as never[]))) as unknown as typeof window.setTimeout;
  window.clearTimeout = ((id?: ReturnType<typeof globalThis.setTimeout>) =>
    globalThis.clearTimeout(id as never)) as unknown as typeof window.clearTimeout;
  window.setInterval = ((handler: unknown, timeout?: number, ...args: unknown[]) =>
    globalThis.setInterval(handler as never, timeout, ...(args as never[]))) as unknown as typeof window.setInterval;
  window.clearInterval = ((id?: ReturnType<typeof globalThis.setInterval>) =>
    globalThis.clearInterval(id as never)) as unknown as typeof window.clearInterval;

  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Node: window.Node,
    CustomEvent: window.CustomEvent,
    MutationObserver: window.MutationObserver,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  domReady = true;
}

type RenderHookResult<T> = {
  result: { current: T };
  rerender: (nextHook?: () => T) => Promise<void>;
  unmount: () => Promise<void>;
};

/**
 * Mount a hook inside a throwaway component and expose `.result.current`.
 * Optional `wrapper` lets tests inject providers later without rewriting callers.
 */
export async function renderHook<T>(
  useHook: () => T,
  options?: { wrapper?: (props: { children: ReactNode }) => ReactNode },
): Promise<RenderHookResult<T>> {
  ensureDom();

  let currentHook = useHook;
  const result: { current: T } = { current: undefined as T };

  function Probe() {
    result.current = currentHook();
    return null;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const renderProbe = async () => {
    const tree = options?.wrapper
      ? createElement(options.wrapper, null, createElement(Probe))
      : createElement(Probe);
    await act(async () => {
      root.render(tree);
    });
  };

  await renderProbe();

  return {
    result,
    rerender: async (nextHook) => {
      if (nextHook) currentHook = nextHook;
      await renderProbe();
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}
