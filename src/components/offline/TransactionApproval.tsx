'use client';

import { useState } from 'react';
import { TestWallet } from '@/lib/test-wallet';

interface TransactionDetails {
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
}

interface TransactionApprovalProps {
  messageId: string;
  details: TransactionDetails;
  onApprove: (messageId: string) => void;
  onReject: (messageId: string, reason: string) => void;
  isProcessing: boolean;
}

export default function TransactionApproval({
  messageId,
  details,
  onApprove,
  onReject,
  isProcessing
}: TransactionApprovalProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleApprove = () => {
    onApprove(messageId);
  };

  const handleReject = () => {
    const reason = rejectReason.trim() || 'User rejected transaction';
    onReject(messageId, reason);
  };

  const getChainName = () => {
    return TestWallet.getChainName(details.chainId);
  };

  const isHighValue = () => {
    const valueEth = parseFloat(details.valueEth);
    return valueEth > 1; // Flag transactions over 1 ETH
  };

  const isHighFee = () => {
    const feeEth = parseFloat(details.estimatedFeeEth);
    return feeEth > 0.01; // Flag fees over 0.01 ETH
  };

  const hasData = () => {
    return details.data !== '0x' && details.data.length > 2;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 rounded-t-lg">
          <h2 className="text-xl font-bold">Transaction Approval Required</h2>
          <p className="text-blue-100 text-sm mt-1">
            Please review the transaction details carefully before approving
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Security Warning */}
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-start space-x-3">
              <span className="text-red-600 text-xl mt-0.5">🔒</span>
              <div>
                <h3 className="text-sm font-medium text-red-800">Security Check</h3>
                <p className="text-xs text-red-700 mt-1">
                  Verify all details below. Once approved, this transaction cannot be reversed.
                </p>
              </div>
            </div>
          </div>

          {/* Transaction Overview */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Transaction Details</h3>
            
            {/* Recipient */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="text-sm font-medium text-gray-600">To Address:</label>
              <div className="mt-1 bg-white rounded border p-2">
                <code className="text-sm font-mono text-gray-800 break-all">
                  {details.to}
                </code>
              </div>
            </div>

            {/* Value */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`bg-gray-50 rounded-lg p-4 ${isHighValue() ? 'ring-2 ring-orange-300' : ''}`}>
                <label className="text-sm font-medium text-gray-600">Amount:</label>
                <div className="mt-1">
                  <div className="text-lg font-bold text-gray-900">
                    {details.valueEth} ETH
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    {details.value} wei
                  </div>
                  {isHighValue() && (
                    <div className="text-xs text-orange-600 font-medium mt-1">
                      ⚠️ High value transaction
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <label className="text-sm font-medium text-gray-600">Network:</label>
                <div className="mt-1">
                  <div className="text-lg font-bold text-gray-900">
                    {getChainName()}
                  </div>
                  <div className="text-xs text-gray-500">
                    Chain ID: {details.chainId}
                  </div>
                </div>
              </div>
            </div>

            {/* Gas Information */}
            <div className={`bg-gray-50 rounded-lg p-4 ${isHighFee() ? 'ring-2 ring-orange-300' : ''}`}>
              <label className="text-sm font-medium text-gray-600">Gas & Fees:</label>
              <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">Gas Price:</div>
                  <div className="font-medium">{details.gasPriceGwei} Gwei</div>
                </div>
                <div>
                  <div className="text-gray-500">Gas Limit:</div>
                  <div className="font-medium">{parseInt(details.gasLimit).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500">Est. Fee:</div>
                  <div className="font-medium">{details.estimatedFeeEth} ETH</div>
                </div>
              </div>
              {isHighFee() && (
                <div className="text-xs text-orange-600 font-medium mt-2">
                  ⚠️ High transaction fee
                </div>
              )}
            </div>

            {/* Data (if present) */}
            {hasData() && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <label className="text-sm font-medium text-yellow-800">Contract Interaction Data:</label>
                <div className="mt-2 bg-white rounded border p-2 max-h-24 overflow-y-auto">
                  <code className="text-xs font-mono text-gray-700 break-all">
                    {details.data}
                  </code>
                </div>
                <div className="text-xs text-yellow-700 mt-2">
                  ⚠️ This transaction includes smart contract data
                </div>
              </div>
            )}

            {/* Advanced Details (Collapsible) */}
            <div className="border-t pt-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800"
              >
                <span>{showAdvanced ? '▼' : '▶'}</span>
                <span>Advanced Details</span>
              </button>
              
              {showAdvanced && (
                <div className="mt-3 bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-500">Nonce:</span>
                      <span className="ml-2 font-mono">{parseInt(details.nonce)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Message ID:</span>
                      <span className="ml-2 font-mono text-xs">{messageId.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Rejection Reason */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">
              Rejection Reason (optional):
            </label>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isProcessing}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4 border-t">
            <button
              onClick={handleReject}
              disabled={isProcessing}
              className="flex-1 bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
            >
              {isProcessing ? 'Processing...' : 'Reject Transaction'}
            </button>
            
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="flex-1 bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
            >
              {isProcessing ? 'Signing...' : 'Approve & Sign'}
            </button>
          </div>

          {/* Footer Warning */}
          <div className="bg-gray-50 rounded-md p-3 text-center">
            <p className="text-xs text-gray-600">
              🔒 Your private keys never leave this device. Only the signed transaction is transmitted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}