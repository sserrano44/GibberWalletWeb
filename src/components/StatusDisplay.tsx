'use client';

import { ConnectionStatus, AudioStatus } from '@/types/wallet';

interface StatusDisplayProps {
  connectionStatus: ConnectionStatus;
  audioStatus: AudioStatus;
}

export default function StatusDisplay({ connectionStatus, audioStatus }: StatusDisplayProps) {
  const getConnectionStatusColor = () => {
    if (connectionStatus.connected) return 'text-green-600';
    if (connectionStatus.error) return 'text-red-600';
    return 'text-gray-600';
  };

  const getConnectionStatusText = () => {
    if (connectionStatus.connected) return 'Connected';
    if (connectionStatus.error) return 'Connection Error';
    return 'Disconnected';
  };

  const getAudioStatusColor = () => {
    if (audioStatus.error) return 'text-red-600';
    if (audioStatus.isListening || audioStatus.isTransmitting) return 'text-green-600';
    return 'text-gray-600';
  };

  const getAudioStatusText = () => {
    if (audioStatus.error) return 'Audio Error';
    if (audioStatus.isTransmitting) return 'Transmitting';
    if (audioStatus.isListening) return 'Listening';
    return 'Idle';
  };

  const audioLevelPercentage = Math.round(audioStatus.level * 100);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">System Status</h2>
      
      <div className="space-y-4">
        {/* Network Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Network:</span>
          <span className={`text-sm font-semibold ${getConnectionStatusColor()}`}>
            {getConnectionStatusText()}
          </span>
        </div>

        {/* Audio Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Audio:</span>
          <span className={`text-sm font-semibold ${getAudioStatusColor()}`}>
            {getAudioStatusText()}
          </span>
        </div>

        {/* Audio Level Indicator */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Audio Level:</span>
            <span className="text-sm text-gray-600">{audioLevelPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-200"
              style={{ width: `${Math.min(audioLevelPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Network Details */}
        {connectionStatus.connected && (
          <div className="pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-600 space-y-1">
              <div>Chain ID: {connectionStatus.chainId}</div>
              {connectionStatus.blockNumber && (
                <div>Block: #{connectionStatus.blockNumber}</div>
              )}
            </div>
          </div>
        )}

        {/* Error Messages */}
        {connectionStatus.error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            Network: {connectionStatus.error}
          </div>
        )}

        {audioStatus.error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            Audio: {audioStatus.error}
          </div>
        )}

        {/* Status Indicators */}
        <div className="flex justify-center space-x-4 pt-2">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-xs text-gray-600">Network</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              audioStatus.isListening || audioStatus.isTransmitting ? 'bg-green-500' : 'bg-gray-400'
            }`} />
            <span className="text-xs text-gray-600">Audio</span>
          </div>
        </div>
      </div>
    </div>
  );
}