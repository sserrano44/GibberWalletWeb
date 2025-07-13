import { EventEmitter } from 'events';
import { GGWaveModule, GGWaveInstance } from '@/types/ggwave';
import { EIP_AUDIO_CONFIG } from '@/config/audio-config';
import { 
  EIPMessage, 
  validateEIPMessage, 
  isVersionSupported, 
  createEIPMessage,
  EIP_PROTOCOL_VERSION 
} from '@/config/eip-config';
import shortUuid from 'short-uuid';

const translator = shortUuid();

// Helper function to convert array types
function convertTypedArray(src: any, type: any) {
  const buffer = new ArrayBuffer(src.byteLength);
  new src.constructor(buffer).set(src);
  return new type(buffer);
}

export interface EIPAudioProtocolEvents {
  'eip-message': (message: EIPMessage) => void;
  'listening': (isListening: boolean) => void;
  'transmitting': (isTransmitting: boolean) => void;
  'audioLevel': (level: number) => void;
  'error': (error: Error) => void;
  'version-mismatch': (receivedVersion: string, supportedVersion: string) => void;
}

export class EIPAudioProtocol extends EventEmitter {
  private context: AudioContext | null = null;
  private ggwave: GGWaveModule | null = null;
  private instance: GGWaveInstance | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isListening = false;
  private isTransmitting = false;
  private analyser: AnalyserNode | null = null;
  private chunkStorage: Map<string, EIPMessage[]> = new Map();

  constructor() {
    super();
  }

  /**
   * Initialize audio context and ggwave with EIP-compliant settings
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('DEBUG: Starting EIP audio initialization...');
      
      // Initialize audio context with EIP-compliant sample rate
      if (!this.context) {
        console.log('DEBUG: Creating AudioContext with EIP sample rate 44100 Hz...');
        this.context = new AudioContext({ sampleRate: EIP_AUDIO_CONFIG.buffers.sampleRate });
        console.log('DEBUG: AudioContext created with state:', this.context.state);
      }

      // Initialize ggwave if not already done
      if (!this.ggwave) {
        console.log('DEBUG: Checking for ggwave_factory...');
        
        if (window && (window as any).ggwave_factory) {
          console.log('DEBUG: Initializing ggwave for EIP compliance...');
          this.ggwave = await (window as any).ggwave_factory();
          
          if (!this.ggwave) {
            throw new Error('Failed to initialize ggwave');
          }
          
          console.log('DEBUG: Getting EIP-compliant parameters...');
          const parameters = this.ggwave.getDefaultParameters();
          
          // Set EIP-compliant parameters
          parameters.sampleRateInp = this.context.sampleRate;
          parameters.sampleRateOut = this.context.sampleRate;
          parameters.soundMarkerThreshold = EIP_AUDIO_CONFIG.ggwave.soundMarkerThreshold;
          
          console.log('DEBUG: Creating ggwave instance with EIP parameters...');
          this.instance = this.ggwave.init(parameters);
          console.log('DEBUG: EIP ggwave instance created:', this.instance);
        } else {
          throw new Error('ggwave_factory not available');
        }
      }

      const isInitialized = !!(this.context && this.ggwave && this.instance !== null);
      console.log('DEBUG: EIP audio initialization complete:', isInitialized);
      return isInitialized;
    } catch (error) {
      console.error('DEBUG: Failed to initialize EIP audio:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Start listening for EIP audio messages
   */
  async startListening(): Promise<boolean> {
    if (this.isListening || !await this.initialize()) {
      return false;
    }

    try {
      // Check if we're in a secure context
      if (!window.isSecureContext) {
        throw new Error('Microphone access requires HTTPS. Please use https://localhost:3000 or deploy to a secure server.');
      }
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      });

      this.mediaStream = stream;

      if (!this.context) {
        throw new Error('Audio context not initialized');
      }

