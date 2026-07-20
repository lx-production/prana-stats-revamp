import { useState, useEffect } from 'react';
import { useWriteContract, useSignTypedData, usePublicClient, useChainId, useSwitchChain } from 'wagmi';
import { polygon } from 'wagmi/chains';
import { parseUnits } from 'viem';
import { PRANA_TOKEN_ADDRESS, PRANA_TOKEN_ABI, STAKING_CONTRACT_ADDRESS, STAKING_CONTRACT_ABI } from '../constants/contracts';

const useStaking = ({ 
  address, 
  amount, 
  durationIndex, 
  decimals,
  DURATION_OPTIONS,
  formattedMinStake,
  setAmount
}) => {
  // State
  const [permitSignature, setPermitSignature] = useState(null);
  const [transactionArgs, setTransactionArgs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { writeContractAsync, status } = useWriteContract();
  const { isPending: isSignPending, signTypedDataAsync } = useSignTypedData();
  // Always read token data (nonces, etc.) from Polygon since PRANA is deployed there.
  const publicClient = usePublicClient({ chainId: polygon.id });
  const activeChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  // Unified loading state
  useEffect(() => {
    setLoading(isSignPending || status === 'pending');
  }, [isSignPending, status]);

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

  // Handlers
  const handlePermit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    if (parseFloat(amount) < parseFloat(formattedMinStake)) {
      setError(`Minimum stake amount is ${formattedMinStake} PRANA`);
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Permit signatures must be signed on the same chainId as the EIP-712 domain.
      // If the wallet is on the wrong network, viem will throw "active chainId is different..."
      if (activeChainId !== polygon.id) {
        try {
          await switchChainAsync({ chainId: polygon.id });
        } catch {
          setError('Please switch your wallet network to Polygon Mainnet (chainId 137) and try again.');
          return;
        }
      }

      // Convert amount to wei
      const amountInWei = parseUnits(amount, decimals);
      
      // Current timestamp + 1 hour (in seconds)
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      // Get current nonce for the user
      const nonceResult = await publicClient.readContract({
        address: PRANA_TOKEN_ADDRESS,
        abi: PRANA_TOKEN_ABI,
        functionName: 'nonces',
        args: [address]
      });
      
      console.log('User nonce:', nonceResult.toString());
      
      // Prepare domain, types, and message for EIP-2612 permit
      const domain = {
        name: 'Prana_v2',
        version: '1',
        chainId: polygon.id, // Polygon Mainnet
        verifyingContract: PRANA_TOKEN_ADDRESS,
      };
      
      const types = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      };
      
      const message = {
        owner: address,
        spender: STAKING_CONTRACT_ADDRESS,
        value: amountInWei,
        nonce: nonceResult,
        deadline,
      };
      
      // Sign the permit message
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'Permit',
        message,
      });
      
      console.log('Signature received:', signature);
      
      // Process the signature into v, r, s components
      const r = '0x' + signature.slice(2, 66);
      const s = '0x' + signature.slice(66, 130);
      let v = parseInt(signature.slice(130, 132), 16);
      
      // Adjust v to Ethereum standard (27 or 28)
      if (v < 27) v += 27;
      
      // Construct transaction arguments
      const args = [
        amountInWei,
        Number(DURATION_OPTIONS[durationIndex].seconds),
        Number(deadline),
        v,
        r,
        s
      ];
      
      // Save permit data
      setPermitSignature({
        r, s, v, signature
      });
      
      // Set transaction arguments for staking
      setTransactionArgs(args);
      
      setSuccess('Permit signed successfully! You can now Stake! - Permit thành công! Bạn có thể stake PRANA ngay!');
    } catch (err) {
      console.error('Permit signing error:', err);
      if (err.message?.includes('User rejected') || 
          err.message?.includes('User denied') ||
          err.message?.includes('cancelled')) {
        setError('Signature request was rejected');
      } else {
        setError(`Failed to sign permit: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStake = async () => {
    if (!permitSignature || !transactionArgs) {
      setError('Please sign the permit first - Bạn cần ký permit trước');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Execute the transaction without overriding gas settings
      // Let MetaMask handle gas estimation for better compatibility
      const txHash = await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_CONTRACT_ABI,
        functionName: 'stakeWithPermit',
        args: transactionArgs
      });
      
      console.log('Transaction hash:', txHash);
      setSuccess(`Staking successful! Stake thành công! Transaction: ${txHash}`);
      
      // Reset form after successful stake
      setAmount('');
      setPermitSignature(null);
      setTransactionArgs(null);
    } catch (err) {
      console.error('Staking error:', err);
      
      let errorMsg = 'Failed to stake';
      
      if (err.message?.includes('execution reverted')) {
        const revertReason = err.message.match(/execution reverted: (.*?)(?:"|$)/);
        errorMsg = revertReason ? `Contract error: ${revertReason[1]}` : 'Transaction reverted';
      } else if (err.message?.includes('rejected')) {
        errorMsg = 'Transaction rejected by wallet';
      } else if (err.message?.includes('insufficient funds')) {
        errorMsg = 'Insufficient funds for transaction';
      } else if (err.message?.includes('extra fees')) {
        errorMsg = 'MetaMask rejected the transaction due to excessive fees. Try again.';
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return {
    permitSignature,
    transactionArgs,
    loading,
    error,
    success,
    isSignPending,
    status,
    handlePermit,
    handleStake
  };
};

export default useStaking; 