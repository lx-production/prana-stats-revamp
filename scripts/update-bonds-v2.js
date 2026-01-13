import { ethers } from 'ethers';
import fs from 'node:fs/promises';
import path from 'node:path';

import { BUY_BOND_ADDRESS_V2, SELL_BOND_ADDRESS_V2, BUY_BOND_BONDS_ABI, SELL_BOND_BONDS_ABI } from '../constants/bonds.js';

import { sleep, serializeForJson, getBondTupleFieldNames, loadDotEnvIntoProcessEnv, getRpcUrl, redactUrl, isOutOfRangeError, isRateLimitError, toBigInt, PROJECT_ROOT } from '../utils/bondsScanUtils.js';

const REQUEST_DELAY_MS = 0;

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function lastBondIndex(detailsSide) {
  const bonds = detailsSide?.bonds;
  if (!Array.isArray(bonds) || bonds.length === 0) return 0;
  const last = bonds[bonds.length - 1];
  const idx = typeof last?.index === 'number' ? last.index : 0;
  return Number.isFinite(idx) && idx > 0 ? idx : 0;
}

async function scanFromIndex({ contract, label, startIndex, existingBonds, existingPranaTotal }) {
  let index = startIndex + 1;
  const fieldNames = getBondTupleFieldNames(contract);

  const bonds = Array.isArray(existingBonds) ? [...existingBonds] : [];
  let pranaTotal = typeof existingPranaTotal === 'bigint' ? existingPranaTotal : 0n;
  let added = 0;

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

      added += 1;
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
    added,
    count: bonds.length,
    pranaAmount: pranaTotal.toString(),
    bonds,
  };
}

/**
 * Incrementally update the repo JSON files:
 * - Reads `bonds_v2_details.json` to find last scanned indices
 * - Scans only the *next* bond ids until out-of-range
 * - Writes `bonds_v2.json` + `bonds_v2_details.json` only when new bonds were found
 */
export async function updateBondsV2() {
  await loadDotEnvIntoProcessEnv();

  const rpcUrl = getRpcUrl();
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const buyBondContract = new ethers.Contract(BUY_BOND_ADDRESS_V2, BUY_BOND_BONDS_ABI, provider);
  const sellBondContract = new ethers.Contract(SELL_BOND_ADDRESS_V2, SELL_BOND_BONDS_ABI, provider);

  const detailsPath = path.join(PROJECT_ROOT, 'bonds_v2_details.json');
  const summaryPath = path.join(PROJECT_ROOT, 'bonds_v2.json');

  const existingDetails = await readJsonIfExists(detailsPath);

  // If we don't have details yet, fall back to full scan script (simple + consistent).
  if (!existingDetails?.buy?.bonds || !existingDetails?.sell?.bonds) {
    console.log('No existing bonds_v2_details.json found; run `node scripts/scan-bonds-v2.js` first.');
    return { updated: false, reason: 'missing_details_file' };
  }

  const buyStart = lastBondIndex(existingDetails.buy);
  const sellStart = lastBondIndex(existingDetails.sell);

  const buyExistingTotal = typeof existingDetails?.buy?.pranaAmount === 'string' ? BigInt(existingDetails.buy.pranaAmount) : 0n;
  const sellExistingTotal = typeof existingDetails?.sell?.pranaAmount === 'string' ? BigInt(existingDetails.sell.pranaAmount) : 0n;

  const [buy, sell] = await Promise.all([
    scanFromIndex({
      contract: buyBondContract,
      label: 'buy',
      startIndex: buyStart,
      existingBonds: existingDetails.buy.bonds,
      existingPranaTotal: buyExistingTotal,
    }),
    scanFromIndex({
      contract: sellBondContract,
      label: 'sell',
      startIndex: sellStart,
      existingBonds: existingDetails.sell.bonds,
      existingPranaTotal: sellExistingTotal,
    }),
  ]);

  const hasNew = buy.added > 0 || sell.added > 0;
  if (!hasNew) {
    return { updated: false, added: { buy: 0, sell: 0 } };
  }

  const generatedAt = new Date().toISOString();
  const redactedRpc = redactUrl(rpcUrl);

  const detailsOut = {
    generatedAt,
    rpcUrl: redactedRpc,
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

  const summaryOut = {
    generatedAt,
    rpcUrl: redactedRpc,
    buy: {
      address: BUY_BOND_ADDRESS_V2,
      pranaAmount: buy.pranaAmount,
    },
    sell: {
      address: SELL_BOND_ADDRESS_V2,
      pranaAmount: sell.pranaAmount,
    },
  };

  await fs.writeFile(detailsPath, JSON.stringify(detailsOut, null, 2), 'utf8');
  await fs.writeFile(summaryPath, JSON.stringify(summaryOut, null, 2), 'utf8');

  return { updated: true, added: { buy: buy.added, sell: sell.added } };
}

async function main() {
  const result = await updateBondsV2();
  if (result?.updated) {
    console.log('Updated V2 bonds JSON:', result);
  } else {
    console.log('No update needed:', result);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Failed to update V2 bonds:', err);
    process.exitCode = 1;
  });
}

