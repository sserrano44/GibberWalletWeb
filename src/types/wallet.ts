export interface WalletConfig {
  rpcUrl: string;
  chainId: number;
  chainName: string;
}

export interface TransactionRequest {
  from: string;
  to: string;
  value: string;
  gasPrice?: string;
  gasLimit?: string;
  data?: string;
}

export interface TransactionResponse {
  hash: string;
  success: boolean;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  chainId?: number;
  blockNumber?: number;
  walletAddress?: string;
  error?: string;
}

export interface AudioStatus {
  isListening: boolean;
  isTransmitting: boolean;
  level: number;
  error?: string;
}