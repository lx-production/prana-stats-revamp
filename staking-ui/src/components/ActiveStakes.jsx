import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { STAKING_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI } from '../constants/contracts';
import useActiveStakes from '../hooks/useActiveStakes';
import { useInterestCalculator } from '../hooks/useInterestCalculator';

function ActiveStakes() {
  const { address, isConnected } = useAccount();
  
  // State
  const [stakes, setStakes] = useState([]);
  const [loading, setLoading] = useState(false); 
  
  // Fetch user's stakes
  const { data: stakesData, isLoading: isStakesLoading, refetch: refetchStakes } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_CONTRACT_ABI,
    functionName: 'getStakerStakes',
    args: [address],
    enabled: isConnected && !!address,
  });
  
  // Get staking actions from custom hook
  const {
    processedStakes,
    handleUnstake, 
    handleEarlyUnstake, 
    handleClaimInterest,
    calculateInterest,
    actionLoading,
    error,
    success
  } = useActiveStakes(stakesData, refetchStakes);
  
  // Get interest calculator functions
  const { calculateTotalGuaranteedInterest } = useInterestCalculator();
  
  // Process stakes data
  useEffect(() => {
    if (stakesData) {      
      setStakes(processedStakes);
    }
  }, [stakesData, processedStakes]);
  
  // Set loading state
  useEffect(() => {
    setLoading(isStakesLoading);
  }, [isStakesLoading]);
  
  if (!isConnected) return null;
  
  return (
    <div className="active-stakes-container">
      <h3>My Active Stakes</h3>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      {loading ? (
        <div className="loading-message">
          <span className="spinner">↻</span> Loading stakes...
        </div>
      ) : stakes.length === 0 ? (
        <p className="no-stakes-message">You do not have any active stakes yet. Hiện bạn không có stake nào.</p>
      ) : (
        <div className="stakes-list">
          {stakes.map((stake) => (
            <div key={stake.id} className="stake-card">
              <div className="stake-header">
                <div className="stake-id">Stake #{stake.id.toString()}</div>
                <div className={`stake-status ${stake.isExpired ? 'expired' : 'active'}`}>
                  {stake.isExpired ? 'Matured' : 'Active'}
                </div>
              </div>
              
              <div className="stake-details">
                <div className="stake-amount">
                  <strong>{stake.amountFormatted}</strong> PRANA
                </div>
                <div className="stake-apr">
                  <span className="apr-tag">{stake.apr}% APR</span>
                </div>
              </div>
              
              <div className="stake-duration">
                <div>Kỳ hạn: {stake.durationLabel}</div>
              </div>
              
              <div className="stake-dates">
                <div>Bắt đầu: {stake.startTimeFormatted}</div>
                <div>Kết thúc: {stake.endTimeFormatted}</div>
              </div>
              
              <div className="stake-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${stake.progress}%` }}
                  ></div>
                </div>
                <div className="progress-info">
                  <div className="progress-text">{stake.progress}% Đã hoàn thành</div>
                  <div className="interest-text">Tổng lãi suất đã tích lũy: <strong>≈ {calculateInterest(stake)}</strong> PRANA</div>
                  <div className="interest-text">Tổng lãi suất khi đáo hạn: <strong>≈ {calculateTotalGuaranteedInterest(stake)}</strong> PRANA</div>
                </div>
              </div>
              
              <div className="stake-actions">
                {stake.canClaimInterest && (
                  <button 
                    className="btn-secondary"
                    onClick={() => handleClaimInterest(stake.id)}
                    disabled={actionLoading.stakeId === stake.id}
                  >
                    {actionLoading.stakeId === stake.id && actionLoading.action === 'claimInterest' ? (
                      <><span className="spinner">↻</span>Processing...</>
                    ) : 'Claim Interest'}
                  </button>
                )}
                
                {stake.canUnstake && (
                  <button 
                    className="btn-secondary"
                    onClick={() => handleUnstake(stake.id)}
                    disabled={actionLoading.stakeId === stake.id}
                  >
                    {actionLoading.stakeId === stake.id && actionLoading.action === 'unstake' ? (
                      <><span className="spinner">↻</span>Processing...</>
                    ) : 'Unstake'}
                  </button>
                )}
                
                {stake.canUnstakeEarly && (
                  <button 
                    className="btn-danger"
                    onClick={() => handleEarlyUnstake(stake.id)}
                    disabled={actionLoading.stakeId === stake.id}
                    title="10% penalty applies for early unstaking"
                  >
                    {actionLoading.stakeId === stake.id && actionLoading.action === 'unstakeEarly' ? (
                      <><span className="spinner">↻</span>Processing...</>
                    ) : 'Unstake Early (10% penalty)'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ActiveStakes; 