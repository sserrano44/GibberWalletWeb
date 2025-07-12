'use client';

import { useState, useEffect } from 'react';
import { WalletConfig, ConnectionStatus } from '@/types/wallet';
import { CryptoUtils } from '@/lib/crypto-utils';
import { 
  getAllNetworks, 
  addCustomNetwork, 
  deleteCustomNetwork, 
  findNetworkById,
  type NetworkConfig 
} from '@/lib/network-storage';

interface WalletConnectProps {
  onConnect: (config: WalletConfig) => void;
  connectionStatus: ConnectionStatus;
  balance: string;
  address: string;
  onRefreshBalance: () => void;
}

export default function WalletConnect({ 
  onConnect, 
  connectionStatus, 
  balance, 
  address, 
  onRefreshBalance 
}: WalletConnectProps) {
  const [selectedNetworkId, setSelectedNetworkId] = useState('');
  const [rpcUrl, setRpcUrl] = useState('');
  const [chainId, setChainId] = useState('');
  const [chainName, setChainName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [networks, setNetworks] = useState<NetworkConfig[]>([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customNetworkForm, setCustomNetworkForm] = useState({
    name: '',
    rpcUrl: '',
    chainId: ''
  });
  const [formError, setFormError] = useState('');

  const handleConnect = async () => {
    if (!selectedNetworkId) {
      alert('Please select a network');
      return;
    }

    const selectedNetwork = findNetworkById(selectedNetworkId);
    if (!selectedNetwork) {
      alert('Selected network not found');
      return;
    }

    setIsConnecting(true);
    
    const config: WalletConfig = {
      rpcUrl: selectedNetwork.rpcUrl,
      chainId: selectedNetwork.chainId,
      chainName: selectedNetwork.name
    };

    try {
      await onConnect(config);
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Load networks on component mount
  useEffect(() => {
    loadNetworks();
  }, []);

  const loadNetworks = () => {
    setNetworks(getAllNetworks());
  };

  const handleNetworkSelect = (networkId: string) => {
    setSelectedNetworkId(networkId);
    
    if (networkId === 'custom') {
      setShowCustomForm(true);
      return;
    }
    
    const network = findNetworkById(networkId);
    if (network) {
      setChainName(network.name);
      setChainId(network.chainId.toString());
      setRpcUrl(network.rpcUrl);
      setShowCustomForm(false);
    }
  };

  const handleCustomNetworkSubmit = () => {
    try {
      setFormError('');
      const chainIdNum = parseInt(customNetworkForm.chainId);
      
      addCustomNetwork(
        customNetworkForm.name,
        customNetworkForm.rpcUrl,
        chainIdNum
      );
      
      loadNetworks();
      
      // Auto-select the newly added network
      const newNetworks = getAllNetworks();
      const newNetwork = newNetworks.find(n => 
        n.name === customNetworkForm.name && n.chainId === chainIdNum
      );
      
      if (newNetwork) {
        setSelectedNetworkId(newNetwork.id);
        setChainName(newNetwork.name);
        setChainId(newNetwork.chainId.toString());
        setRpcUrl(newNetwork.rpcUrl);
      }
      
      // Reset form
      setCustomNetworkForm({ name: '', rpcUrl: '', chainId: '' });
      setShowCustomForm(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to add network');
    }
  };

  const handleDeleteNetwork = (networkId: string) => {
    if (window.confirm('Are you sure you want to delete this custom network?')) {
      try {
        deleteCustomNetwork(networkId);
        loadNetworks();
        
        // Reset selection if deleted network was selected
        if (selectedNetworkId === networkId) {
          setSelectedNetworkId('');
          setChainName('');
          setChainId('');
          setRpcUrl('');
        }
      } catch (error) {
        alert('Failed to delete network');
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Wallet Connection</h2>
      
      {!connectionStatus.connected ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Network
            </label>
            <select
              value={selectedNetworkId}
              onChange={(e) => handleNetworkSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            >
              <option value="">Select a network...</option>
              {networks.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.name} {network.isCustom ? '(Custom)' : ''}
                </option>
              ))}
              <option value="custom">+ Add Custom Network</option>
            </select>
            
            {/* Custom Networks Management */}
            {networks.filter(n => n.isCustom).length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-gray-600 mb-1">Custom Networks:</div>
                <div className="space-y-1">
                  {networks.filter(n => n.isCustom).map((network) => (
                    <div key={network.id} className="flex items-center justify-between text-xs bg-gray-50 px-2 py-1 rounded">
                      <span>{network.name} (Chain {network.chainId})</span>
                      <button
                        onClick={() => handleDeleteNetwork(network.id)}
                        className="text-red-600 hover:text-red-800 ml-2"
                        title="Delete network"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Custom Network Form */}
          {showCustomForm && (
            <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Add Custom Network</h3>
              
              {formError && (
                <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 text-xs rounded">
                  {formError}
                </div>
              )}
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Network Name
                  </label>
                  <input
                    type="text"
                    value={customNetworkForm.name}
                    onChange={(e) => setCustomNetworkForm({...customNetworkForm, name: e.target.value})}
                    placeholder="e.g., My Custom Network"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    RPC URL
                  </label>
                  <input
                    type="text"
                    value={customNetworkForm.rpcUrl}
                    onChange={(e) => setCustomNetworkForm({...customNetworkForm, rpcUrl: e.target.value})}
                    placeholder="https://your-rpc-endpoint.com"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Chain ID
                  </label>
                  <input
                    type="number"
                    value={customNetworkForm.chainId}
                    onChange={(e) => setCustomNetworkForm({...customNetworkForm, chainId: e.target.value})}
                    placeholder="1"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleCustomNetworkSubmit}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Add Network
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomForm(false);
                      setSelectedNetworkId('');
                      setFormError('');
                      setCustomNetworkForm({ name: '', rpcUrl: '', chainId: '' });
                    }}
                    className="px-3 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-700">
            <p className="font-medium">Automatic Address Detection</p>
            <p className="text-xs mt-1">Your wallet address will be automatically retrieved when you connect via audio.</p>
          </div>

          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-green-600 font-medium">✓ Connected</span>
            <span className="text-sm text-gray-600">
              Chain ID: {connectionStatus.chainId}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <div className="text-sm font-mono bg-gray-100 p-2 rounded break-all">
              {address || (
                <span className="text-gray-500 italic">Waiting for wallet response...</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Balance
              </label>
              <div className="text-lg font-semibold">
                {parseFloat(balance).toFixed(6)} ETH
              </div>
            </div>
            <button
              onClick={onRefreshBalance}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Refresh
            </button>
          </div>

          {connectionStatus.blockNumber && (
            <div className="text-sm text-gray-600">
              Latest block: {connectionStatus.blockNumber}
            </div>
          )}
        </div>
      )}

      {connectionStatus.error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          Error: {connectionStatus.error}
        </div>
      )}
    </div>
  );
}