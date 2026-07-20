import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { INTEREST_CONTRACT_ADDRESS, PRANA_TOKEN_ADDRESS, PRANA_TOKEN_ABI, STAKING_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI } from '../constants/contracts';

function InterestContractBalance() {
  // Read the PRANA balance of the interest contract
  const { data: balance } = useReadContract({
    address: PRANA_TOKEN_ADDRESS,
    abi: PRANA_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [INTEREST_CONTRACT_ADDRESS],
  });

  // Read the total interest needed
  const { data: totalInterestNeeded } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_CONTRACT_ABI,
    functionName: 'totalInterestNeeded',
  });

  const decimals = 9;

  // Format the balances with 9 decimals (PRANA token decimals)
  const formattedBalance = balance ? formatUnits(balance, decimals) : '0';
  const formattedInterestNeeded = totalInterestNeeded ? formatUnits(totalInterestNeeded, decimals) : '0';

  return (
    <div className="balance-display">
      <h3>Interest Contract Balance</h3>
      <p>{parseFloat(formattedBalance).toLocaleString()} <span className="token-symbol">PRANA</span></p>
      <h5>Committed Interest</h5>
      <p>{parseFloat(formattedInterestNeeded).toLocaleString()} <span className="token-symbol">PRANA</span></p>
    </div>
  );
}

export default InterestContractBalance; 