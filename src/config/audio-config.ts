export interface AudioConfig {
  timeouts: {
    messageWait: number;
    connectResponse: number;
    transactionResponse: number;
    transactionConfirmation: number;
    cryptoUtilsTransaction: number;
  };
  buffers: {
    scriptProcessorSize: number;
    fftSize: number;
    sampleRate: number;
  };
  ggwave: {
    soundMarkerThreshold: number;
    volumeLevel: number;
    protocol: number;
  };
  chunking: {
    maxMessageSize: number;
    chunkSize: number;
    enabled: boolean;
  };
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  timeouts: {
    messageWait: 60000, // 60 seconds (increased from 10s)
    connectResponse: 45000, // 45 seconds (increased from 10s)
    transactionResponse: 120000, // 120 seconds (increased from 30s)
    transactionConfirmation: 60000, // 60 seconds
    cryptoUtilsTransaction: 300000, // 300 seconds
  },
  buffers: {
    scriptProcessorSize: 4096, // Increased from 1024 for better throughput
    fftSize: 4096, // Increased from 2048 for better frequency resolution
    sampleRate: 48000,
  },
  ggwave: {
    soundMarkerThreshold: 4,
    volumeLevel: 15,
    protocol: 1, // GGWAVE_PROTOCOL_AUDIBLE_FAST
  },
  chunking: {
    maxMessageSize: 8192, // 8KB threshold for chunking
    chunkSize: 2048, // 2KB chunks
    enabled: true,
  },
};

// EIP-compliant configuration for offline client
export const EIP_AUDIO_CONFIG: AudioConfig = {
  timeouts: {
    messageWait: 10000, // 10 seconds as specified in EIP
    connectResponse: 10000, // 10 seconds as specified in EIP
    transactionResponse: 30000, // 30 seconds for transaction processing
    transactionConfirmation: 60000, // 60 seconds
    cryptoUtilsTransaction: 300000, // 300 seconds
  },
  buffers: {
    scriptProcessorSize: 4096, // Keep larger buffer for reliability
    fftSize: 4096, // Keep larger FFT for better resolution
    sampleRate: 44100, // EIP specifies 44100 Hz (not 48000)
  },
  ggwave: {
    soundMarkerThreshold: 4,
    volumeLevel: 15, // Will be adjusted to 60% in the protocol implementation
    protocol: 1, // GGWAVE_PROTOCOL_AUDIBLE_FAST for compatibility with main client
  },
  chunking: {
    maxMessageSize: 4096, // Smaller chunks for EIP compliance
    chunkSize: 1024, // Smaller chunk size for reliability
    enabled: true,
  },
};

export function estimateTransmissionTime(messageLength: number): number {
  // Rough estimation: ~100 bytes per second for audio transmission
  const baseTime = Math.max(messageLength / 100, 5000); // Minimum 5 seconds
  const safetyMargin = 1.5; // 50% safety margin
  return Math.ceil(baseTime * safetyMargin);
}

export function getDynamicTimeout(messageLength: number, baseTimeout: number): number {
  const estimatedTime = estimateTransmissionTime(messageLength);
  return Math.max(baseTimeout, estimatedTime);
}

export function shouldChunkMessage(messageLength: number, config: AudioConfig = DEFAULT_AUDIO_CONFIG): boolean {
  return config.chunking.enabled && messageLength > config.chunking.maxMessageSize;
}