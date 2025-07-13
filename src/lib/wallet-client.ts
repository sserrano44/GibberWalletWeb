import { EventEmitter } from 'events';
import { EIPAudioProtocol } from './eip-audio-protocol';
import { EIPMessage, createEIPMessage, validateEIPMessage } from '@/config/eip-config';
import { CryptoUtils } from './crypto-utils';
import { WalletConfig, TransactionRequest, TransactionResponse, ConnectionStatus, AudioStatus } from '@/types/wallet';
import { EIP_AUDIO_CONFIG } from '@/config/audio-config';

export interface WalletClientEvents {
  'connectionChanged': (status: ConnectionStatus) => void;
  'audioChanged': (status: AudioStatus) => void;
  'transactionSent': (txHash: string) => void;
  'transactionConfirmed': (receipt: any) => void;
  'error': (error: Error) => void;
}

export class WalletClient extends EventEmitter {
  private audio: EIPAudioProtocol;
  private crypto: CryptoUtils;
  private config: WalletConfig | null = null;
  private connectionStatus: ConnectionStatus = { connected: false };
  private audioStatus: AudioStatus = { isListening: false, isTransmitting: false, level: 0 };
  private walletAddress: string | null = null;

  constructor() {
    super();
    this.audio = new EIPAudioProtocol();
    this.crypto = new CryptoUtils();
    
    // Set up audio event listeners
    this.audio.on('eip-message', this.handleEIPMessage.bind(this));
    this.audio.on('listening', this.handleListeningChange.bind(this));
    this.audio.on('transmitting', this.handleTransmittingChange.bind(this));
    this.audio.on('audioLevel', this.handleAudioLevel.bind(this));
    this.audio.on('error', this.handleAudioError.bind(this));
  }

