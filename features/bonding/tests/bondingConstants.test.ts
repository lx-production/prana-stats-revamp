import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

import {
  BUY_BOND_ADDRESS,
  BUY_BOND_V2_ABI,
  SELL_BOND_ADDRESS,
  SELL_BOND_V2_ABI,
  BUY_BOND_ADDRESS_V1,
  BUY_BOND_ADDRESS_V2,
  SELL_BOND_ADDRESS_V1,
  SELL_BOND_ADDRESS_V2,
  BUY_BOND_ACCOUNT_ABI,
  SELL_BOND_ACCOUNT_ABI,
  bondAbiFunctionNames,
  BUY_BOND_V2_CREATE_FUNCTION_NAMES,
  SELL_BOND_V2_CREATE_FUNCTION_NAMES,
} from '../../../constants/bonds.ts';
import {
  PRANA_ADDRESS,
  WBTC_ADDRESS,
  PRANA_DECIMALS,
  WBTC_DECIMALS,
  WBTC_PRANA_V3_POOL,
} from '../../../constants/sharedContracts.ts';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');

/**
 * Frozen Polygon deployment fixtures formerly compared against bonding-legacy-ui.
 * Keep these as regression anchors after legacy deletion.
 */
const LEGACY_DEPLOYMENT_FIXTURES = {
  buyV1: '0xA3adf8952982Eac60C0E43d6F93C66E7363c6Fe2',
  buyV2: '0x431030E3A0703f0914bE26026ffDaD693F3a16cf',
  sellV1: '0x2A48215e134a9382e1eBAf96F2Fa47Ca1c2fa092',
  sellV2: '0xA6aa0662f5A37ec6E86b3390C46B6eba21a31f71',
  wbtc: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
  prana: '0x928277e774F34272717EADFafC3fd802dAfBD0F5',
  pranaDecimals: 9,
  wbtcDecimals: 8,
  pool: '0xf9A9Fce44AC9E68D7e0B87516fE21536446B1AED',
} as const;

test('characterization: four deployments match frozen legacy fixtures', () => {
  assert.equal(BUY_BOND_ADDRESS_V1, LEGACY_DEPLOYMENT_FIXTURES.buyV1);
  assert.equal(BUY_BOND_ADDRESS_V2, LEGACY_DEPLOYMENT_FIXTURES.buyV2);
  assert.equal(SELL_BOND_ADDRESS_V1, LEGACY_DEPLOYMENT_FIXTURES.sellV1);
  assert.equal(SELL_BOND_ADDRESS_V2, LEGACY_DEPLOYMENT_FIXTURES.sellV2);
  assert.equal(BUY_BOND_ADDRESS, BUY_BOND_ADDRESS_V2);
  assert.equal(SELL_BOND_ADDRESS, SELL_BOND_ADDRESS_V2);
});

test('characterization: token decimals and pool match frozen legacy fixtures', () => {
  assert.equal(WBTC_ADDRESS, LEGACY_DEPLOYMENT_FIXTURES.wbtc);
  assert.equal(PRANA_ADDRESS, LEGACY_DEPLOYMENT_FIXTURES.prana);
  assert.equal(PRANA_DECIMALS, LEGACY_DEPLOYMENT_FIXTURES.pranaDecimals);
  assert.equal(WBTC_DECIMALS, LEGACY_DEPLOYMENT_FIXTURES.wbtcDecimals);
  assert.equal(WBTC_PRANA_V3_POOL, LEGACY_DEPLOYMENT_FIXTURES.pool);
});

test('ABI: V1 account surface is active-bond read + claim + paused only', () => {
  const buyNames = new Set(bondAbiFunctionNames(BUY_BOND_ACCOUNT_ABI));
  const sellNames = new Set(bondAbiFunctionNames(SELL_BOND_ACCOUNT_ABI));

  for (const name of ['paused', 'getUserActiveBonds', 'claimBond']) {
    assert.equal(buyNames.has(name), true, `buy account missing ${name}`);
    assert.equal(sellNames.has(name), true, `sell account missing ${name}`);
  }

  for (const name of BUY_BOND_V2_CREATE_FUNCTION_NAMES) {
    assert.equal(buyNames.has(name), false, `buy V1 account must not include ${name}`);
  }
  for (const name of SELL_BOND_V2_CREATE_FUNCTION_NAMES) {
    assert.equal(sellNames.has(name), false, `sell V1 account must not include ${name}`);
  }

  // V1 create name from legacy Sell must never appear on shared account ABI.
  assert.equal(sellNames.has('sellBondForPranaAmount'), false);
});

