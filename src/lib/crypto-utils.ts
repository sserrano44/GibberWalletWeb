import { ethers } from 'ethers';

export interface TransactionData {
    to: string;
    value: string | bigint;
    gasLimit: string | bigint;
    gasPrice: string | bigint;
    nonce: number;
    chainId: number;
    data?: string;
    type?: number;
}

export interface SignedTransaction {
    raw: string;
    hash: string;
}

/**
 * Cryptographic utilities for Ethereum transactions (browser-compatible)
 */
export class CryptoUtils {
    private provider: ethers.JsonRpcProvider | null = null;

    constructor(rpcUrl?: string) {
        if (rpcUrl) {
            this.provider = new ethers.JsonRpcProvider(rpcUrl);
        }
    }

    /**
     * Set RPC provider
     */
    setProvider(rpcUrl: string): void {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }

    /**
     * Get provider
     */
    getProvider(): ethers.JsonRpcProvider | null {
        return this.provider;
    }

    /**
     * Create ETH transfer transaction
     */
    createEthTransaction(
        to: string, 
        value: string | bigint, 
        nonce: number, 
        gasPrice: string | bigint, 
        gasLimit: string | bigint, 
        chainId: number
    ): TransactionData {
        return {
            to: to,
            value: value,
            gasLimit: gasLimit,
            gasPrice: gasPrice,
            nonce: nonce,
            chainId: chainId,
            type: 0 // Legacy transaction type
        };
    }

    /**
     * Create ERC-20 transfer transaction
     */
    createErc20Transaction(
        tokenAddress: string, 
        to: string, 
        amount: string | bigint, 
        nonce: number, 
        gasPrice: string | bigint, 
        gasLimit: string | bigint, 
        chainId: number
    ): TransactionData {
        // ERC-20 transfer function signature: transfer(address,uint256)
        const iface = new ethers.Interface([
            'function transfer(address to, uint256 amount) returns (bool)'
        ]);
        
        const data = iface.encodeFunctionData('transfer', [to, amount]);
        
        return {
            to: tokenAddress,
            value: '0', // No ETH value for ERC-20 transfers
            gasLimit: gasLimit,
            gasPrice: gasPrice,
            nonce: nonce,
            chainId: chainId,
            data: data,
            type: 0 // Legacy transaction type
        };
    }

    /**
     * Get transaction count (nonce) for address
     */
    async getNonce(address: string): Promise<number> {
        if (!this.provider) {
            throw new Error('Provider not set');
        }
        return await this.provider.getTransactionCount(address);
    }

    /**
     * Get current gas price
     */
    async getGasPrice(): Promise<bigint> {
        if (!this.provider) {
            throw new Error('Provider not set');
        }
        const feeData = await this.provider.getFeeData();
        return feeData.gasPrice || BigInt(0);
    }

    /**
     * Estimate gas for a transaction
     */
    async estimateGas(transaction: Partial<TransactionData>): Promise<bigint> {
        if (!this.provider) {
            throw new Error('Provider not set');
        }
        try {
            return await this.provider.estimateGas(transaction);
        } catch (error) {
            console.log(`Gas estimation failed: ${error}`);
            return BigInt(21000); // Default for simple transfers
        }
    }

    /**
     * Get account balance
     */
    async getBalance(address: string): Promise<string> {
        if (!this.provider) {
            throw new Error('Provider not set');
        }
        const balance = await this.provider.getBalance(address);
        return ethers.formatEther(balance);
    }

    /**
     * Broadcast signed transaction
     */
    async broadcastTransaction(signedTx: string): Promise<string> {
        if (!this.provider) {
            throw new Error('Provider not set');
        }
        const tx = await this.provider.broadcastTransaction(signedTx);
        return tx.hash;
    }

    /**
     * Wait for transaction confirmation
     */
    async waitForTransaction(txHash: string, timeout = 300000): Promise<ethers.TransactionReceipt | null> {
        if (!this.provider) {
            throw new Error('Provider not set');
        }
        return await this.provider.waitForTransaction(txHash, 1, timeout);
    }

    /**
     * Validate Ethereum address
     */
    static validateAddress(address: string): boolean {
        try {
            return ethers.isAddress(address);
        } catch {
            return false;
        }
    }

    /**
     * Validate private key format
     */
    static validatePrivateKey(privateKey: string): boolean {
        try {
            // Remove 0x prefix if present
            if (privateKey.startsWith('0x')) {
                privateKey = privateKey.slice(2);
            }
            
            // Check length (64 hex characters = 32 bytes)
            if (privateKey.length !== 64) {
                return false;
            }
            
            // Check if valid hex
            parseInt(privateKey, 16);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Convert Wei to ETH
     */
    static weiToEth(weiAmount: string | bigint): string {
        return ethers.formatEther(weiAmount);
    }

    /**
     * Convert ETH to Wei
     */
    static ethToWei(ethAmount: string): bigint {
        return ethers.parseEther(ethAmount.toString());
    }

    /**
     * Format transaction for display
     */
    static formatTransactionForDisplay(transaction: Partial<TransactionData>): string {
        const lines: string[] = [];
        lines.push('Transaction Details:');
        lines.push(`To: ${transaction.to || 'N/A'}`);
        lines.push(`Value: ${CryptoUtils.weiToEth(transaction.value || '0')} ETH`);
        lines.push(`Gas Price: ${transaction.gasPrice || '0'} wei`);
        lines.push(`Gas Limit: ${transaction.gasLimit || '0'}`);
        lines.push(`Nonce: ${transaction.nonce || 0}`);
        lines.push(`Chain ID: ${transaction.chainId || 0}`);
        
        if (transaction.data && transaction.data !== '0x') {
            const dataStr = transaction.data.length > 50 
                ? transaction.data.slice(0, 50) + '...'
                : transaction.data;
            lines.push(`Data: ${dataStr}`);
        }
        
        return lines.join('\n');
    }

    /**
     * Parse hex string to number
     */
    static parseHexToNumber(hexString: string | number): number {
        if (typeof hexString === 'number') {
            return hexString;
        }
        
        if (typeof hexString === 'string') {
            if (hexString.startsWith('0x')) {
                return parseInt(hexString, 16);
            }
            return parseInt(hexString, 10);
        }
        
        return 0;
    }

    /**
     * Convert number to hex string
     */
    static numberToHex(number: number): string {
        return `0x${number.toString(16)}`;
    }
}