import type { HexAddress } from '../types/blockchain.types.ts';

/**
 * Operational wallets / treasuries used across Stats (capital, top holders, buy-dips)
 * and related loaders. One address → one canonical name.
 */

/** Founders / protocol treasury (Polygon + Arbitrum USDT capital rows). */
export const PRANA_PROTOCOL_ADDRESS: HexAddress =
  '0x696b00596F553FcF6F98EeBfD58F48d2645D7E1b';

/** Protocol reserve + Arbitrum WBTC/USDT LP NFT owner. */
export const PROTOCOL_RESERVE_ADDRESS: HexAddress =
  '0x917d8fc3938FDB924332ad3B4771B234E5F468DC';

/** Buy-the-dips operational wallet (Polygon USDT capital + explorer deep link). */
export const BUY_DIPS_WALLET_ADDRESS: HexAddress =
  '0x1d791aca381c844c4e497fca9429dbe5d36ff1bc';

/** Off-pool reserve for WBTC/PRANA DEX + bonding OTC. */
export const DEX_POOL_BONDS_RESERVE_ADDRESS: HexAddress =
  '0xA5e2CeDa8809c7E6e53Fd93d3A237b71C354626c';
