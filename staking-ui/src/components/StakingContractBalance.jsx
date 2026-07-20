import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { PRANA_TOKEN_ADDRESS, PRANA_TOKEN_ABI, STAKING_CONTRACT_ADDRESS } from '../constants/contracts';

function StakingContractBalance() {
  // Read the PRANA balance of the staking contract
  const { data: balance } = useReadContract({
    address: PRANA_TOKEN_ADDRESS,
    abi: PRANA_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [STAKING_CONTRACT_ADDRESS],
  });

  // Format the balance with 9 decimals (PRANA token decimals)
  const formattedBalance = balance ? formatUnits(balance, 9) : '0';

  return (
    <div className="balance-display">
      <h3>Protocol Total Value Staked</h3>
      <p>{parseFloat(formattedBalance).toLocaleString()} <span className="token-symbol">PRANA</span></p>
    </div>
  );
}

export default StakingContractBalance; 