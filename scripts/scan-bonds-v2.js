import { ethers } from 'ethers';
import fs from 'node:fs/promises';
import path from 'node:path';

import { BUY_BOND_ADDRESS_V2, SELL_BOND_ADDRESS_V2, BUY_BOND_BONDS_ABI, SELL_BOND_BONDS_ABI } from '../constants/bonds.js';
import { sleep, serializeForJson, getBondTupleFieldNames, loadDotEnvIntoProcessEnv, getRpcUrl, redactUrl, isOutOfRangeError, isRateLimitError, toBigInt, PROJECT_ROOT } from '../utils/bondsScanUtils.js';

const REQUEST_DELAY_MS = 0;

async function scanBonds({ contract, label }) {
  let index = 1;
  const bonds = [];
  const fieldNames = getBondTupleFieldNames(contract);
  let pranaTotal = 0n;

  while (true) {
    try {
      const bond = await contract.bonds(index);
      if (!bond) break;

      pranaTotal += toBigInt(bond?.pranaAmount);

      const raw = [];
      const len = typeof bond?.length === 'number' ? bond.length : 0;
      for (let i = 0; i < len; i += 1) {
        raw.push(serializeForJson(bond[i]));
      }

      const fields = {};
      if (fieldNames && fieldNames.length === raw.length) {
        for (let i = 0; i < raw.length; i += 1) {
          fields[fieldNames[i]] = raw[i];
        }
      } else {
        for (let i = 0; i < raw.length; i += 1) {
          fields[`field${i}`] = raw[i];
        }
      }

      bonds.push({
        index,
        ...fields,
        raw,
      });

      index += 1;
      if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
    } catch (error) {
      if (isOutOfRangeError(error)) break;

      if (isRateLimitError(error)) {
        await sleep(2_000);
        continue;
      }

      console.warn(`Error fetching ${label} bond at index ${index}`, error);
      throw error;
    }
  }

  return {
    count: bonds.length,
    pranaAmount: pranaTotal.toString(),
    bonds,
  };
}

async function main() {
  await loadDotEnvIntoProcessEnv();

  const rpcUrl = getRpcUrl();
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const buyBondContract = new ethers.Contract(BUY_BOND_ADDRESS_V2, BUY_BOND_BONDS_ABI, provider);
  const sellBondContract = new ethers.Contract(SELL_BOND_ADDRESS_V2, SELL_BOND_BONDS_ABI, provider);

  console.log('Using RPC:', redactUrl(rpcUrl));
  console.log('BUY_BOND_ADDRESS_V2:', BUY_BOND_ADDRESS_V2);
  console.log('SELL_BOND_ADDRESS_V2:', SELL_BOND_ADDRESS_V2);

  const [buy, sell] = await Promise.all([
    scanBonds({ contract: buyBondContract, label: 'buy' }),
    scanBonds({ contract: sellBondContract, label: 'sell' }),
  ]);

  const out = {
    generatedAt: new Date().toISOString(),
    rpcUrl: redactUrl(rpcUrl),
    buy: {
      address: BUY_BOND_ADDRESS_V2,
      pranaAmount: buy.pranaAmount,
    },
    sell: {
      address: SELL_BOND_ADDRESS_V2,
      pranaAmount: sell.pranaAmount,
    },
  };

  const outPath = path.join(PROJECT_ROOT, 'bonds_v2.json');
  await fs.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');

  console.log(
    `Wrote totals for ${buy.count} buy bonds and ${sell.count} sell bonds to: ${outPath}`,
  );

  const detailsOut = {
    generatedAt: new Date().toISOString(),
    rpcUrl: redactUrl(rpcUrl),
    buy: {
      address: BUY_BOND_ADDRESS_V2,
      pranaAmount: buy.pranaAmount,
      count: buy.count,
      bonds: buy.bonds,
    },
    sell: {
      address: SELL_BOND_ADDRESS_V2,
      pranaAmount: sell.pranaAmount,
      count: sell.count,
      bonds: sell.bonds,
    },
  };

  const detailsOutPath = path.join(PROJECT_ROOT, 'bonds_v2_details.json');
  await fs.writeFile(detailsOutPath, JSON.stringify(detailsOut, null, 2), 'utf8');

  console.log(
    `Wrote bond details for ${buy.count} buy bonds and ${sell.count} sell bonds to: ${detailsOutPath}`,
  );
}

main().catch((err) => {
  console.error('Failed to scan V2 bonds:', err);
  process.exitCode = 1;
});


