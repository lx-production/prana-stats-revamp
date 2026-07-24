import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ethers } from 'ethers';

import { POLYGON_CHAIN_ID } from '../../constants/network.ts';
import { PRANA_ADDRESS, WBTC_ADDRESS } from '../../constants/sharedContracts.ts';
import {
  SWAP_ROUTER_02_ABI,
  USDT_POLYGON_ADDRESS,
  UNISWAP_SWAP_ROUTER_02_ADDRESS,
  WMATIC_ADDRESS,
} from '../../constants/swapContracts.ts';
import { getSwapToken } from '../../utils/swapTokens.ts';
import { encodeV3Path } from '../utils/swapQuoteUtils.ts';
import { swapQuoteValidationTestUtils } from '../loaders/swapValidations.ts';

import type { HexAddress, SwapTransactionCandidate, SwapValidationContext } from '../../types/swap.types.ts';

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

function buildNativeInputContext(amountInRaw: bigint): SwapValidationContext {
  return {
    request: {
      tokenInSymbol: 'POL',
      tokenOutSymbol: 'USDT',
      amountIn: '1',
      recipient: OWNER_ADDRESS,
      slippageBps: 50,
    },
    tokenIn: getSwapToken('POL'),
    tokenOut: getSwapToken('USDT'),
    amountInRaw,
    minimumAmountOutRaw: 1n,
    deadline: DEADLINE,
    strictPath: false,
  };
}

function wrapInDeadlineMulticall(innerCalls: HexAddress[], deadline = DEADLINE): HexAddress {
  return SWAP_ROUTER_IFACE.encodeFunctionData('multicall(uint256,bytes[])', [
    deadline,
    innerCalls,
  ]) as HexAddress;
}

test('swap validation rejects an unexpected router address', () => {
  const calldata = wrapInDeadlineMulticall([encodeExactInput(100n)]);

  assert.throws(
    () => {
      swapQuoteValidationTestUtils.validateSwapTransaction(
        {
          to: '0x00000000000000000000000000000000000000aa' as HexAddress,
          data: calldata,
          value: '0',
        },
        buildContext(100n),
      );
    },
    /unexpected router address/,
  );
});

test('swap validation rejects non-zero value for ERC-20 token-in', () => {
  const calldata = wrapInDeadlineMulticall([encodeExactInput(100n)]);

  assert.throws(
    () => {
      swapQuoteValidationTestUtils.validateSwapTransaction(
        {
          to: UNISWAP_SWAP_ROUTER_02_ADDRESS,
          data: calldata,
          value: '1',
        },
        buildContext(100n),
      );
    },
    /unexpected transaction value/,
  );
});

test('swap validation rejects wrong native value for POL token-in', () => {
  // Native POL in must attach value == amountInRaw; zero value is invalid
  const exactInputSingle = SWAP_ROUTER_IFACE.encodeFunctionData('exactInputSingle', [{
    tokenIn: WMATIC_ADDRESS,
    tokenOut: USDT_POLYGON_ADDRESS,
    fee: 500,
    recipient: OWNER_ADDRESS,
    amountIn: 100n,
    amountOutMinimum: 1n,
    sqrtPriceLimitX96: 0n,
  }]) as HexAddress;
  const calldata = wrapInDeadlineMulticall([exactInputSingle]);

  assert.throws(
    () => {
      swapQuoteValidationTestUtils.validateSwapTransaction(
        {
          to: UNISWAP_SWAP_ROUTER_02_ADDRESS,
          data: calldata,
          value: '0',
        },
        buildNativeInputContext(100n),
      );
    },
    /unexpected transaction value/,
  );
});

test('swap validation rejects an empty multicall', () => {
  const calldata = wrapInDeadlineMulticall([]);

  assert.throws(
    () => {
      swapQuoteValidationTestUtils.validateSwapTransaction(
        buildTransaction(calldata),
        buildContext(100n),
      );
    },
    /empty multicall/,
  );
});

test('swap validation rejects an unexpected multicall deadline', () => {
  const calldata = wrapInDeadlineMulticall([encodeExactInput(100n)], DEADLINE + 1);

  assert.throws(
    () => {
      swapQuoteValidationTestUtils.validateSwapTransaction(
        buildTransaction(calldata),
        buildContext(100n),
      );
    },
    /unexpected deadline/,
  );
});

test('swap validation rejects an unexpected swap recipient', () => {
  const unexpectedRecipient = '0x00000000000000000000000000000000000000aa';
  const exactInput = SWAP_ROUTER_IFACE.encodeFunctionData('exactInput', [{
    path: encodeV3Path([WBTC_ADDRESS as HexAddress, PRANA_ADDRESS as HexAddress], [10_000]),
    recipient: unexpectedRecipient,
    amountIn: 100n,
    amountOutMinimum: 1n,
  }]) as HexAddress;
  const calldata = wrapInDeadlineMulticall([exactInput]);

  assert.throws(
    () => {
      swapQuoteValidationTestUtils.validateSwapTransaction(
        buildTransaction(calldata),
        buildContext(100n),
      );
    },
    /unexpected recipient/,
  );
});

test('swap validation rejects an unexpected unwrap payment recipient', () => {
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
    '0x00000000000000000000000000000000000000aa',
  ]) as HexAddress;
  const calldata = wrapInDeadlineMulticall([exactInputSingle, unwrap]);

  assert.throws(
    () => {
      swapQuoteValidationTestUtils.validateSwapTransaction(
        buildTransaction(calldata),
        buildNativeOutputContext(100n),
      );
    },
    /unexpected payment recipient/,
  );
});

test('swap validation rejects nested multicalls that exceed the depth cap', () => {
  // depth 0..4 are allowed; a 5th nesting level must fail
  let nested = encodeExactInput(100n);
  for (let index = 0; index < 5; index += 1) {
    nested = wrapInDeadlineMulticall([nested]);
  }

  assert.throws(
    () => {
      swapQuoteValidationTestUtils.validateSwapTransaction(
        buildTransaction(nested),
        buildContext(100n),
      );
    },
    /too deep/,
  );
});

test('swap validation rejects unsupported router selectors', () => {
  // exactOutputSingle is a real SwapRouter02 method, but not on our allowlist ABI
  const unsupportedIface = new ethers.Interface([
    'function exactOutputSingle(tuple(address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountOut,uint256 amountInMaximum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountIn)',
  ]);
  const unsupportedCall = unsupportedIface.encodeFunctionData('exactOutputSingle', [{
    tokenIn: WBTC_ADDRESS,
    tokenOut: PRANA_ADDRESS,
    fee: 10_000,
    recipient: OWNER_ADDRESS,
    amountOut: 1n,
    amountInMaximum: 100n,
    sqrtPriceLimitX96: 0n,
  }]) as HexAddress;
  const calldata = wrapInDeadlineMulticall([unsupportedCall]);

  assert.throws(
    () => {
      swapQuoteValidationTestUtils.validateSwapTransaction(
        buildTransaction(calldata),
        buildContext(100n),
      );
    },
    /unsupported router calldata/,
  );
});
