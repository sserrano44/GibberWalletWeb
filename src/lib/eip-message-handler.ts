import { EventEmitter } from 'events';
import { EIPAudioProtocol } from './eip-audio-protocol';
import { TestWallet } from './test-wallet';
import {
  EIPMessage,
  createEIPMessage,
  ConnectPayload,
  ConnectResponsePayload,
  TransactionRequestPayload,
  TransactionResponsePayload,
  ErrorPayload,
  EIP_PROTOCOL_VERSION
} from '@/config/eip-config';

export interface EIPMessageHandlerEvents {
  'connect-request': (message: EIPMessage) => void;
  'transaction-request': (message: EIPMessage, details: any) => void;
  'transaction-approved': (txHash: string) => void;
  'transaction-rejected': (reason: string) => void;
  'error': (error: Error) => void;
  'connection-established': (address: string) => void;
}

export interface PendingTransaction {
  message: EIPMessage;
  details: any;
  timestamp: number;
}

export class EIPMessageHandler extends EventEmitter {
  private audioProtocol: EIPAudioProtocol;
  private testWallet: TestWallet;
  private pendingTransactions: Map<string, PendingTransaction> = new Map();
  private isInitialized = false;

  constructor() {
    super();
    this.audioProtocol = new EIPAudioProtocol();
    this.testWallet = new TestWallet(); // Use default deterministic test wallet
    
    this.setupEventListeners();
  }

  /**
   * Initialize the message handler
   */
  async initialize(): Promise<boolean> {
    try {
      const success = await this.audioProtocol.initialize();
      if (success) {
        this.isInitialized = true;
        console.log('EIP Message Handler initialized with wallet:', this.testWallet.getAddress());
      }
      return success;
    } catch (error) {
      console.error('Failed to initialize EIP Message Handler:', error);
      return false;
    }
  }

  /**
   * Start listening for EIP messages
   */
  async startListening(): Promise<boolean> {
    if (!this.isInitialized && !await this.initialize()) {
      return false;
    }
    
    return await this.audioProtocol.startListening();
  }

  /**
   * Stop listening for EIP messages
   */
  stopListening(): void {
    this.audioProtocol.stopListening();
  }

  /**
   * Set up event listeners for the audio protocol
   */
  private setupEventListeners(): void {
    // Handle incoming EIP messages
    this.audioProtocol.on('eip-message', (message: EIPMessage) => {
      this.handleEIPMessage(message);
    });

    // Forward audio protocol events
    this.audioProtocol.on('listening', (isListening) => {
      this.emit('listening', isListening);
    });

    this.audioProtocol.on('transmitting', (isTransmitting) => {
      this.emit('transmitting', isTransmitting);
    });

    this.audioProtocol.on('audioLevel', (level) => {
      this.emit('audioLevel', level);
    });

    this.audioProtocol.on('error', (error) => {
      this.emit('error', error);
    });

    this.audioProtocol.on('version-mismatch', (receivedVersion, supportedVersion) => {
      console.warn(`Version mismatch: received ${receivedVersion}, supported ${supportedVersion}`);
      this.emit('error', new Error(`Unsupported protocol version: ${receivedVersion}`));
    });
  }

