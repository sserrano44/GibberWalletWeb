'use client';

import { useState, useEffect } from 'react';
import { EIP_PROTOCOL_VERSION } from '@/config/eip-config';

interface ConnectionStatusProps {
  isListening: boolean;
  isTransmitting: boolean;
  audioLevel: number;
  walletAddress: string;
  isConnected: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
}

export default function ConnectionStatus({
  isListening,
  isTransmitting,
  audioLevel,
  walletAddress,
  isConnected,
  onStartListening,
  onStopListening
}: ConnectionStatusProps) {
  const [displayLevel, setDisplayLevel] = useState(0);

  // Smooth audio level animation
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayLevel(prev => prev * 0.8 + audioLevel * 0.2);
    }, 50);

    return () => clearInterval(interval);
  }, [audioLevel]);

  const getStatusColor = () => {
    if (isTransmitting) return 'bg-blue-500';
    if (isConnected) return 'bg-green-500';
    if (isListening) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const getStatusText = () => {
    if (isTransmitting) return 'Transmitting...';
    if (isConnected) return 'Connected';
    if (isListening) return 'Listening...';
    return 'Offline';
  };

  const getAudioLevelBars = () => {
    const bars = [];
    const numBars = 10;
    const threshold = displayLevel * numBars;

    for (let i = 0; i < numBars; i++) {
      const isActive = i < threshold;
      const height = `${((i + 1) / numBars) * 100}%`;
      
      bars.push(
        <div
          key={i}
          className={`w-1 bg-current transition-opacity duration-150 ${
            isActive ? 'opacity-100' : 'opacity-20'
          }`}
          style={{ height }}
        />
      );
    }

    return bars;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Connection Status</h2>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">EIP v{EIP_PROTOCOL_VERSION}</span>
          <div className={`w-3 h-3 rounded-full ${getStatusColor()} transition-colors duration-300`} />
        </div>
      </div>

      {/* Status Display */}
      <div className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Status:</span>
          <span className={`text-sm font-semibold ${
            isConnected ? 'text-green-600' : 
            isListening ? 'text-yellow-600' : 
            'text-gray-600'
          }`}>
            {getStatusText()}
          </span>
        </div>

        {/* Wallet Address */}
        <div className="space-y-1">
          <span className="text-sm font-medium text-gray-600">Wallet Address:</span>
          <div className="bg-gray-50 rounded p-2 border">
            <code className="text-xs font-mono text-gray-800 break-all">
              {walletAddress}
            </code>
          </div>
        </div>

        {/* Audio Level Indicator */}
        {isListening && (
          <div className="space-y-2">
            <span className="text-sm font-medium text-gray-600">Audio Level:</span>
            <div className="flex items-end space-x-1 h-8 text-green-500">
              {getAudioLevelBars()}
            </div>
            <div className="text-xs text-gray-500">
              Level: {(displayLevel * 100).toFixed(1)}%
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex space-x-3">
          {!isListening ? (
            <button
              onClick={onStartListening}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 font-medium"
              disabled={isTransmitting}
            >
              Start Listening
            </button>
          ) : (
            <button
              onClick={onStopListening}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors duration-200 font-medium"
              disabled={isTransmitting}
            >
              Stop Listening
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <h4 className="text-sm font-medium text-blue-800 mb-1">Instructions:</h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Place devices 1-2 meters apart</li>
            <li>• Ensure quiet environment for best results</li>
            <li>• Use moderate volume (50-70%)</li>
            <li>• Allow microphone access when prompted</li>
          </ul>
        </div>

        {/* Warning */}
        <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
          <div className="flex items-center space-x-2">
            <span className="text-orange-600 text-lg">⚠️</span>
            <div>
              <h4 className="text-sm font-medium text-orange-800">Test Environment</h4>
              <p className="text-xs text-orange-700">
                This is a test offline wallet. Never use with real funds or production keys.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}