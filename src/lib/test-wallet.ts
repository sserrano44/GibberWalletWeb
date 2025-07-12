import { ethers } from 'ethers';
import { TransactionRequestPayload } from '@/config/eip-config';

export interface TestWalletInfo {
  address: string;
  privateKey: string;
  mnemonic?: string;
  isTestWallet: boolean;
}

export interface SignedTransactionResult {
  raw: string;
  hash: string;
  transaction: ethers.Transaction;
}

export class TestWallet {
  private wallet: ethers.Wallet;
  private isTestMode: boolean;

  constructor(privateKey?: string) {
    this.isTestMode = true;
    
    if (privateKey) {
      this.wallet = new ethers.Wallet(privateKey);
    } else {
      // Generate a deterministic test wallet for consistent testing
      const testSeed = 'test-offline-wallet-seed-for-eip-demo-only-never-use-in-production';
      const hash = ethers.keccak256(ethers.toUtf8Bytes(testSeed));
      this.wallet = new ethers.Wallet(hash);
    }
    
    console.log('Test Wallet initialized:', this.wallet.address);
    console.warn('⚠️ THIS IS A TEST WALLET - NEVER USE IN PRODUCTION ⚠️');
  }

  /**
   * Get wallet information
   */
  getWalletInfo(): TestWalletInfo {
    return {
      address: this.wallet.address,
      privateKey: this.wallet.privateKey,
      isTestWallet: this.isTestMode,
    };
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Sign a transaction from EIP transaction request
   */
  async signTransaction(txRequest: TransactionRequestPayload): Promise<SignedTransactionResult> {
    try {
      const { transaction } = txRequest;
      
      // Validate transaction parameters
      this.validateTransaction(transaction);
      
      // Convert hex strings to appropriate types
      const txData = {
        to: transaction.to,
        value: transaction.value,
        data: transaction.data,
        gasLimit: transaction.gasLimit,
        gasPrice: transaction.gasPrice,
        nonce: parseInt(transaction.nonce, 16),
        chainId: transaction.chainId,
        type: 0, // Legacy transaction type
      };

      console.log('Signing transaction:', txData);
      
      // Sign the transaction
      const signedTx = await this.wallet.signTransaction(txData);
      
      // Parse the signed transaction to get the hash
      const parsedTx = ethers.Transaction.from(signedTx);
      const txHash = parsedTx.hash;
      
      if (!txHash) {
        throw new Error('Failed to calculate transaction hash');
      }

      console.log('Transaction signed successfully:', txHash);
      
      return {
        raw: signedTx,
        hash: txHash,
        transaction: parsedTx,
      };
      
    } catch (error) {
      console.error('Failed to sign transaction:', error);
      throw new Error(`Transaction signing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate transaction parameters
   */
  private validateTransaction(transaction: any): void {
    const required = ['chainId', 'nonce', 'gasPrice', 'gasLimit', 'to', 'value', 'data'];
    
    for (const field of required) {
      if (transaction[field] === undefined || transaction[field] === null) {
        throw new Error(`Missing required transaction field: ${field}`);
      }
    }

    // Validate addresses
    if (!ethers.isAddress(transaction.to)) {
      throw new Error(`Invalid 'to' address: ${transaction.to}`);
    }

    // Validate hex strings
    const hexFields = ['nonce', 'gasPrice', 'gasLimit', 'value', 'data'];
    for (const field of hexFields) {
      if (typeof transaction[field] === 'string' && !transaction[field].startsWith('0x')) {
        throw new Error(`Field ${field} must be a hex string starting with 0x`);
      }
    }

    // Validate chain ID
    if (!Number.isInteger(transaction.chainId) || transaction.chainId <= 0) {
      throw new Error(`Invalid chainId: ${transaction.chainId}`);
    }

    // Validate value limits for test wallet
    const value = BigInt(transaction.value);
    const maxTestValue = ethers.parseEther('10'); // 10 ETH max for test
    
    if (value > maxTestValue) {
      throw new Error(`Transaction value too high for test wallet: ${ethers.formatEther(value)} ETH (max: 10 ETH)`);
    }
  }

  /**
   * Get transaction details for user confirmation
   */
  getTransactionDetails(txRequest: TransactionRequestPayload): {
    to: string;
    value: string;
    valueEth: string;
    gasPrice: string;
    gasPriceGwei: string;
    gasLimit: string;
    nonce: string;
    chainId: number;
    data: string;
    estimatedFee: string;
    estimatedFeeEth: string;
  } {
    const { transaction } = txRequest;
    
    const value = BigInt(transaction.value);
    const gasPrice = BigInt(transaction.gasPrice);
    const gasLimit = BigInt(transaction.gasLimit);
    const estimatedFee = gasPrice * gasLimit;
    
    return {
      to: transaction.to,
      value: transaction.value,
      valueEth: ethers.formatEther(value),
      gasPrice: transaction.gasPrice,
      gasPriceGwei: ethers.formatUnits(gasPrice, 'gwei'),
      gasLimit: transaction.gasLimit,
      nonce: transaction.nonce,
      chainId: transaction.chainId,
      data: transaction.data,
      estimatedFee: estimatedFee.toString(),
      estimatedFeeEth: ethers.formatEther(estimatedFee),
    };
  }

  /**
   * Check if this is a test wallet
   */
  isTestWallet(): boolean {
    return this.isTestMode;
  }

  /**
   * Generate a new random test wallet
   */
  static generateRandomTestWallet(): TestWallet {
    const randomWallet = ethers.Wallet.createRandom();
    return new TestWallet(randomWallet.privateKey);
  }

  /**
   * Create wallet from mnemonic (for testing)
   */
  static fromMnemonic(mnemonic: string): TestWallet {
    const wallet = ethers.Wallet.fromPhrase(mnemonic);
    return new TestWallet(wallet.privateKey);
  }

  /**
   * Get supported chain IDs for test wallet
   */
  static getSupportedChainIds(): number[] {
    return [
      1,        // Ethereum Mainnet
      5,        // Goerli Testnet
      11155111, // Sepolia Testnet
    ];
  }

  /**
   * Get chain name from chain ID
   */
  static getChainName(chainId: number): string {
    const chainNames: Record<number, string> = {
      1: 'Ethereum Mainnet',
      5: 'Goerli Testnet',
      11155111: 'Sepolia Testnet',
    };
    
    return chainNames[chainId] || `Unknown Chain (${chainId})`;
  }
}