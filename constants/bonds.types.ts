export type BondAbiStateMutability = 'view' | 'pure' | 'nonpayable' | 'payable';

export interface BondAbiParam {
  internalType: string;
  name: string;
  type: string;
  components?: BondAbiParam[];
}

export interface BondAbiFunctionFragment {
  inputs: BondAbiParam[];
  name: string;
  outputs: BondAbiParam[];
  stateMutability: BondAbiStateMutability;
  type: 'function';
}
