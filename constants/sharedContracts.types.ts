export type SharedContractAbiStateMutability = 'view' | 'pure' | 'nonpayable' | 'payable';

export interface SharedContractAbiParam {
  name?: string;
  type: string;
  indexed?: boolean;
}

export interface SharedContractAbiFunctionFragment {
  name: string;
  type: 'function';
  stateMutability: SharedContractAbiStateMutability;
  inputs: SharedContractAbiParam[];
  outputs: SharedContractAbiParam[];
}

export interface SharedContractAbiEventFragment {
  name: string;
  type: 'event';
  anonymous?: boolean;
  inputs: SharedContractAbiParam[];
}

export type SharedContractAbiFragment =
  | SharedContractAbiFunctionFragment
  | SharedContractAbiEventFragment;