  /**
   * Handle incoming EIP messages based on type
   */
  private async handleEIPMessage(message: EIPMessage): Promise<void> {
    console.log('Handling EIP message:', message.type, message.id);

    try {
      switch (message.type) {
        case 'connect':
          await this.handleConnectRequest(message);
          break;
          
        case 'tx_request':
          await this.handleTransactionRequest(message);
          break;
          
        case 'ack':
          console.log('Received acknowledgment for message:', message.payload.received_id);
          break;
          
        case 'error':
          console.error('Received error message:', message.payload.message);
          this.emit('error', new Error(message.payload.message));
          break;
          
        default:
          console.warn('Unknown EIP message type:', message.type);
          await this.sendErrorResponse(message.id, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling EIP message:', error);
      await this.sendErrorResponse(message.id, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Handle connect request and send wallet address response
   */
  private async handleConnectRequest(message: EIPMessage): Promise<void> {
    console.log('Processing connect request from online device...');
    
    this.emit('connect-request', message);
    
    // Create connect response with wallet address
    const responsePayload: ConnectResponsePayload = {
      address: this.testWallet.getAddress(),
      received_id: message.id
    };
    
    // Add a small delay before responding to ensure the online client is ready to receive
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const response = createEIPMessage('connect_response', responsePayload);
    
    const success = await this.audioProtocol.sendEIPMessage(response);
    if (success) {
      console.log('Sent connect response with address:', responsePayload.address);
      this.emit('connection-established', responsePayload.address);
    } else {
      throw new Error('Failed to send connect response');
    }
  }

  /**
   * Handle transaction request and prepare for user approval
   */
  private async handleTransactionRequest(message: EIPMessage): Promise<void> {
    console.log('Processing transaction request...');
    
    const txRequest = message.payload as TransactionRequestPayload;
    
    // Validate transaction request
    this.validateTransactionRequest(txRequest);
    
    // Get transaction details for display
    const details = this.testWallet.getTransactionDetails(txRequest);
    
    // Store pending transaction
    const pendingTx: PendingTransaction = {
      message,
      details,
      timestamp: Date.now()
    };
    
    this.pendingTransactions.set(message.id, pendingTx);
    
    console.log('Transaction details:', details);
    
    // Emit event for UI to show transaction approval dialog
    this.emit('transaction-request', message, details);
  }

  /**
   * Approve and sign a pending transaction
   */
  async approveTransaction(messageId: string): Promise<boolean> {
    const pendingTx = this.pendingTransactions.get(messageId);
    if (!pendingTx) {
      throw new Error('Transaction not found or already processed');
    }

    try {
      console.log('User approved transaction, signing...');
      
      const txRequest = pendingTx.message.payload as TransactionRequestPayload;
      
      // Sign the transaction
      const signedResult = await this.testWallet.signTransaction(txRequest);
      
      // Create transaction response
      const responsePayload: TransactionResponsePayload = {
        signedTransaction: {
          raw: signedResult.raw,
          hash: signedResult.hash
        }
      };
      
      const response = createEIPMessage('tx_response', responsePayload, pendingTx.message.id);
      
      // Send the signed transaction
      const success = await this.audioProtocol.sendEIPMessage(response);
      
      if (success) {
        console.log('Sent signed transaction:', signedResult.hash);
        this.pendingTransactions.delete(messageId);
        this.emit('transaction-approved', signedResult.hash);
        return true;
      } else {
        throw new Error('Failed to send signed transaction');
      }
      
    } catch (error) {
      console.error('Failed to approve transaction:', error);
      await this.sendErrorResponse(pendingTx.message.id, error instanceof Error ? error.message : String(error));
      this.pendingTransactions.delete(messageId);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Reject a pending transaction
   */
  async rejectTransaction(messageId: string, reason: string = 'User rejected'): Promise<boolean> {
    const pendingTx = this.pendingTransactions.get(messageId);
    if (!pendingTx) {
      throw new Error('Transaction not found or already processed');
    }

    try {
      console.log('User rejected transaction:', reason);
      
      // Send error response
      await this.sendErrorResponse(pendingTx.message.id, `Transaction rejected: ${reason}`);
      
      this.pendingTransactions.delete(messageId);
      this.emit('transaction-rejected', reason);
      return true;
      
    } catch (error) {
      console.error('Failed to reject transaction:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Send error response message
   */
  private async sendErrorResponse(originalMessageId: string, errorMessage: string): Promise<void> {
    const errorPayload: ErrorPayload = {
      message: errorMessage,
      received_id: originalMessageId
    };
    
    const errorResponse = createEIPMessage('error', errorPayload);
    await this.audioProtocol.sendEIPMessage(errorResponse);
  }

  /**
   * Validate transaction request payload
   */
  private validateTransactionRequest(txRequest: TransactionRequestPayload): void {
    if (!txRequest.transaction) {
      throw new Error('Missing transaction data in request');
    }

    const { transaction } = txRequest;
    const required = ['chainId', 'nonce', 'gasPrice', 'gasLimit', 'to', 'value', 'data'];
    
    for (const field of required) {
      if ((transaction as any)[field] === undefined || (transaction as any)[field] === null) {
        throw new Error(`Missing required transaction field: ${field}`);
      }
    }

    // Validate chain ID support
    const supportedChains = TestWallet.getSupportedChainIds();
    if (!supportedChains.includes(transaction.chainId)) {
      throw new Error(`Unsupported chain ID: ${transaction.chainId}`);
    }
  }

  /**
   * Get pending transactions
   */
  getPendingTransactions(): PendingTransaction[] {
    return Array.from(this.pendingTransactions.values());
  }

  /**
   * Get wallet information
   */
  getWalletInfo() {
    return this.testWallet.getWalletInfo();
  }

  /**
   * Get audio protocol status
   */
  getAudioStatus() {
    return {
      isListening: this.audioProtocol.getIsListening(),
      isTransmitting: this.audioProtocol.getIsTransmitting(),
      audioLevel: this.audioProtocol.getAudioLevel()
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.audioProtocol.destroy();
    this.pendingTransactions.clear();
    this.removeAllListeners();
  }
}