      // Resume audio context if suspended
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      // Create audio processing nodes with EIP-compliant settings
      this.mediaStreamSource = this.context.createMediaStreamSource(stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = EIP_AUDIO_CONFIG.buffers.fftSize;

      const bufferSize = EIP_AUDIO_CONFIG.buffers.scriptProcessorSize;
      this.processor = this.context.createScriptProcessor(bufferSize, 1, 1);

      // Set up EIP-compliant audio processing
      this.processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.ggwave || this.instance === null) {
          console.error('Audio processing failed: ggwave not initialized');
          return;
        }

        const inputBuffer = e.inputBuffer.getChannelData(0);
        
        // Calculate audio level
        let maxLevel = 0;
        for (let i = 0; i < inputBuffer.length; i++) {
          maxLevel = Math.max(maxLevel, Math.abs(inputBuffer[i]));
        }
        this.emit('audioLevel', maxLevel);

        // Try to decode audio using EIP protocol
        try {
          const result = this.ggwave.decode(
            this.instance,
            convertTypedArray(new Float32Array(inputBuffer), Int8Array)
          );

          if (result && result.length > 0) {
            const text = new TextDecoder("utf-8").decode(result);
            console.log('EIP MESSAGE RECEIVED!', text);
            
            try {
              const messageData = JSON.parse(text);
              if (validateEIPMessage(messageData)) {
                this.handleEIPMessage(messageData as EIPMessage);
              } else {
                console.error('Invalid EIP message format:', messageData);
              }
            } catch (parseError) {
              // Check if this might be a truncated chunk message
              if (text.includes('"type":"chunk"') && text.length >= 140) {
                console.log('Received truncated chunk message due to ggwave 140-byte limit');
                console.log(`Truncated text (${text.length} chars):`, text);
                console.log('Waiting for complete chunk transmission...');
              } else if (text.includes('"type":"connect_response"') && text.length >= 140) {
                console.log('Received truncated connect_response message due to ggwave 140-byte limit');
                console.log(`Truncated text (${text.length} chars):`, text);
                console.log('This should have been chunked automatically...');
              } else {
                console.error('Failed to parse EIP message:', parseError);
                console.error('Message text:', text);
              }
            }
          }
        } catch (decodeError) {
          // Normal - most audio doesn't contain ggwave data
          if (!(decodeError as Error).message.includes('Cannot pass non-string')) {
            console.error('Decode error:', decodeError);
          }
        }
      };

      // Connect audio nodes properly to avoid echo but enable processing
      this.mediaStreamSource.connect(this.analyser);
      this.mediaStreamSource.connect(this.processor);
      
      // Connect processor to a dummy gain node instead of destination to avoid echo
      // This enables the onaudioprocess event without creating feedback
      const dummyGain = this.context.createGain();
      dummyGain.gain.value = 0; // Silent - no audio output
      this.processor.connect(dummyGain);
      dummyGain.connect(this.context.destination);

      this.isListening = true;
      this.emit('listening', true);
      console.log('EIP Audio Protocol: Started listening for messages');
      return true;

    } catch (error) {
      console.error('Failed to start EIP listening:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Stop listening for EIP audio messages
   */
  stopListening(): void {
    if (!this.isListening) return;

    // Disconnect audio nodes
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.analyser = null;
    this.isListening = false;
    this.emit('listening', false);
    console.log('EIP Audio Protocol: Stopped listening');
  }

  /**
   * Send an EIP-compliant audio message
   */
  async sendEIPMessage(message: EIPMessage): Promise<boolean> {
    if (!await this.initialize() || !this.context || !this.ggwave || this.instance === null) {
      console.error('Failed to send EIP audio message: not initialized');
      return false;
    }

    const messageText = JSON.stringify(message);
    
    // Check if message needs chunking (140 bytes is ggwave limit for Normal protocol)
    if (messageText.length > 120) { // Use 120 to be safe
      return await this.sendChunkedEIPMessage(message);
    }

    return await this.sendSingleEIPMessage(messageText);
  }

  /**
   * Send a single EIP message without chunking
   */
  private async sendSingleEIPMessage(messageText: string): Promise<boolean> {
    try {
      this.isTransmitting = true;
      this.emit('transmitting', true);

      console.log('Sending EIP audio message:', messageText);

      // Encode message to audio using EIP-compliant protocol
      const waveform = this.ggwave!.encode(
        this.instance!,
        messageText,
        EIP_AUDIO_CONFIG.ggwave.protocol, // Use EIP-compliant protocol
        EIP_AUDIO_CONFIG.ggwave.volumeLevel // Use EIP-compliant volume
      );

      // Convert to Float32Array for Web Audio API
      const audioBuffer = convertTypedArray(waveform, Float32Array);
      
      // Create audio buffer with EIP sample rate
      const buffer = this.context!.createBuffer(1, audioBuffer.length, this.context!.sampleRate);
      buffer.getChannelData(0).set(audioBuffer);
      
      // Create and play buffer source
      const source = this.context!.createBufferSource();
      source.buffer = buffer;

      // Connect directly to destination for transmission (no feedback loop)
      source.connect(this.context!.destination);

      // Wait for transmission to complete
      return new Promise((resolve, reject) => {
        // Set a timeout as fallback in case onended doesn't fire
        const timeoutId = setTimeout(() => {
          console.log('Audio transmission timeout - assuming completed');
          this.isTransmitting = false;
          this.emit('transmitting', false);
          resolve(true);
        }, 10000); // 10 second timeout

        source.onended = () => {
          clearTimeout(timeoutId);
          console.log('Audio transmission completed');
          this.isTransmitting = false;
          this.emit('transmitting', false);
          resolve(true);
        };

        try {
          // Play the audio
          source.start(0);
        } catch (error) {
          clearTimeout(timeoutId);
          console.error('Audio transmission start error:', error);
          this.isTransmitting = false;
          this.emit('transmitting', false);
          reject(error);
        }
      });

    } catch (error) {
      console.error('Failed to send EIP audio message:', error);
      this.isTransmitting = false;
      this.emit('transmitting', false);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Send a message in chunks for EIP compliance
   */
  private async sendChunkedEIPMessage(message: EIPMessage): Promise<boolean> {
    try {
      console.log('EIP message too large, chunking into smaller pieces...');
      const messageText = JSON.stringify(message);
      const chunkSize = 80; // Conservative chunk size for ggwave Normal protocol
      const chunks: string[] = [];
      
      // Split message into chunks
      for (let i = 0; i < messageText.length; i += chunkSize) {
        chunks.push(messageText.substring(i, i + chunkSize));
      }
      
      console.log(`Sending ${chunks.length} chunks for EIP message ${message.id}`);
      
      // Stop listening completely during chunk transmission to avoid interference
      const wasListening = this.isListening;
      if (wasListening) {
        console.log('Stopping audio listening during chunk transmission...');
        this.stopListening();
      }
      
      try {
        // Send each chunk as a separate message
        for (let i = 0; i < chunks.length; i++) {
          const chunkMessage = {
            version: message.version,
            type: 'chunk' as const,
            payload: {
              originalMessageId: message.id,
              originalType: message.type,
              chunkIndex: i,
              totalChunks: chunks.length,
              chunkData: chunks[i]
            },
            id: translator.new()
          };
          
          const chunkText = JSON.stringify(chunkMessage);
          console.log(`Sending EIP chunk ${i + 1}/${chunks.length}: ${chunkText.length} bytes`);
          
          // Wait for this chunk transmission to complete before starting the next one
          const success = await this.sendSingleEIPMessage(chunkText);
          if (!success) {
            throw new Error(`Failed to send EIP chunk ${i + 1}`);
          }
          
          console.log(`EIP chunk ${i + 1}/${chunks.length} transmission completed`);
          
          // Add a buffer delay between chunks after transmission completes
          if (i < chunks.length - 1) { // Don't delay after the last chunk
            console.log('Waiting before next chunk...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        console.log('All EIP chunks sent successfully');
        return true;
        
      } finally {
        // Resume audio listening after chunk transmission
        if (wasListening) {
          console.log('Restarting audio listening after chunk transmission...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer before resuming
          await this.startListening();
        }
      }
      
    } catch (error) {
      console.error('Failed to send chunked EIP message:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Handle received EIP message with version validation
   */
  private handleEIPMessage(message: EIPMessage): void {
    console.log('Processing EIP message:', message.type, 'version:', message.version);

    // Validate version
    if (!isVersionSupported(message.version)) {
      console.warn('Unsupported EIP protocol version:', message.version);
      this.emit('version-mismatch', message.version, EIP_PROTOCOL_VERSION);
      
      // Send error response for version mismatch
      const errorMessage = createEIPMessage('error', {
        message: `Unsupported protocol version: ${message.version}`,
        received_id: message.id
      });
      
      this.sendEIPMessage(errorMessage);
      return;
    }

    // Handle chunk messages
    if (message.type === 'chunk') {
      this.handleChunk(message);
      return;
    }

    // Emit the validated EIP message
    this.emit('eip-message', message);
  }

  /**
   * Handle a chunk message and reassemble if complete
   */
  private handleChunk(chunk: EIPMessage): void {
    const { originalMessageId, chunkIndex, totalChunks, chunkData, originalType } = chunk.payload;
    
    console.log(`Received EIP chunk ${chunkIndex + 1}/${totalChunks} for message ${originalMessageId}`);
    
    // Get or create chunk storage for this message
    if (!this.chunkStorage.has(originalMessageId)) {
      this.chunkStorage.set(originalMessageId, []);
    }
    
    const chunks = this.chunkStorage.get(originalMessageId)!;
    chunks.push(chunk);
    
    // Check if we have all chunks
    if (chunks.length === totalChunks) {
      console.log(`All EIP chunks received for message ${originalMessageId}, reassembling...`);
      
      // Sort chunks by index
      chunks.sort((a, b) => a.payload.chunkIndex - b.payload.chunkIndex);
      
      // Reassemble the message data
      const reassembledData = chunks
        .map(c => c.payload.chunkData)
        .join('');
      
      try {
        const originalMessage = JSON.parse(reassembledData) as EIPMessage;
        console.log('Successfully reassembled EIP chunked message:', originalMessage.type);
        this.chunkStorage.delete(originalMessageId);
        this.emit('eip-message', originalMessage);
      } catch (error) {
        console.error('Failed to reassemble EIP chunked message:', error);
        this.chunkStorage.delete(originalMessageId);
      }
    }
  }

  /**
   * Wait for a specific EIP message type with timeout
   */
  async waitForEIPMessage(expectedType: string, timeout?: number): Promise<EIPMessage | null> {
    const effectiveTimeout = timeout || EIP_AUDIO_CONFIG.timeouts.messageWait;
    
    return new Promise((resolve) => {
      let timeoutId: NodeJS.Timeout;
      
      const messageHandler = (message: EIPMessage) => {
        if (message.type === expectedType) {
          clearTimeout(timeoutId);
          this.off('eip-message', messageHandler);
          resolve(message);
        }
      };

      this.on('eip-message', messageHandler);

      timeoutId = setTimeout(() => {
        this.off('eip-message', messageHandler);
        console.log(`EIP timeout waiting for ${expectedType} after ${effectiveTimeout}ms`);
        resolve(null);
      }, effectiveTimeout);
    });
  }

  /**
   * Get current audio level (0-1)
   */
  getAudioLevel(): number {
    if (!this.analyser) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    return average / 255;
  }

  /**
   * Check if listening for messages
   */
  getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Check if transmitting message
   */
  getIsTransmitting(): boolean {
    return this.isTransmitting;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopListening();
    
    if (this.context && this.context.state !== 'closed') {
      this.context.close();
      this.context = null;
    }

    this.ggwave = null;
    this.instance = null;
    this.chunkStorage.clear();
    this.removeAllListeners();
  }
}