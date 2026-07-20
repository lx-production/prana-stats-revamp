import type { Address, Hex } from 'viem';

/** 20-byte Ethereum address (`0x` + 40 hex chars). */
export type { Address };

/** Arbitrary hex blob: calldata, tx hash, signature r/s, etc. */
export type { Hex };

/**
 * Address alias kept for existing swap/call sites.
 * Prefer `Address` for new code; use `Hex` for non-address hex data.
 */
export type HexAddress = Address;
