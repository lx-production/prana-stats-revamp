/**
 * Thin re-exports from the main app — single source of truth for addresses/ABIs.
 * Legacy staking-ui is removed entirely in step 7.
 */
export {
  PRANA_ADDRESS as PRANA_TOKEN_ADDRESS,
  PRANA_TOKEN_ABI,
} from '../../../constants/sharedContracts.ts'

export {
  STAKING_CONTRACT_ADDRESS,
  STAKING_CONTRACT_ABI,
  INTEREST_CONTRACT_ADDRESS,
} from '../../../constants/stakingContracts.ts'