test('ABI: create functions only exist on V2 ABIs', () => {
  const buyV2 = new Set(bondAbiFunctionNames(BUY_BOND_V2_ABI));
  const sellV2 = new Set(bondAbiFunctionNames(SELL_BOND_V2_ABI));

  for (const name of BUY_BOND_V2_CREATE_FUNCTION_NAMES) {
    assert.equal(buyV2.has(name), true, `buy V2 missing ${name}`);
  }
  for (const name of SELL_BOND_V2_CREATE_FUNCTION_NAMES) {
    assert.equal(sellV2.has(name), true, `sell V2 missing ${name}`);
  }

  // Config / terms / mins for V2
  assert.equal(buyV2.has('minPranaBuyAmount'), true);
  assert.equal(buyV2.has('bondRates'), true);
  assert.equal(sellV2.has('minPranaSellAmount'), true);
  assert.equal(sellV2.has('bondRates'), true);

  // Claim + active read remain on V2
  assert.equal(buyV2.has('claimBond'), true);
  assert.equal(buyV2.has('getUserActiveBonds'), true);
  assert.equal(sellV2.has('claimBond'), true);
  assert.equal(sellV2.has('getUserActiveBonds'), true);

  // Sell V2 uses sellBond, not the V1 sellBondForPranaAmount name.
  assert.equal(sellV2.has('sellBondForPranaAmount'), false);
});

test('ABI tuples: getUserActiveBonds component field order matches V1/V2 structs', () => {
  const buyActive = BUY_BOND_ACCOUNT_ABI.find((f) => f.name === 'getUserActiveBonds');
  const sellActive = SELL_BOND_ACCOUNT_ABI.find((f) => f.name === 'getUserActiveBonds');
  assert.ok(buyActive && sellActive);

  const buyFields = buyActive.outputs[0]?.components?.map((c) => c.name) ?? [];
  const sellFields = sellActive.outputs[0]?.components?.map((c) => c.name) ?? [];

  assert.deepEqual(buyFields, [
    'id',
    'owner',
    'wbtcAmount',
    'pranaAmount',
    'maturityTime',
    'creationTime',
    'lastClaimTime',
    'claimedPrana',
    'claimed',
  ]);
  assert.deepEqual(sellFields, [
    'id',
    'owner',
    'pranaAmount',
    'wbtcAmount',
    'maturityTime',
    'creationTime',
    'lastClaimTime',
    'claimedWbtc',
    'claimed',
  ]);

  // Create + claim arg shapes used by simulateContract / writeContract.
  const buyExact = BUY_BOND_V2_ABI.find((f) => f.name === 'buyBondForWbtcAmount');
  const buyTarget = BUY_BOND_V2_ABI.find((f) => f.name === 'buyBondForPranaAmount');
  const sellCreate = SELL_BOND_V2_ABI.find((f) => f.name === 'sellBond');
  const claim = BUY_BOND_V2_ABI.find((f) => f.name === 'claimBond');

  assert.deepEqual(
    buyExact?.inputs.map((i) => [i.name, i.type]),
    [
      ['wbtcAmount', 'uint256'],
      ['period', 'uint8'],
    ],
  );
  assert.deepEqual(
    buyTarget?.inputs.map((i) => [i.name, i.type]),
    [
      ['pranaAmount', 'uint256'],
      ['period', 'uint8'],
    ],
  );
  assert.deepEqual(
    sellCreate?.inputs.map((i) => [i.name, i.type]),
    [
      ['pranaAmount', 'uint256'],
      ['period', 'uint8'],
    ],
  );
  assert.deepEqual(claim?.inputs.map((i) => [i.name, i.type]), [['bondId', 'uint256']]);
});

/** Hex address literal (0x + 40 hex chars) — must not appear under bonding feature/UI. */
const ADDRESS_LITERAL_RE = /0x[a-fA-F0-9]{40}/;

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'tests' || entry.name === 'node_modules') continue;
      files.push(...(await collectSourceFiles(fullPath)));
      continue;
    }
    if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

test('static search: no address literals or second ABI catalogs in bonding feature/UI', async () => {
  const scanRoots = [
    path.join(PROJECT_ROOT, 'features', 'bonding'),
    path.join(PROJECT_ROOT, 'pages', 'BondingPage.tsx'),
  ];

  const files: string[] = [];
  for (const root of scanRoots) {
    const stat = await fs.stat(root);
    if (stat.isDirectory()) {
      files.push(...(await collectSourceFiles(root)));
    } else {
      files.push(root);
    }
  }

  // Bonding loaders land in Bước 3 — if any exist early, scan them too.
  const loadersDir = path.join(PROJECT_ROOT, 'server', 'loaders');
  const loaderEntries = await fs.readdir(loadersDir);
  for (const name of loaderEntries) {
    if (name.startsWith('bonding')) {
      files.push(path.join(loadersDir, name));
    }
  }

  for (const filePath of files) {
    const source = await fs.readFile(filePath, 'utf8');
    const relative = path.relative(PROJECT_ROOT, filePath);

    assert.doesNotMatch(
      source,
      ADDRESS_LITERAL_RE,
      `${relative} must not embed contract address literals — import from constants/bonds or sharedContracts`,
    );

    // Guard against a second hand-copied ABI array living outside constants/bonds.ts.
    assert.doesNotMatch(
      source,
      /export const \w+_ABI\s*=\s*\[/,
      `${relative} must not define a second ABI catalog`,
    );
  }
});
