type StakingContractAbi = string[];

// Staking Contract
export const STAKING_CONTRACT_ADDRESS = '0x714425A4F4d624ef83fEff810a0EEC30B0847868'; // Replace with actual contract address

// Interest Contract
export const INTEREST_CONTRACT_ADDRESS = '0x1DE1E9BEF781fb3440C2c22E8ca1bF61BD26f69d'; // Replace with actual contract address

// Staking Contract ABI
export const STAKING_CONTRACT_ABI: StakingContractAbi = [
  'function totalInterestNeeded() view returns (uint256)',
  'function getStakers() view returns (address[])',
  'function getStakerStakes(address staker) view returns (tuple(uint32 id,uint256 amount,uint256 startTime,uint256 duration,uint8 apr,uint256 lastClaimTime)[])',
];
