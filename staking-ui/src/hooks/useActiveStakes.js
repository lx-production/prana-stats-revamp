import { useState, useEffect, useMemo } from 'react';
import { useWriteContract } from 'wagmi';
import { formatUnits } from 'viem';
import { STAKING_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI } from '../constants/contracts';
import { useInterestCalculator } from './useInterestCalculator';
import { DURATION_OPTIONS } from '../constants/durations';

/**
 * Custom hook for staking-related actions
 * @param {Array} stakesData - Raw stakes data from the contract
 * @param {function} refetchStakes - Function to refetch stakes after an action
 * @returns {object} - Contains action functions and states
 */
const useActiveStakes = (stakesData, refetchStakes) => {
  const { writeContractAsync } = useWriteContract();
  const [actionLoading, setActionLoading] = useState({ stakeId: null, action: null });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  const { calculateTotalGuaranteedInterest } = useInterestCalculator();
  
  // PRANA's decimals. Hardcoded to 9
  const decimals = 9;

  // Helper function to format timestamps to Vietnam time with 24h format
  const formatVietnamTime = (timestamp) => {
    // Create date from timestamp (multiply by 1000 to convert seconds to milliseconds)
    const date = new Date(Number(timestamp) * 1000);
    
    // Format for Vietnam timezone (UTC+7)
    return date.toLocaleString('en-GB', { 
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };
  
  // Update time every second to recalculate interest
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Process stakes data
  const processedStakes = useMemo(() => {
    if (!stakesData) return [];
    return stakesData.map((stake) => {
      const now = currentTime;
      const endTime = stake.startTime + stake.duration;
      const isExpired = now > endTime;
      const canUnstake = isExpired;
      const canUnstakeEarly = !isExpired;
      const canClaimInterest = true; // Always allow claiming interest

      // Find the corresponding duration option
      const durationOption = DURATION_OPTIONS.find(
        (option) => option.seconds === Number(stake.duration)
      ) || { label: `${Math.floor(Number(stake.duration) / 86400)} Days` };

      const totalGuaranteedInterest = calculateTotalGuaranteedInterest(stake);

      return {
        ...stake,
        amountFormatted: formatUnits(stake.amount, decimals),
        startTimeFormatted: formatVietnamTime(stake.startTime),
        endTimeFormatted: formatVietnamTime(endTime),
        durationLabel: durationOption.label,
        isExpired,
        canUnstake,
        canUnstakeEarly,
        canClaimInterest,
        progress: Math.min(
          100,
          Math.floor(((now - Number(stake.startTime)) / Number(stake.duration)) * 100)
        ),
        totalGuaranteedInterest: formatUnits(totalGuaranteedInterest, decimals),
      };
    });
  }, [stakesData, currentTime, calculateTotalGuaranteedInterest]);
  
  // Helper function to calculate interest
  const calculateInterest = (stake) => {
    const now = currentTime;
    const PERCENT_SCALE = 100; // Same as in the contract
    
    // Calculate time passed since the stake started
    // Cap the time at the end of the staking period
    const stakeEndTime = Number(stake.startTime) + Number(stake.duration);
    const effectiveTime = Math.min(now, stakeEndTime);
    const timePassed = effectiveTime - Number(stake.startTime);
    
    if (timePassed <= 0) return 0;
    
    // Calculate rate per second: (APR / PERCENT_SCALE) / (365 * 24 * 60 * 60)
    const ratePerSecond = (Number(stake.apr) * 1e18) / (PERCENT_SCALE * 365 * 24 * 60 * 60);
    
    // Calculate interest: principal * ratePerSecond * secondsPassed / 1e18
    const interest = (BigInt(stake.amount) * BigInt(Math.floor(ratePerSecond * timePassed))) / BigInt(1e18);
    
    return formatUnits(interest, decimals);
  };
  
  // Reset messages after 10 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Handle unstake
  const handleUnstake = async (stakeId) => {
    try {
      setActionLoading({ stakeId, action: 'unstake' });
      setError('');
      
      const txHash = await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_CONTRACT_ABI,
        functionName: 'unstake',
        args: [stakeId]
      });
      
      setSuccess(`Unstaked successfully! Unstake thành công! Transaction: ${txHash}`);
      refetchStakes();
    } catch (err) {
      console.error('Unstake error:', err);
      setError(`Failed to unstake: ${err.message}`);
    } finally {
      setActionLoading({ stakeId: null, action: null });
    }
  };
  
  // Handle early unstake
  const handleEarlyUnstake = async (stakeId) => {
    if (!window.confirm('Early unstaking incurs a 10% penalty. Are you sure you want to continue? Unstake sớm sẽ bị trừ 10% vốn gốc. Bạn có chắc chưa?')) {
      return;
    }
    
    try {
      setActionLoading({ stakeId, action: 'unstakeEarly' });
      setError('');
      
      const txHash = await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_CONTRACT_ABI,
        functionName: 'unstakeEarly',
        args: [stakeId]
      });
      
      setSuccess(`Unstaked early successfully! Transaction: ${txHash}`);
      refetchStakes();
    } catch (err) {
      console.error('Early unstake error:', err);
      setError(`Failed to unstake early: ${err.message}`);
    } finally {
      setActionLoading({ stakeId: null, action: null });
    }
  };
  
  // Handle claim interest
  const handleClaimInterest = async (stakeId) => {
    try {
      setActionLoading({ stakeId, action: 'claimInterest' });
      setError('');
      
      const txHash = await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_CONTRACT_ABI,
        functionName: 'claimInterest',
        args: [stakeId]
      });
      
      setSuccess(`Claim interest transaction ${txHash} đã được gửi thành công.`);
      refetchStakes();
    } catch (err) {
      console.error('Claim interest error:', err);
      setError(`Failed to claim interest: ${err.message}`);
    } finally {
      setActionLoading({ stakeId: null, action: null });
    }
  };

  return {
    processedStakes,
    handleUnstake,
    handleEarlyUnstake,
    handleClaimInterest,
    calculateInterest,
    calculateTotalGuaranteedInterest,
    currentTime,
    actionLoading,
    error,
    success,
    setError,
    setSuccess
  };
};

export default useActiveStakes; 