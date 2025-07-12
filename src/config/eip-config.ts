export interface EIPConfig {
  version: string;
  timeouts: {
    messageWait: number;
    connectResponse: number;
    transactionResponse: number;
    retryDelay: number;
  };
  audio: {
    sampleRate: number;
    protocol: string;
    volumeLevel: number;
    bufferSize: number;
    fftSize: number;
  };
  security: {
    requireUserConfirmation: boolean;
    maxTransactionValue: string;
    supportedChainIds: number[];
  };
}

export const EIP_PROTOCOL_VERSION = "1.0";

export const DEFAULT_EIP_CONFIG: EIPConfig = {
  version: EIP_PROTOCOL_VERSION,
  timeouts: {
    messageWait: 10000, // 10 seconds as specified in EIP
    connectResponse: 10000, // 10 seconds as specified in EIP
    transactionResponse: 30000, // 30 seconds for transaction signing
    retryDelay: 1000, // 1 second between retries
  },
  audio: {
    sampleRate: 44100, // EIP specifies 44100 Hz (not 48000)
    protocol: "Normal", // ggwave "Normal" protocol for audible frequencies
    volumeLevel: 60, // 60% volume (EIP recommends 50-70%)
    bufferSize: 4096, // Keep larger buffer for reliability
    fftSize: 4096, // Keep larger FFT for better resolution
  },
  security: {
    requireUserConfirmation: true, // EIP security requirement
    maxTransactionValue: "1000000000000000000", // 1 ETH max for test
    supportedChainIds: [1, 5, 11155111], // Mainnet, Goerli, Sepolia
  },
};

export interface EIPMessage {
  version: string;
  type: 'connect' | 'connect_response' | 'tx_request' | 'tx_response' | 'ack' | 'error' | 'chunk';
  payload: any;
  id: string;
}

export interface ConnectPayload {
  // Empty object for connect requests
}

export interface ConnectResponsePayload {
  address: string;
  received_id: string;
}

export interface TransactionRequestPayload {
  transaction: {
    chainId: number;
    nonce: string;
    gasPrice: string;
    gasLimit: string;
    to: string;
    value: string;
    data: string;
  };
}

export interface TransactionResponsePayload {
  signedTransaction: {
    raw: string;
    hash: string;
  };
}

export interface AckPayload {
  received_id: string;
}

export interface ErrorPayload {
  message: string;
  received_id?: string;
}

export function createEIPMessage(
  type: EIPMessage['type'],
  payload: any,
  id?: string
): EIPMessage {
  return {
    version: EIP_PROTOCOL_VERSION,
    type,
    payload,
    id: id || crypto.randomUUID(),
  };
}

export function validateEIPMessage(message: any): message is EIPMessage {
  return (
    typeof message === 'object' &&
    typeof message.version === 'string' &&
    typeof message.type === 'string' &&
    ['connect', 'connect_response', 'tx_request', 'tx_response', 'ack', 'error', 'chunk'].includes(message.type) &&
    typeof message.payload === 'object' &&
    typeof message.id === 'string'
  );
}

export function isVersionSupported(version: string): boolean {
  // For now, only support version 1.0
  return version === EIP_PROTOCOL_VERSION;
}