  /**
   * Initialize wallet with configuration
   */
  async initialize(config: WalletConfig): Promise<boolean> {
    try {
      this.config = config;
      this.crypto.setProvider(config.rpcUrl);
      
      // Test connection
      const provider = this.crypto.getProvider();
      if (provider) {
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        
        this.connectionStatus = {
          connected: true,
          chainId: Number(network.chainId),
          blockNumber: blockNumber
        };
        
        console.log(`Connected to ${config.chainName} (Chain ID: ${network.chainId})`);
        console.log(`Latest block: ${blockNumber}`);
      }
      
      // Initialize audio
      const audioInitialized = await this.audio.initialize();
      if (!audioInitialized) {
        throw new Error('Failed to initialize audio');
      }
      
      this.emit('connectionChanged', this.connectionStatus);
      return true;
      
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      this.connectionStatus = { 
        connected: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
      this.emit('connectionChanged', this.connectionStatus);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Start listening for audio messages
   */
  async startListening(): Promise<boolean> {
    return await this.audio.startListening();
  }

  /**
   * Stop listening for audio messages
   */
  stopListening(): void {
    this.audio.stopListening();
  }

  /**
   * Connect to offline wallet and get address
   */
  async connectToOfflineWallet(): Promise<string | null> {
    try {
      // Make sure audio is initialized
      if (!await this.audio.initialize()) {
        throw new Error('Failed to initialize audio');
      }

      // Start listening for responses
      if (!await this.startListening()) {
        throw new Error('Failed to start listening');
      }

      console.log('Sending connect to offline wallet...');
      const connect = createEIPMessage('connect', {});
      
      if (!await this.audio.sendEIPMessage(connect)) {
        throw new Error('Failed to send connect message');
      }

      console.log('Waiting for connect response...');
      const connectResponse = await this.audio.waitForEIPMessage('connect_response', EIP_AUDIO_CONFIG.timeouts.connectResponse);
      
      if (!connectResponse) {
        throw new Error('No connect response received from offline wallet');
      }

      // Store wallet address from connect response
      if (connectResponse.payload && connectResponse.payload.address) {
        this.walletAddress = connectResponse.payload.address;
        console.log('Connected to wallet:', this.walletAddress);
        
        // Emit connection status update with wallet address
        this.connectionStatus = {
          ...this.connectionStatus,
          walletAddress: this.walletAddress || undefined
        };
        this.emit('connectionChanged', this.connectionStatus);
        
        return this.walletAddress;
      }

      return null;
    } catch (error) {
      console.error('Failed to connect to offline wallet:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Send ETH transfer transaction
   */
  async sendEthTransfer(request: TransactionRequest): Promise<TransactionResponse> {
    try {
      if (!this.config || !this.crypto.getProvider()) {
        throw new Error('Wallet not initialized');
      }

      console.log(`Preparing ETH transfer: ${CryptoUtils.weiToEth(request.value)} ETH to ${request.to}`);

      // Get transaction parameters
      const nonce = await this.crypto.getNonce(request.from);
      const gasPrice = request.gasPrice ? BigInt(request.gasPrice) : await this.crypto.getGasPrice();
      const gasLimit = request.gasLimit ? BigInt(request.gasLimit) : BigInt(21000);

      console.log(`Nonce: ${nonce}, Gas Price: ${gasPrice}, Gas Limit: ${gasLimit}`);

      // Create EIP transaction request message
      const txRequest = createEIPMessage('tx_request', {
        transaction: {
          chainId: this.config.chainId,
          nonce: `0x${nonce.toString(16)}`,
          gasPrice: `0x${gasPrice.toString(16)}`,
          gasLimit: `0x${gasLimit.toString(16)}`,
          to: request.to,
          value: `0x${BigInt(request.value).toString(16)}`,
          data: request.data || '0x'
        }
      });

      // Send transaction via audio protocol
      return await this.sendTransactionRequest(txRequest);

    } catch (error) {
      console.error('ETH transfer failed:', error);
      return {
        hash: '',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Send ERC-20 transfer transaction
   */
  async sendErc20Transfer(request: TransactionRequest & { tokenAddress: string; amount: string }): Promise<TransactionResponse> {
    try {
      if (!this.config || !this.crypto.getProvider()) {
        throw new Error('Wallet not initialized');
      }

      console.log(`Preparing ERC-20 transfer: ${request.amount} tokens to ${request.to}`);

      // Get transaction parameters
      const nonce = await this.crypto.getNonce(request.from);
      const gasPrice = request.gasPrice ? BigInt(request.gasPrice) : await this.crypto.getGasPrice();
      const gasLimit = request.gasLimit ? BigInt(request.gasLimit) : BigInt(100000);

      // Create ERC-20 transaction
      const transaction = this.crypto.createErc20Transaction(
        request.tokenAddress,
        request.to,
        request.amount,
        nonce,
        gasPrice,
        gasLimit,
        this.config.chainId
      );

      // Create EIP transaction request message
      const txRequest = createEIPMessage('tx_request', {
        transaction: {
          chainId: this.config.chainId,
          nonce: `0x${transaction.nonce.toString(16)}`,
          gasPrice: `0x${transaction.gasPrice.toString(16)}`,
          gasLimit: `0x${transaction.gasLimit.toString(16)}`,
          to: transaction.to,
          value: `0x${transaction.value.toString(16)}`,
          data: transaction.data || '0x'
        }
      });

      // Send transaction via audio protocol
      return await this.sendTransactionRequest(txRequest);

    } catch (error) {
      console.error('ERC-20 transfer failed:', error);
      return {
        hash: '',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Send transaction request via audio protocol
   */
  private async sendTransactionRequest(txRequest: EIPMessage): Promise<TransactionResponse> {
    try {
      // Step 1: Send connect and wait for connect_response
      console.log('Sending connect to offline wallet...');
      const connect = createEIPMessage('connect', {});
      
      if (!await this.audio.sendEIPMessage(connect)) {
        throw new Error('Failed to send connect');
      }

      console.log('Waiting for connect response...');
      const connectResponse = await this.audio.waitForEIPMessage('connect_response', EIP_AUDIO_CONFIG.timeouts.connectResponse);
      
      if (!connectResponse) {
        throw new Error('No connect response received from offline wallet');
      }

      // Store wallet address from connect response
      if (connectResponse.payload && connectResponse.payload.address) {
        this.walletAddress = connectResponse.payload.address;
        console.log('Connected to wallet:', this.walletAddress);
      }

      console.log('Connect response received, sending transaction request...');

      // Step 2: Send transaction request
      if (!await this.audio.sendEIPMessage(txRequest)) {
        throw new Error('Failed to send transaction request');
      }

      console.log('Waiting for signed transaction...');

      // Step 3: Wait for signed transaction response
      const txRequestJson = JSON.stringify(txRequest);
      const dynamicTimeout = Math.max(EIP_AUDIO_CONFIG.timeouts.transactionResponse, txRequestJson.length * 100); // Rough estimate
      const response = await this.audio.waitForEIPMessage('tx_response', dynamicTimeout);
      
      if (!response) {
        throw new Error('No transaction response received');
      }

      if (!response.payload || !response.payload.signedTransaction || !response.payload.signedTransaction.raw) {
        throw new Error('Invalid transaction response');
      }

      console.log('Signed transaction received, broadcasting...');

      // Step 4: Broadcast signed transaction
      const signedTx = response.payload.signedTransaction.raw;
      const txHash = await this.crypto.broadcastTransaction(signedTx);

      console.log(`Transaction broadcasted successfully: ${txHash}`);
      this.emit('transactionSent', txHash);

      // Step 5: Wait for confirmation (optional)
      try {
        const receipt = await this.crypto.waitForTransaction(txHash, EIP_AUDIO_CONFIG.timeouts.transactionConfirmation);
        if (receipt) {
          console.log('Transaction confirmed:', receipt);
          this.emit('transactionConfirmed', receipt);
        }
      } catch (confirmError) {
        console.warn('Failed to wait for confirmation:', confirmError);
        // Don't fail the whole transaction for confirmation timeout
      }

      return {
        hash: txHash,
        success: true
      };

    } catch (error) {
      console.error('Transaction request failed:', error);
      return {
        hash: '',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get account balance
   */
  async getBalance(address: string): Promise<string> {
    return await this.crypto.getBalance(address);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get current audio status
   */
  getAudioStatus(): AudioStatus {
    return this.audioStatus;
  }

  /**
   * Get connected wallet address
   */
  getWalletAddress(): string | null {
    return this.walletAddress;
  }

  /**
   * Handle received EIP audio messages
   */
  private handleEIPMessage(message: EIPMessage): void {
    console.log('Received EIP message:', message.type, message.id);
    
    switch (message.type) {
      case 'connect':
        // Ignore connect messages - we're the online client sending them
        console.log('Ignoring connect message (we are the sender)');
        break;
      case 'connect_response':
        console.log('Connect response received from offline wallet');
        if (message.payload && message.payload.address) {
          this.walletAddress = message.payload.address;
          console.log('Wallet address:', this.walletAddress);
          // Emit connection status update with wallet address
          this.connectionStatus = {
            ...this.connectionStatus,
            walletAddress: this.walletAddress || undefined
          };
          this.emit('connectionChanged', this.connectionStatus);
        }
        break;
      case 'tx_response':
        console.log('Transaction response received');
        break;
      case 'error':
        console.error('Error from offline wallet:', message.payload.message);
        this.emit('error', new Error(message.payload.message));
        break;
      case 'chunk':
        // Chunks are handled automatically by the EIP audio protocol
        console.log('Received chunk message (handled by protocol)');
        break;
      default:
        console.log('Unknown EIP message type:', message.type);
    }
  }

  /**
   * Handle audio listening state changes
   */
  private handleListeningChange(isListening: boolean): void {
    this.audioStatus.isListening = isListening;
    this.emit('audioChanged', this.audioStatus);
  }

  /**
   * Handle audio transmitting state changes
   */
  private handleTransmittingChange(isTransmitting: boolean): void {
    this.audioStatus.isTransmitting = isTransmitting;
    this.emit('audioChanged', this.audioStatus);
  }

  /**
   * Handle audio level changes
   */
  private handleAudioLevel(level: number): void {
    this.audioStatus.level = level;
    this.emit('audioChanged', this.audioStatus);
  }

  /**
   * Handle audio errors
   */
  private handleAudioError(error: Error): void {
    this.audioStatus.error = error.message;
    this.emit('audioChanged', this.audioStatus);
    this.emit('error', error);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.audio.destroy();
    this.removeAllListeners();
  }
}