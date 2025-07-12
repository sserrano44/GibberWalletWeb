'use client';

import { useState, useEffect } from 'react';
import { EIPAudioProtocol } from '@/lib/eip-audio-protocol';
import { TestWallet } from '@/lib/test-wallet';
import { createEIPMessage } from '@/config/eip-config';

export default function TestAudioPage() {
  const [protocol, setProtocol] = useState<EIPAudioProtocol | null>(null);
  const [wallet, setWallet] = useState<TestWallet | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    const initializeProtocol = async () => {
      try {
        const audioProtocol = new EIPAudioProtocol();
        const testWallet = new TestWallet();
        
        const success = await audioProtocol.initialize();
        if (success) {
          setProtocol(audioProtocol);
          setWallet(testWallet);
          setIsInitialized(true);
          addLog('Audio protocol initialized successfully');
          
          audioProtocol.on('transmitting', (transmitting: boolean) => {
            setIsTransmitting(transmitting);
            addLog(`Transmission ${transmitting ? 'started' : 'ended'}`);
          });
          
          audioProtocol.on('listening', (listening: boolean) => {
            setIsListening(listening);
            addLog(`Audio listening ${listening ? 'started' : 'stopped'}`);
          });
        } else {
          addLog('Failed to initialize audio protocol');
        }
      } catch (error) {
        addLog(`Initialization error: ${error}`);
      }
    };

    initializeProtocol();

    return () => {
      if (protocol) {
        protocol.destroy();
      }
    };
  }, []);

  const transmitConnectResponse = async () => {
    if (!protocol || !wallet || !isInitialized) {
      addLog('Protocol not initialized');
      return;
    }

    try {
      addLog('Creating connect_response for test message...');
      
      // Create the connect_response for the specific connect message
      const connectResponse = createEIPMessage('connect_response', {
        address: wallet.getAddress(),
        received_id: '1b4c0b49-4d87-4ba5-8362-a0b16abed04e' // The ID from the test connect message
      });

      const responseText = JSON.stringify(connectResponse);
      addLog(`Connect response created: ${responseText.length} bytes`);
      addLog(`Response content: ${responseText}`);
      
      if (responseText.length > 120) {
        addLog('Message will be chunked (>120 bytes)');
      } else {
        addLog('Message will be sent as single transmission');
      }

      addLog('Starting transmission...');
      const success = await protocol.sendEIPMessage(connectResponse);
      
      if (success) {
        addLog('Connect response transmitted successfully');
      } else {
        addLog('Failed to transmit connect response');
      }
    } catch (error) {
      addLog(`Transmission error: ${error}`);
    }
  };

  const clearLog = () => {
    setLog([]);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Audio Test - Connect Response Transmission
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Information</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Test Message ID:</strong> 1b4c0b49-4d87-4ba5-8362-a0b16abed04e</p>
            <p><strong>Protocol:</strong> EIP v1.0 with ggwave Fast protocol</p>
            <p><strong>Purpose:</strong> Isolated transmission test for connect_response</p>
            <p><strong>Wallet Address:</strong> {wallet?.getAddress() || 'Loading...'}</p>
            <p><strong>UUID Format:</strong> Now using short-uuid for smaller message sizes</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Controls</h2>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className={`w-3 h-3 rounded-full ${isInitialized ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm">
                Protocol Status: {isInitialized ? 'Ready' : 'Initializing...'}
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <div className={`w-3 h-3 rounded-full ${isTransmitting ? 'bg-yellow-500 animate-pulse' : 'bg-gray-300'}`}></div>
              <span className="text-sm">
                Transmission: {isTransmitting ? 'Active' : 'Idle'}
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
              <span className="text-sm">
                Audio Listening: {isListening ? 'Active' : 'Stopped'}
              </span>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={transmitConnectResponse}
                disabled={!isInitialized || isTransmitting}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium"
              >
                {isTransmitting ? 'Transmitting...' : 'Transmit Connect Response'}
              </button>
              
              <button
                onClick={clearLog}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
              >
                Clear Log
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Transmission Log</h2>
          <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto">
            {log.length === 0 ? (
              <p className="text-gray-500 italic">No log entries yet...</p>
            ) : (
              <div className="space-y-1">
                {log.map((entry, index) => (
                  <div key={index} className="text-sm font-mono text-gray-700">
                    {entry}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Instructions</h3>
          <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1">
            <li>Wait for the protocol to initialize (green status indicator)</li>
            <li>Click "Transmit Connect Response" to send the test message</li>
            <li>Listen carefully to the audio transmission</li>
            <li>Check the log for transmission details and chunking information</li>
            <li>Note any audio artifacts, overlapping, or unusual sounds</li>
          </ol>
        </div>
      </div>
    </div>
  );
}