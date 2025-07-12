'use client';

import { AudioStatus } from '@/types/wallet';

interface AudioControlsProps {
  audioStatus: AudioStatus;
  onStartListening: () => void;
  onStopListening: () => void;
}

export default function AudioControls({ 
  audioStatus, 
  onStartListening, 
  onStopListening 
}: AudioControlsProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Audio Controls</h2>
      
      <div className="space-y-4">
        {/* Control Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={onStartListening}
            disabled={audioStatus.isListening}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {audioStatus.isListening ? 'Listening...' : 'Start Listening'}
          </button>
          
          <button
            onClick={onStopListening}
            disabled={!audioStatus.isListening}
            className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Stop Listening
          </button>
        </div>

        {/* Audio Status Info */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Audio Status</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Listening:</span>
              <span className={audioStatus.isListening ? 'text-green-600' : 'text-gray-400'}>
                {audioStatus.isListening ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Transmitting:</span>
              <span className={audioStatus.isTransmitting ? 'text-blue-600' : 'text-gray-400'}>
                {audioStatus.isTransmitting ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Audio Level:</span>
              <span className="text-gray-600">
                {Math.round(audioStatus.level * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 p-4 rounded-md">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Instructions</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Click &quot;Start Listening&quot; to enable microphone access</li>
            <li>• Make sure your offline wallet is running</li>
            <li>• Keep devices close together (1-2 meters)</li>
            <li>• Avoid background noise during transmission</li>
          </ul>
        </div>

        {/* Transmission Activity */}
        {(audioStatus.isListening || audioStatus.isTransmitting) && (
          <div className="flex items-center justify-center space-x-2 py-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              audioStatus.isTransmitting ? 'bg-blue-500' : 'bg-green-500'
            }`} />
            <span className="text-sm text-gray-600">
              {audioStatus.isTransmitting ? 'Sending audio data...' : 'Waiting for audio data...'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}