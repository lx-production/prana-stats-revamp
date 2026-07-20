import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { STAKING_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI } from '../constants/contracts';
import { DURATION_OPTIONS } from '../constants/durations';
import DurationSlider from './DurationSlider';
import useStaking from '../hooks/useStaking';
import { useInterestCalculator } from '../hooks/useInterestCalculator';

const StakingForm = () => {
  const { address, isConnected } = useAccount();

  // State
  const [amount, setAmount] = useState('');
  const [durationIndex, setDurationIndex] = useState(2); // Default: 30 days
  const [aprs, setAprs] = useState({});
  
  // Hardcoded decimals value instead of fetching from blockchain
  const decimals = 9;
  
  // Use interest calculator
  const { calculateTotalGuaranteedInterest } = useInterestCalculator();

  // Data fetching
  const { data: minStake } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_CONTRACT_ABI,
    functionName: 'MIN_STAKE',
    enabled: isConnected,
  });
  
  // Fetch all APRs at once
  const { data: allAprsData } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_CONTRACT_ABI,
    functionName: 'getAllAPRs',
    enabled: isConnected,
  });
  
  // Process APR data when it's available
  useEffect(() => {
    if (allAprsData) {
      const [durations, aprValues] = allAprsData;
      const aprMap = {};
      
      // Map each duration to its corresponding APR
      for (let i = 0; i < durations.length; i++) {
        aprMap[durations[i].toString()] = aprValues[i];
      }
      
      setAprs(aprMap);
    }
  }, [allAprsData]);

  const formattedMinStake = minStake ? formatUnits(minStake, decimals) : '100';

  // Use the staking hook
  const {
    permitSignature,
    loading,
    error,
    success,
    isSignPending,
    status,
    handlePermit,
    handleStake
  } = useStaking({
    address,
    amount,
    durationIndex,
    decimals,
    DURATION_OPTIONS,
    formattedMinStake,
    setAmount
  });

  // Function to calculate the projected interest based on current inputs
  const getProjectedInterest = () => {
    // If amount is empty or not a valid number, return "0"
    if (!amount || isNaN(parseFloat(amount))) return "0";
    
    // Get the selected duration option
    const selectedDuration = DURATION_OPTIONS[durationIndex];
    
    // Check if we have APR data for this duration
    const apr = aprs[selectedDuration.seconds.toString()];
    if (!apr) return "0";
    
    // Create a mock stake object with current input values
    const mockStake = {
      amount: (parseFloat(amount) * 10**decimals).toString(), // Convert to wei format
      duration: selectedDuration.seconds.toString(),
      apr: apr.toString(),
      startTime: Math.floor(Date.now() / 1000).toString()
    };
    
    return calculateTotalGuaranteedInterest(mockStake);
  };

  // Render
  if (!isConnected) return null;
  
  return (
    <div className="staking-form" key="staking-form">
      <h3>Stake PRANA</h3>
      
      <div className="form-group stake-amount-group">
        <div className="stake-input-section">
          <label htmlFor="stake-amount">Amount</label>
          <input
            id="stake-amount"
            type="text"
            value={amount}
            onChange={(e) => {
              // Only allow numbers and decimal points
              const value = e.target.value;
              if (value === '' || /^[0-9]*[.]?[0-9]*$/.test(value)) {
                // Check if the value is within the max limit
                const numValue = parseFloat(value);
                if (value === '' || (numValue <= 10000000)) {
                  setAmount(value);
                }
              }
            }}
            placeholder={`Min: ${formattedMinStake} | Max: 10,000,000`}
            disabled={loading}
            className="form-input"
          />
        </div>
        <div className="stake-interest-preview">
          <div className="preview-label">Guaranteed expected interest</div>
          <div className="preview-amount">
            <strong>≈ {getProjectedInterest()}</strong>
            <span className="token-symbol">PRANA</span>
          </div>
          <div className="preview-subtitle">Tổng lãi suất dự kiến khi đáo hạn</div>
        </div>
      </div>

      <div className="form-group">
        <div id="duration-label" className="form-label">Chọn kỳ hạn</div>
        <DurationSlider
          durationIndex={durationIndex}
          setDurationIndex={setDurationIndex}
          durationOptions={DURATION_OPTIONS}
          aprs={aprs}
          disabled={loading || !!permitSignature}
          labelId="duration-label"
        />
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="action-buttons">
        <button 
          className="btn-primary"
          onClick={handlePermit} 
          disabled={loading || !amount || !!permitSignature}
        >
          {loading && isSignPending ? (
            <><span className="spinner">↻</span>Signing...</>
          ) : (
            permitSignature ? 'Permit Signed ✓' : 'Sign Permit (off-chain)'
          )}
        </button>
        
        <button 
          className="btn-secondary"
          onClick={handleStake} 
          disabled={loading || !permitSignature}
        >
          {loading && status === 'pending' ? (
            <><span className="spinner">↻</span>Staking...</>
          ) : 'Stake PRANA'}
        </button>
      </div>
    </div>
  );
};

export default StakingForm; 