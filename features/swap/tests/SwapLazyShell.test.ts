/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { ensureDom } from '../../../hooks/tests/renderHook.ts';
import { SwapLazyFallback } from '../SwapLazyShell.tsx';

ensureDom();

test('SwapLazyFallback exposes both close controls and closes on Escape', async () => {
  let closeCalls = 0;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      createElement(SwapLazyFallback, {
        onClose: () => {
          closeCalls += 1;
        },
      }),
    );
  });

  assert.equal(
    container.querySelectorAll('button[aria-label="Close swap dialog"]').length,
    2,
  );
  assert.equal(container.querySelector('[aria-busy="true"]')?.textContent, 'Loading swap…');

  await act(async () => {
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  });
  assert.equal(closeCalls, 1);

  await act(async () => {
    root.unmount();
  });
  container.remove();
});
