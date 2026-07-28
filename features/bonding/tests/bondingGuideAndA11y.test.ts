/// <reference types="node" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { GUIDE_UPDATED_DATE } from '../../../constants/guides.ts';
import {
  GUIDE_BONDING_CANONICAL_PATH,
  GUIDE_BONDING_CONTRACTS_CANONICAL_PATH,
} from '../../../constants/appRoutes.ts';
import { parseSectionedMarkdown } from '../../../utils/parseSectionedMarkdown.ts';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

function readRepoFile(...parts: string[]): string {
  return fs.readFileSync(path.join(rootDir, ...parts), 'utf8');
}

test('GUIDE_UPDATED_DATE is ISO date used by bonding guides', () => {
  assert.match(GUIDE_UPDATED_DATE, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(GUIDE_UPDATED_DATE, '2026-07-28');
});

test('bonding guide markdown parses VI/EN with cross-links', () => {
  const en = parseSectionedMarkdown(readRepoFile('data', 'guide-bonding-en.md'));
  const vi = parseSectionedMarkdown(readRepoFile('data', 'guide-bonding-vi.md'));

  assert.equal(en.sections.length, vi.sections.length);
  assert.ok(en.sections.length >= 5);
  assert.match(en.intro, /\/bond\//);
  assert.match(en.intro, /\/terms/);
  assert.match(
    en.sections.at(-1)?.body ?? '',
    /\/guide\/bonding-contracts\//,
  );
  assert.match(vi.title, /Bonding/);
  assert.match(vi.intro, /\/bond\//);
});

test('bonding contracts guide markdown parses VI/EN and notes V1 claim-only', () => {
  const en = parseSectionedMarkdown(
    readRepoFile('data', 'guide-bonding-contracts-en.md'),
  );
  const vi = parseSectionedMarkdown(
    readRepoFile('data', 'guide-bonding-contracts-vi.md'),
  );

  assert.equal(en.sections.length, vi.sections.length);
  assert.ok(en.sections.length >= 7);
  assert.match(en.intro, /BuyPranaBondV2/);
  assert.match(en.intro, /SellPranaBondV2/);
  assert.match(en.intro, /V1/);
  assert.match(en.intro, /\/guide\/bonding\//);
  assert.match(vi.intro, /V2/);
});

test('Bonding page header links contracts guide; footer links user guide', () => {
  const bondingPage = readRepoFile('pages', 'BondingPage.tsx');
  const footer = readRepoFile('components', 'AppFooter.tsx');

  assert.match(bondingPage, /GUIDE_BONDING_CONTRACTS_CANONICAL_PATH/);
  assert.doesNotMatch(bondingPage, /Contracts guide route lands in Bước 7/);

  assert.match(footer, /GUIDE_BONDING_CANONICAL_PATH/);
  assert.ok(GUIDE_BONDING_CANONICAL_PATH.endsWith('/'));
  assert.ok(GUIDE_BONDING_CONTRACTS_CANONICAL_PATH.endsWith('/'));
});

test('guide routes stay outside BondingEntry / Web3 providers', () => {
  const main = readRepoFile('main.tsx');
  const entry = readRepoFile('features', 'bonding', 'BondingEntry.tsx');

  assert.match(main, /BondingGuidePage/);
  assert.match(main, /BondingContractsGuidePage/);
  assert.match(main, /isGuideBondingPath/);
  assert.match(main, /isGuideBondingContractsPath/);
  assert.doesNotMatch(entry, /GuidePage|guide-bonding/);
});

test('Bonding and Staking share neutral WalletControl / TxLink; no Bonding→Staking imports', () => {
  const bondingFiles = [
    'pages/BondingPage.tsx',
    'features/bonding/components/BondingForm.tsx',
    'features/bonding/components/ActiveBonds.tsx',
    'features/bonding/components/BondCard.tsx',
    'features/bonding/components/CreateBondReviewDialog.tsx',
  ];

  for (const relative of bondingFiles) {
    const source = readRepoFile(...relative.split('/'));
    assert.doesNotMatch(
      source,
      /from ['"].*features\/staking/,
      `${relative} must not import features/staking`,
    );
  }

  const bondingPage = readRepoFile('pages', 'BondingPage.tsx');
  const stakingPage = readRepoFile('pages', 'StakingPage.tsx');
  const stakingWallet = readRepoFile(
    'features',
    'staking',
    'components',
    'WalletControl.tsx',
  );
  assert.match(bondingPage, /features\/web3\/WalletControl/);
  assert.match(stakingPage, /features\/staking\/components\/WalletControl/);
  assert.match(stakingWallet, /web3\/WalletControl/);

  const bondingForm = readRepoFile(
    'features',
    'bonding',
    'components',
    'BondingForm.tsx',
  );
  const stakingForm = readRepoFile(
    'features',
    'staking',
    'components',
    'StakingForm.tsx',
  );
  assert.match(bondingForm, /components\/ui\/TxLink/);
  assert.match(stakingForm, /components\/ui\/TxLink/);
});

test('StatusBanner exposes alert/status roles with aria-live', () => {
  const banner = readRepoFile('components', 'ui', 'StatusBanner.tsx');
  assert.match(banner, /role=\{isError \? 'alert' : 'status'\}/);
  assert.match(banner, /aria-live/);
});

test('reduced-motion CSS freezes continuous spinner animation', () => {
  const css = readRepoFile('index.css');
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.animate-spin\s*\{[\s\S]*animation:\s*none/);
});

test('BondSideTabs and TermSelector expose radiogroup keyboard pattern', () => {
  const tabs = readRepoFile(
    'features',
    'bonding',
    'components',
    'BondSideTabs.tsx',
  );
  const terms = readRepoFile(
    'features',
    'bonding',
    'components',
    'TermSelector.tsx',
  );

  for (const source of [tabs, terms]) {
    assert.match(source, /role="radiogroup"/);
    assert.match(source, /role="radio"/);
    assert.match(source, /ArrowRight/);
    assert.match(source, /ArrowLeft/);
    assert.match(source, /Home/);
    assert.match(source, /End/);
    assert.match(source, /tabIndex/);
  }
});

test('CreateBondReviewDialog traps focus and supports Escape', () => {
  const dialog = readRepoFile(
    'features',
    'bonding',
    'components',
    'CreateBondReviewDialog.tsx',
  );

  assert.match(dialog, /trapFocus/);
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /onEscape/);
});
