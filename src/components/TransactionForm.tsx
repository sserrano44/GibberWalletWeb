'use client';

import { useState } from 'react';
import { TransactionRequest, TransactionResponse } from '@/types/wallet';
import { CryptoUtils } from '@/lib/crypto-utils';

interface TransactionFormProps {
  onSendTransaction: (request: TransactionRequest) => Promise<TransactionResponse | undefined>;
  onSendErc20Transaction: (request: TransactionRequest & { tokenAddress: string; amount: string }) => Promise<TransactionResponse | undefined>;
  disabled: boolean;
  fromAddress: string;
}

export default function TransactionForm({ 
  onSendTransaction, 
  onSendErc20Transaction, 
  disabled, 
  fromAddress 
}: TransactionFormProps) {
  const [transactionType, setTransactionType] = useState<'eth' | 'erc20'>('eth');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [gasLimit, setGasLimit] = useState('');
  const [gasPrice, setGasPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<TransactionResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fromAddress) {
      alert('Please connect your wallet first');
      return;
    }

    if (!to || !amount) {
      alert('Please fill in all required fields');
      return;
    }

    if (!CryptoUtils.validateAddress(to)) {
      alert('Invalid recipient address');
      return;
    }

    if (transactionType === 'erc20' && !CryptoUtils.validateAddress(tokenAddress)) {
      alert('Invalid token contract address');
      return;
    }

    setIsLoading(true);
    setLastTransaction(null);

    try {
      let result: TransactionResponse | undefined;

      if (transactionType === 'eth') {
        const value = CryptoUtils.ethToWei(amount).toString();
        const request: TransactionRequest = {
          from: fromAddress,
          to,
          value,
          gasLimit: gasLimit || undefined,
          gasPrice: gasPrice || undefined
        };
        result = await onSendTransaction(request);
      } else {
        const request = {
          from: fromAddress,
          to,
          value: '0',
          tokenAddress,
          amount: CryptoUtils.ethToWei(amount).toString(),
          gasLimit: gasLimit || undefined,
          gasPrice: gasPrice || undefined
        };
        result = await onSendErc20Transaction(request);
      }

      if (result) {
        setLastTransaction(result);
        if (result.success) {
          // Clear form on success
          setTo('');
          setAmount('');
          setTokenAddress('');
          setGasLimit('');
          setGasPrice('');
        }
      }
    } catch (error) {
      console.error('Transaction failed:', error);
      setLastTransaction({
        hash: '',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Send Transaction</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Transaction Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transaction Type
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="eth"
                checked={transactionType === 'eth'}
                onChange={(e) => setTransactionType(e.target.value as 'eth')}
                className="mr-2"
              />
              ETH Transfer
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="erc20"
                checked={transactionType === 'erc20'}
                onChange={(e) => setTransactionType(e.target.value as 'erc20')}
                className="mr-2"
              />
              ERC-20 Transfer
            </label>
          </div>
        </div>

        {/* Token Address (for ERC-20) */}
        {transactionType === 'erc20' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token Contract Address
            </label>
            <input
              type="text"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required={transactionType === 'erc20'}
            />
          </div>
        )}

        {/* Recipient Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount ({transactionType === 'eth' ? 'ETH' : 'Tokens'})
          </label>
          <input
            type="number"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Advanced Options */}
        <details className="border border-gray-200 rounded-md">
          <summary className="p-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50">
            Advanced Options
          </summary>
          <div className="p-3 border-t border-gray-200 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gas Limit
                </label>
                <input
                  type="number"
                  value={gasLimit}
                  onChange={(e) => setGasLimit(e.target.value)}
                  placeholder="Auto"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gas Price (Wei)
                </label>
                <input
                  type="number"
                  value={gasPrice}
                  onChange={(e) => setGasPrice(e.target.value)}
                  placeholder="Auto"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </details>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={disabled || isLoading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isLoading ? 'Sending Transaction...' : `Send ${transactionType === 'eth' ? 'ETH' : 'Tokens'}`}
        </button>
      </form>

      {/* Transaction Result */}
      {lastTransaction && (
        <div className={`mt-4 p-4 rounded-md ${
          lastTransaction.success ? 'bg-green-100 border border-green-400' : 'bg-red-100 border border-red-400'
        }`}>
          <h3 className={`font-medium ${
            lastTransaction.success ? 'text-green-800' : 'text-red-800'
          }`}>
            {lastTransaction.success ? 'Transaction Sent!' : 'Transaction Failed'}
          </h3>
          
          {lastTransaction.success ? (
            <div className={`mt-2 text-sm ${
              lastTransaction.success ? 'text-green-700' : 'text-red-700'
            }`}>
              <p>Transaction Hash:</p>
              <p className="font-mono text-xs break-all">{lastTransaction.hash}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-red-700">
              {lastTransaction.error}
            </p>
          )}
        </div>
      )}

      {/* Instructions */}
      {!disabled && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">Transaction Flow</h3>
          <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
            <li>Fill in transaction details above</li>
            <li>Make sure audio is enabled and offline wallet is listening</li>
            <li>Click &quot;Send&quot; to initiate the sound-based transaction</li>
            <li>Approve the transaction on your offline wallet</li>
            <li>Wait for the signed transaction to be received and broadcast</li>
          </ol>
        </div>
      )}
    </div>
  );
}