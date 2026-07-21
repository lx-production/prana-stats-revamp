import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getStakeCtaPhase } from '../staking/stakeCtaPhase.ts';

test('getStakeCtaPhase prefers live wallet statuses over leftover permit', () => {
  assert.equal(getStakeCtaPhase('signing', true), 'signing');
  assert.equal(getStakeCtaPhase('submitting', true), 'submitting');
  assert.equal(getStakeCtaPhase('confirming', false), 'confirming');
  assert.equal(getStakeCtaPhase('success', false), 'success');
});

test('getStakeCtaPhase shows continue when a valid permit remains after idle/error', () => {
  assert.equal(getStakeCtaPhase('idle', true), 'continue_stake');
  assert.equal(getStakeCtaPhase('signed', true), 'continue_stake');
  assert.equal(getStakeCtaPhase('error', true), 'continue_stake');
});

test('getStakeCtaPhase resumes confirming when a hash is pending', () => {
  assert.equal(getStakeCtaPhase('error', true, true), 'resume_confirming');
  assert.equal(getStakeCtaPhase('idle', false, true), 'resume_confirming');
  assert.equal(getStakeCtaPhase('error', false, true), 'resume_confirming');
});

test('getStakeCtaPhase defaults to permit_and_stake without a valid permit', () => {
  assert.equal(getStakeCtaPhase('idle', false), 'permit_and_stake');
  assert.equal(getStakeCtaPhase('error', false), 'permit_and_stake');
  assert.equal(getStakeCtaPhase('signed', false), 'permit_and_stake');
});
