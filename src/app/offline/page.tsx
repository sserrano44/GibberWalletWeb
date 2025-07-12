'use client';

import { useState, useEffect } from 'react';
import { EIPMessageHandler, PendingTransaction } from '@/lib/eip-message-handler';
import { TestWalletInfo } from '@/lib/test-wallet';
import { EIP_PROTOCOL_VERSION } from '@/config/eip-config';
import ConnectionStatus from '@/components/offline/ConnectionStatus';
import TransactionApproval from '@/components/offline/TransactionApproval';

interface AudioStatus {
  isListening: boolean;
  isTransmitting: boolean;
  audioLevel: number;
}

export default function OfflineWalletPage() {
  const [messageHandler, setMessageHandler] = useState<EIPMessageHandler | null>(null);
  const [walletInfo, setWalletInfo] = useState<TestWalletInfo | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>({
    isListening: false,
    isTransmitting: false,
    audioLevel: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<PendingTransaction | null>(null);
  const [isProcessingTx, setIsProcessingTx] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Initialize message handler
  useEffect(() => {
    const handler = new EIPMessageHandler();
    
    // Set up event listeners
    handler.on('connect-request', () => {
      addLog('🔗 Connection request received from online device');
    });

    handler.on('connection-established', (address: string) => {
      setIsConnected(true);
      addLog(`✅ Connection established. Shared address: ${address.slice(0, 8)}...`);
    });

    handler.on('transaction-request', (message: any, details: any) => {
      addLog(`📝 Transaction request received (${details.valueEth} ETH to ${details.to.slice(0, 8)}...)`);
      setPendingTransaction({ message, details, timestamp: Date.now() });
    });

    handler.on('transaction-approved', (txHash: string) => {
      addLog(`✅ Transaction signed and sent: ${txHash.slice(0, 10)}...`);
      setPendingTransaction(null);
      setIsProcessingTx(false);
    });

    handler.on('transaction-rejected', (reason: string) => {
      addLog(`❌ Transaction rejected: ${reason}`);
      setPendingTransaction(null);
      setIsProcessingTx(false);
    });

    handler.on('listening', (isListening: boolean) => {
      setAudioStatus(prev => ({ ...prev, isListening }));
      if (isListening) {
        addLog('🎤 Started listening for audio messages');
      } else {
        addLog('🔇 Stopped listening for audio messages');
        setIsConnected(false);
      }
    });

    handler.on('transmitting', (isTransmitting: boolean) => {
      setAudioStatus(prev => ({ ...prev, isTransmitting }));
      if (isTransmitting) {
        addLog('📡 Transmitting audio response...');
      }
    });

    handler.on('audioLevel', (level: number) => {
      setAudioStatus(prev => ({ ...prev, audioLevel: level }));
    });

    handler.on('error', (error: Error) => {
      addLog(`❌ Error: ${error.message}`);
      console.error('EIP Message Handler Error:', error);
    });

    // Initialize and get wallet info
    handler.initialize().then((success) => {
      if (success) {
        const info = handler.getWalletInfo();
        setWalletInfo(info);
        addLog(`🔑 Test wallet initialized: ${info.address.slice(0, 8)}...`);
      } else {
        addLog('❌ Failed to initialize message handler');
      }
    });

    setMessageHandler(handler);

    return () => {
      handler.destroy();
    };
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]); // Keep last 50 logs
  };

  const handleStartListening = async () => {
    if (!messageHandler) return;
    
    const success = await messageHandler.startListening();
    if (!success) {
      addLog('❌ Failed to start listening. Check microphone permissions.');
    }
  };

  const handleStopListening = () => {
    if (!messageHandler) return;
    messageHandler.stopListening();
  };

  const handleApproveTransaction = async (messageId: string) => {
    if (!messageHandler) return;
    
    setIsProcessingTx(true);
    addLog('🔐 User approved transaction. Signing...');
    
    const success = await messageHandler.approveTransaction(messageId);
    if (!success) {
      setIsProcessingTx(false);
    }
  };

  const handleRejectTransaction = async (messageId: string, reason: string) => {
    if (!messageHandler) return;
    
    setIsProcessingTx(true);
    const success = await messageHandler.rejectTransaction(messageId, reason);
    setIsProcessingTx(false);
  };

  return (
    <main className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🔒 Offline Wallet Test Client
          </h1>
          <p className="text-gray-600">
            EIP-compliant sound-based communication for air-gapped transaction signing
          </p>
          <div className="mt-2 flex items-center justify-center space-x-4 text-sm text-gray-500">
            <span>Protocol: EIP v{EIP_PROTOCOL_VERSION}</span>
            <span>•</span>
            <span>Sample Rate: 44.1 kHz</span>
            <span>•</span>
            <span className="text-orange-600 font-medium">⚠️ Test Environment</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Connection & Status */}
          <div className="space-y-6">
            <ConnectionStatus
              isListening={audioStatus.isListening}
              isTransmitting={audioStatus.isTransmitting}
              audioLevel={audioStatus.audioLevel}
              walletAddress={walletInfo?.address || 'Loading...'}
              isConnected={isConnected}
              onStartListening={handleStartListening}
              onStopListening={handleStopListening}
            />

            {/* Wallet Information */}
            {walletInfo && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Wallet Information</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Type:</span>
                    <span className="text-sm text-orange-600 font-medium">
                      {walletInfo.isTestWallet ? '🧪 Test Wallet' : 'Production Wallet'}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-gray-600">Private Key Preview:</span>
                    <div className="bg-gray-50 rounded p-2 border">
                      <code className="text-xs font-mono text-gray-800">
                        {walletInfo.privateKey.slice(0, 10)}...{walletInfo.privateKey.slice(-8)}
                      </code>
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-red-600">⚠️</span>
                      <div className="text-xs text-red-700">
                        <div className="font-medium">Security Notice</div>
                        <div>This is a test wallet with predetermined keys. Never use for real transactions.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Activity Log */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Activity Log</h2>
              <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto text-sm font-mono">
                {logs.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">
                    No activity yet. Start listening to begin receiving messages.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, index) => (
                      <div key={index} className="text-green-400">
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {logs.length > 0 && (
                <button
                  onClick={() => setLogs([])}
                  className="mt-3 text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Clear Log
                </button>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-md font-semibold text-blue-800 mb-3">How to Test</h3>
              <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
                <li>Click "Start Listening" to begin receiving messages</li>
                <li>On another device, go to the main wallet app</li>
                <li>Set up a connection and try sending a test transaction</li>
                <li>This offline client will receive and display the transaction for approval</li>
                <li>Approve or reject transactions as needed</li>
              </ol>
              
              <div className="mt-4 pt-3 border-t border-blue-200">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Audio Requirements:</h4>
                <ul className="text-xs text-blue-600 space-y-1">
                  <li>• Place devices 1-2 meters apart</li>
                  <li>• Use quiet environment</li>
                  <li>• Allow microphone access</li>
                  <li>• Use moderate volume (50-70%)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Approval Modal */}
        {pendingTransaction && (
          <TransactionApproval
            messageId={pendingTransaction.message.id}
            details={pendingTransaction.details}
            onApprove={handleApproveTransaction}
            onReject={handleRejectTransaction}
            isProcessing={isProcessingTx}
          />
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-gray-600">
          <p className="text-sm">
            🔊 EIP-compliant sound-based offline wallet communication
          </p>
          <p className="text-xs mt-2">
            Secure air-gapped transaction signing for Ethereum
          </p>
        </div>
      </div>
    </main>
  );
}