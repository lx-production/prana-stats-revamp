import { formatUnits } from 'viem';

/**
 * Hook for interest calculation utilities
 * @returns {object} - Contains interest calculation functions
 */
export const useInterestCalculator = () => {
  // PRANA's decimals. Hardcoded to 9
  const decimals = 9;
  
  /**
   * Calculate the total guaranteed fixed interest at maturity for a stake
   * @param {object} stake - The stake object
   * @returns {string} - The formatted total guaranteed interest
   */
  const calculateTotalGuaranteedInterest = (stake) => {
    const PERCENT_SCALE = 100; // Same as in the contract
    
    // Calculate total duration in seconds
    const totalDuration = Number(stake.duration);
    
    // Calculate rate per second: (APR / PERCENT_SCALE) / (365 * 24 * 60 * 60)
    const ratePerSecond = (Number(stake.apr) * 1e18) / (PERCENT_SCALE * 365 * 24 * 60 * 60);
    
    // Calculate total interest at maturity: principal * ratePerSecond * totalDuration / 1e18
    const totalInterest = (BigInt(stake.amount) * BigInt(Math.floor(ratePerSecond * totalDuration))) / BigInt(1e18);
    
    return formatUnits(totalInterest, decimals);
  };
  
  return {
    calculateTotalGuaranteedInterest,
    decimals
  };
}; 