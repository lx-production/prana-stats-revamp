import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ethers } from 'ethers';

import { PRANA_ADDRESS, WBTC_ADDRESS } from '../../constants/sharedContracts.ts';
import {
  POLYGON_CHAIN_ID,
  SWAP_ROUTER_02_ABI,
  USDT_POLYGON_ADDRESS,
  UNISWAP_SWAP_ROUTER_02_ADDRESS,
  WMATIC_ADDRESS,
} from '../../constants/swapContracts.ts';
import type { HexAddress } from '../../types/swap.types.ts';
import { getSwapToken } from '../../utils/swapTokens.ts';
import { encodeV3Path } from '../loaders/swapQuoteUtils.ts';
import {
  swapQuoteValidationTestUtils,
  type SwapTransactionCandidate,
  type SwapValidationContext,
} from '../loaders/swapQuote.ts';

const OWNER_ADDRESS = '0x0000000000000000000000000000000000000001' as HexAddress;
const SWAP_ROUTER_ADDRESS_THIS_RECIPIENT = '0x0000000000000000000000000000000000000002';
const DEADLINE = 1_800_000_000;
const SWAP_ROUTER_IFACE = new ethers.Interface(SWAP_ROUTER_02_ABI);
const DEADLINELESS_MULTICALL_IFACE = new ethers.Interface([
  'function multicall(bytes[] data) payable returns (bytes[] results)',
]);

function buildContext(amountInRaw: bigint): SwapValidationContext {
  return {
    request: {
      tokenInSymbol: 'WBTC',
      tokenOutSymbol: 'PRANA',
      amountIn: '0.001',
      recipient: OWNER_ADDRESS,
      slippageBps: 50,
    },
    tokenIn: getSwapToken('WBTC'),
    tokenOut: getSwapToken('PRANA'),
    amountInRaw,
    minimumAmountOutRaw: 1n,
    deadline: DEADLINE,
    strictPath: false,
  };
}

function buildNativeOutputContext(amountInRaw: bigint): SwapValidationContext {
  return {
    request: {
      tokenInSymbol: 'USDT',
      tokenOutSymbol: 'POL',
      amountIn: '100',
      recipient: OWNER_ADDRESS,
      slippageBps: 50,
    },
    tokenIn: getSwapToken('USDT'),
    tokenOut: getSwapToken('POL'),
    amountInRaw,
    minimumAmountOutRaw: 1n,
    deadline: DEADLINE,
    strictPath: false,
  };
}

function encodeExactInput(amountIn: bigint): HexAddress {
  return SWAP_ROUTER_IFACE.encodeFunctionData('exactInput', [{
    path: encodeV3Path([WBTC_ADDRESS as HexAddress, PRANA_ADDRESS as HexAddress], [10_000]),
    recipient: OWNER_ADDRESS,
    amountIn,
    amountOutMinimum: 1n,
  }]) as HexAddress;
}

function buildTransaction(data: HexAddress): SwapTransactionCandidate {
  return {
    to: UNISWAP_SWAP_ROUTER_02_ADDRESS,
    data,
    value: '0',
  };
}

test('swap validation allows split AlphaRouter input when cumulative amount stays within the quote input', () => {
  const calldata = SWAP_ROUTER_IFACE.encodeFunctionData('multicall(uint256,bytes[])', [
    DEADLINE,
    [encodeExactInput(40n), encodeExactInput(60n)],
  ]) as HexAddress;

  assert.doesNotThrow(() => {
    swapQuoteValidationTestUtils.validateSwapTransaction(
      buildTransaction(calldata),
      buildContext(100n),
    );
  });
});

test('swap validation rejects multicalls whose cumulative input exceeds the quote input', () => {
  const calldata = SWAP_ROUTER_IFACE.encodeFunctionData('multicall(uint256,bytes[])', [
    DEADLINE,
    [encodeExactInput(60n), encodeExactInput(60n)],
  ]) as HexAddress;

  assert.throws(
    () => {
      swapQuoteValidationTestUtils.validateSwapTransaction(
        buildTransaction(calldata),
        buildContext(100n),
      );
    },
    /too much cumulative input/,
  );
});

test('swap validation rejects the deadline-less multicall variant', () => {
  const calldata = DEADLINELESS_MULTICALL_IFACE.encodeFunctionData('multicall', [
    [encodeExactInput(100n)],
  ]) as HexAddress;

  assert.throws(
    () => {
      swapQuoteValidationTestUtils.validateSwapTransaction(
        buildTransaction(calldata),
        buildContext(100n),
      );
    },
    /unsupported router calldata|without a deadline/,
  );
});

test('swap validation allows SwapRouter02 address(this) recipient before native unwrap', () => {
  const exactInputSingle = SWAP_ROUTER_IFACE.encodeFunctionData('exactInputSingle', [{
    tokenIn: USDT_POLYGON_ADDRESS,
    tokenOut: WMATIC_ADDRESS,
    fee: 500,
    recipient: SWAP_ROUTER_ADDRESS_THIS_RECIPIENT,
    amountIn: 100n,
    amountOutMinimum: 1n,
    sqrtPriceLimitX96: 0n,
  }]) as HexAddress;
  const unwrap = SWAP_ROUTER_IFACE.encodeFunctionData('unwrapWETH9(uint256,address)', [
    1n,
    OWNER_ADDRESS,
  ]) as HexAddress;
  const calldata = SWAP_ROUTER_IFACE.encodeFunctionData('multicall(uint256,bytes[])', [
    DEADLINE,
    [exactInputSingle, unwrap],
  ]) as HexAddress;

  assert.doesNotThrow(() => {
    swapQuoteValidationTestUtils.validateSwapTransaction(
      buildTransaction(calldata),
      buildNativeOutputContext(100n),
    );
  });
});
