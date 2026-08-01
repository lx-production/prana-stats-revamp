/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBondCtaPhase } from '../utils/bondCtaPhase.ts';

test('getBondCtaPhase prefers live wallet statuses over allowance', () => {
  assert.equal(getBondCtaPhase('approving', true), 'approve');
  assert.equal(getBondCtaPhase('submitting', false), 'create');
  assert.equal(getBondCtaPhase('confirming', false), 'confirming');
  assert.equal(getBondCtaPhase('success', false), 'success');
});

test('getBondCtaPhase resumes confirmation when a hash is pending', () => {
  assert.equal(
    getBondCtaPhase('error', true, true),
    'confirmation_unavailable',
  );
  assert.equal(
    getBondCtaPhase('idle', false, true),
    'confirmation_unavailable',
  );
  assert.equal(
    getBondCtaPhase('confirmation_unavailable', false, false),
    'confirmation_unavailable',
  );
});

test('getBondCtaPhase shows approve when allowance is required', () => {
  assert.equal(getBondCtaPhase('idle', true), 'approve');
  assert.equal(getBondCtaPhase('error', true), 'approve');
});

test('getBondCtaPhase defaults to create when allowance is sufficient', () => {
  assert.equal(getBondCtaPhase('idle', false), 'create');
  assert.equal(getBondCtaPhase('error', false), 'create');
});
