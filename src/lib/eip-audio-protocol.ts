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
              console.error('Failed to parse EIP message:', parseError);
            }
          }
        } catch (decodeError) {
          // Normal - most audio doesn't contain ggwave data
          if (!(decodeError as Error).message.includes('Cannot pass non-string')) {
            console.error('Decode error:', decodeError);
          }
        }
      };

      // Connect audio nodes
      this.mediaStreamSource.connect(this.analyser);
      this.mediaStreamSource.connect(this.processor);
      this.processor.connect(this.context.destination);

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

    try {
      this.isTransmitting = true;
      this.emit('transmitting', true);

      const messageText = JSON.stringify(message);
      console.log('Sending EIP audio message:', messageText);

      // Encode message to audio using EIP-compliant protocol
      const waveform = this.ggwave.encode(
        this.instance,
        messageText,
        EIP_AUDIO_CONFIG.ggwave.protocol, // Use EIP-compliant protocol
        EIP_AUDIO_CONFIG.ggwave.volumeLevel // Use EIP-compliant volume
      );

      // Convert to Float32Array for Web Audio API
      const audioBuffer = convertTypedArray(waveform, Float32Array);
      
      // Create audio buffer with EIP sample rate
      const buffer = this.context.createBuffer(1, audioBuffer.length, this.context.sampleRate);
      buffer.getChannelData(0).set(audioBuffer);
      
      // Create and play buffer source
      const source = this.context.createBufferSource();
      source.buffer = buffer;

      // Connect through analyser if available
      if (this.analyser) {
        source.connect(this.analyser);
        this.analyser.connect(this.context.destination);
      } else {
        source.connect(this.context.destination);
      }

      // Play the audio
      source.start(0);

      // Handle completion
      source.onended = () => {
        this.isTransmitting = false;
        this.emit('transmitting', false);
      };

      return true;

    } catch (error) {
      console.error('Failed to send EIP audio message:', error);
      this.isTransmitting = false;
      this.emit('transmitting', false);
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

    // Emit the validated EIP message
    this.emit('eip-message', message);
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
    this.removeAllListeners();
  }
}