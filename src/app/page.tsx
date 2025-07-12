'use client';

import { useState, useEffect } from 'react';
import { WalletClient } from '@/lib/wallet-client';
import { WalletConfig, ConnectionStatus, AudioStatus, TransactionRequest } from '@/types/wallet';

import WalletConnect from '@/components/WalletConnect';
import TransactionForm from '@/components/TransactionForm';
import AudioControls from '@/components/AudioControls';
import StatusDisplay from '@/components/StatusDisplay';

export default function Home() {
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ connected: false });
  const [audioStatus, setAudioStatus] = useState<AudioStatus>({ isListening: false, isTransmitting: false, level: 0 });
  const [config, setConfig] = useState<WalletConfig | null>(null);
  const [balance, setBalance] = useState<string>('0');

  // Initialize wallet client
  useEffect(() => {
    const client = new WalletClient();
    
    // Set up event listeners
    client.on('connectionChanged', (status: ConnectionStatus) => {
      setConnectionStatus(status);
      // Automatically refresh balance when wallet address is received
      if (status.walletAddress && client) {
        client.getBalance(status.walletAddress).then(bal => {
          setBalance(bal);
        }).catch(err => {
          console.error('Failed to get balance:', err);
        });
      }
    });
    client.on('audioChanged', setAudioStatus);
    client.on('transactionSent', (txHash: string) => {
      console.log('Transaction sent:', txHash);
    });
    client.on('transactionConfirmed', (receipt: unknown) => {
      console.log('Transaction confirmed:', receipt);
      // Note: Balance will be refreshed manually by user if needed
    });
    client.on('error', (error: Error) => {
      console.error('Wallet error:', error);
    });

    setWalletClient(client);

    return () => {
      client.destroy();
    };
  }, []); // No dependencies - wallet client should persist across connections

  const handleConnect = async (walletConfig: WalletConfig) => {
    if (!walletClient) return;

    const success = await walletClient.initialize(walletConfig);
    if (success) {
      setConfig(walletConfig);
      
      // Connect to offline wallet to get address
      const address = await walletClient.connectToOfflineWallet();
      if (!address) {
        console.error('Failed to get wallet address from offline wallet');
      }
    }
  };

  const refreshBalance = async () => {
    if (!walletClient || !connectionStatus.walletAddress) return;
    try {
      const bal = await walletClient.getBalance(connectionStatus.walletAddress);
      setBalance(bal);
    } catch (error) {
      console.error('Failed to get balance:', error);
    }
  };

  const handleStartListening = async () => {
    if (!walletClient) return;
    await walletClient.startListening();
  };

  const handleStopListening = () => {
    if (!walletClient) return;
    walletClient.stopListening();
  };

  const handleSendTransaction = async (request: TransactionRequest) => {
    if (!walletClient) return;
    return await walletClient.sendEthTransfer(request);
  };

  const handleSendErc20Transaction = async (request: TransactionRequest & { tokenAddress: string; amount: string }) => {
    if (!walletClient) return;
    return await walletClient.sendErc20Transfer(request);
  };

  return (
    <main className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          GibberWallet - Sound-Based Airgap Wallet
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Connection & Status */}
          <div className="space-y-6">
            <WalletConnect 
              onConnect={handleConnect}
              connectionStatus={connectionStatus}
              balance={balance}
              address={connectionStatus.walletAddress || ''}
              onRefreshBalance={refreshBalance}
            />
            
            <StatusDisplay 
              connectionStatus={connectionStatus}
              audioStatus={audioStatus}
            />
            
            <AudioControls
              audioStatus={audioStatus}
              onStartListening={handleStartListening}
              onStopListening={handleStopListening}
            />
          </div>

          {/* Right Column - Transaction Form */}
          <div className="space-y-6">
            <TransactionForm
              onSendTransaction={handleSendTransaction}
              onSendErc20Transaction={handleSendErc20Transaction}
              disabled={!connectionStatus.connected}
              fromAddress={connectionStatus.walletAddress || ''}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-600">
          <p className="text-sm">
            Secure offline transaction signing using sound transmission
          </p>
          <p className="text-xs mt-2">
            Make sure your offline wallet is running and listening for audio messages
          </p>
        </div>
      </div>
    </main>
  );
}
