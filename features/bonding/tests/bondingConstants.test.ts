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
const LEGACY_CONSTANTS_DIR = path.join(PROJECT_ROOT, 'bonding-legacy-ui', 'constants');

/** Extract `export const NAME = '0x…'` (or number) from a legacy JS constants file. */
async function readLegacyConst(
  filename: string,
  exportName: string,
): Promise<string> {
  const source = await fs.readFile(path.join(LEGACY_CONSTANTS_DIR, filename), 'utf8');
  const match = source.match(
    new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*['"]?([^'";\\s]+)['"]?`),
  );
  assert.ok(match, `expected ${exportName} in ${filename}`);
  return match[1];
}

test('characterization: four deployments match legacy bonding-ui constants', async () => {
  assert.equal(
    BUY_BOND_ADDRESS_V1,
    await readLegacyConst('buyBondContractV1.js', 'BUY_BOND_ADDRESS'),
  );
  assert.equal(
    BUY_BOND_ADDRESS_V2,
    await readLegacyConst('buyBondContractV2.js', 'BUY_BOND_ADDRESS'),
  );
  assert.equal(
    SELL_BOND_ADDRESS_V1,
    await readLegacyConst('sellBondContractV1.js', 'SELL_BOND_ADDRESS'),
  );
  assert.equal(
    SELL_BOND_ADDRESS_V2,
    await readLegacyConst('sellBondContractV2.js', 'SELL_BOND_ADDRESS'),
  );
  assert.equal(BUY_BOND_ADDRESS, BUY_BOND_ADDRESS_V2);
  assert.equal(SELL_BOND_ADDRESS, SELL_BOND_ADDRESS_V2);
});

test('characterization: token decimals and pool match legacy sharedContracts', async () => {
  assert.equal(
    WBTC_ADDRESS,
    await readLegacyConst('sharedContracts.js', 'WBTC_ADDRESS'),
  );
  assert.equal(
    PRANA_ADDRESS,
    await readLegacyConst('sharedContracts.js', 'PRANA_ADDRESS'),
  );
  assert.equal(
    String(PRANA_DECIMALS),
    await readLegacyConst('sharedContracts.js', 'PRANA_DECIMALS'),
  );
  assert.equal(
    String(WBTC_DECIMALS),
    await readLegacyConst('sharedContracts.js', 'WBTC_DECIMALS'),
  );
  assert.equal(
    WBTC_PRANA_V3_POOL,
    await readLegacyConst('sharedContracts.js', 'WBTC_PRANA_V3_POOL'),
  );
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
