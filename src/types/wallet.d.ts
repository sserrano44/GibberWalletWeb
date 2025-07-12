export interface WalletConfig {
  rpcUrl: string;
  chainId: number;
  chainName: string;
}

export interface TransactionRequest {
  from: string;
  to: string;
  value: string;
  data?: string;
  gasPrice?: string;
  gasLimit?: string;
  nonce?: number;
}

export interface TransactionResponse {
  hash: string;
  success: boolean;
  error?: string;
}

export interface AudioStatus {
  isListening: boolean;
  isTransmitting: boolean;
  level: number;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  chainId?: number;
  blockNumber?: number;
  error?: string;
}

export type TransactionType = 'eth' | 'erc20';

export interface ERC20TransferParams {
  tokenAddress: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  amount: string;
}