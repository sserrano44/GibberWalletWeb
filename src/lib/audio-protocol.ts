import { EventEmitter } from 'events';
import { Message, MessageProtocol, MessageType } from './message-protocol';
import { GGWaveModule, GGWaveInstance } from '@/types/ggwave';
import { DEFAULT_AUDIO_CONFIG, getDynamicTimeout, AudioConfig, shouldChunkMessage } from '@/config/audio-config';

// Helper function to convert array types
function convertTypedArray(src: any, type: any) {
  const buffer = new ArrayBuffer(src.byteLength);
  new src.constructor(buffer).set(src);
  return new type(buffer);
}

export interface AudioProtocolEvents {
  'message': (message: Message) => void;
  'listening': (isListening: boolean) => void;
  'transmitting': (isTransmitting: boolean) => void;
  'audioLevel': (level: number) => void;
  'error': (error: Error) => void;
}

export class AudioProtocol extends EventEmitter {
  private context: AudioContext | null = null;
  private ggwave: GGWaveModule | null = null;
  private instance: GGWaveInstance | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isListening = false;
  private isTransmitting = false;
  private analyser: AnalyserNode | null = null;
  private config: AudioConfig;
  private chunkStorage: Map<string, Message[]> = new Map();

  constructor(config: AudioConfig = DEFAULT_AUDIO_CONFIG) {
    super();
    this.config = config;
  }

  /**
   * Initialize audio context and ggwave
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('DEBUG: Starting audio initialization...');
      
      // Initialize audio context
      if (!this.context) {
        console.log('DEBUG: Creating AudioContext...');
        this.context = new AudioContext({ sampleRate: this.config.buffers.sampleRate });
        console.log('DEBUG: AudioContext created with state:', this.context.state);
      }

      // Initialize ggwave if not already done
      if (!this.ggwave) {
        console.log('DEBUG: Checking for ggwave_factory...');
        console.log('DEBUG: Window object exists:', !!window);
        console.log('DEBUG: ggwave_factory exists:', !!(window as any).ggwave_factory);
        
        if (window && (window as any).ggwave_factory) {
          console.log('DEBUG: Initializing ggwave...');
          this.ggwave = await (window as any).ggwave_factory();
          console.log('DEBUG: ggwave factory result:', this.ggwave);
          
          if (!this.ggwave) {
            throw new Error('Failed to initialize ggwave');
          }
          
          console.log('DEBUG: Getting default parameters...');
          const parameters = this.ggwave.getDefaultParameters();
          console.log('DEBUG: Default parameters:', parameters);
          
          parameters.sampleRateInp = this.context.sampleRate;
          parameters.sampleRateOut = this.context.sampleRate;
          parameters.soundMarkerThreshold = this.config.ggwave.soundMarkerThreshold;
          
          console.log('DEBUG: Creating ggwave instance...');
          this.instance = this.ggwave.init(parameters);
          console.log('DEBUG: ggwave instance created:', this.instance);
          console.log('ggwave initialized for web', { instance: this.instance, ggwave: this.ggwave });
        } else {
          console.error('DEBUG: ggwave_factory not available on window object');
          throw new Error('ggwave_factory not available');
        }
      }

      const isInitialized = !!(this.context && this.ggwave && this.instance !== null);
      console.log('DEBUG: Audio initialization complete:', isInitialized);
      return isInitialized;
    } catch (error) {
      console.error('DEBUG: Failed to initialize audio:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Start listening for audio messages
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
      
      // Check if mediaDevices is available
      if (!navigator.mediaDevices) {
        throw new Error('navigator.mediaDevices is not available. This may be due to an insecure context or browser compatibility.');
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

      // Create audio processing nodes
      this.mediaStreamSource = this.context.createMediaStreamSource(stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = this.config.buffers.fftSize;

      const bufferSize = this.config.buffers.scriptProcessorSize;
      this.processor = this.context.createScriptProcessor(bufferSize, 1, 1);

      // Set up audio processing
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

        // Try to decode audio
        try {
          const result = this.ggwave.decode(
            this.instance,
            convertTypedArray(new Float32Array(inputBuffer), Int8Array)
          );

          if (result && result.length > 0) {
            const text = new TextDecoder("utf-8").decode(result);
            console.log('MESSAGE RECEIVED!', text);
            
            try {
              const message = Message.fromJSON(text);
              this.handleReceivedMessage(message);
            } catch (parseError) {
              console.error('Failed to parse message:', parseError);
            }
          }
        } catch (decodeError) {
          // Normal - most audio doesn't contain ggwave data
          if (!(decodeError as Error).message.includes('Cannot pass non-string')) {
            console.error('Decode error:', decodeError);
          }
        }
      };

      // Connect audio nodes (NO connection to destination to avoid echo)
      this.mediaStreamSource.connect(this.analyser);
      this.mediaStreamSource.connect(this.processor);
      // DO NOT connect processor to destination - this causes echo/feedback

      this.isListening = true;
      this.emit('listening', true);
      return true;

    } catch (error) {
      console.error('Failed to start listening:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Stop listening for audio messages
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
  }

  /**
   * Send an audio message
   */
  async sendMessage(message: Message): Promise<boolean> {
    if (!await this.initialize() || !this.context || !this.ggwave || this.instance === null) {
      console.error('Failed to send audio message: not initialized');
      return false;
    }

    const messageText = message.toJSON();
    
    // Check if message needs chunking
    if (shouldChunkMessage(messageText.length, this.config)) {
      return await this.sendChunkedMessage(message);
    }

    return await this.sendSingleMessage(message);
  }

  /**
   * Send a single message without chunking
   */
  private async sendSingleMessage(message: Message): Promise<boolean> {
    try {
      this.isTransmitting = true;
      this.emit('transmitting', true);

      const messageText = message.toJSON();
      console.log('Sending audio message:', messageText);

      // Encode message to audio using AUDIBLE_FAST protocol
      const waveform = this.ggwave!.encode(
        this.instance!,
        messageText,
        this.config.ggwave.protocol,
        this.config.ggwave.volumeLevel
      );

      // Convert to Float32Array for Web Audio API
      const audioBuffer = convertTypedArray(waveform, Float32Array);
      
      // Create audio buffer
      const buffer = this.context!.createBuffer(1, audioBuffer.length, this.context!.sampleRate);
      buffer.getChannelData(0).set(audioBuffer);
      
      // Create and play buffer source
      const source = this.context!.createBufferSource();
      source.buffer = buffer;

      // Connect directly to destination for transmission (no feedback loop)
      source.connect(this.context!.destination);

      // Play the audio
      source.start(0);

      // Handle completion
      source.onended = () => {
        this.isTransmitting = false;
        this.emit('transmitting', false);
      };

      return true;

    } catch (error) {
      console.error('Failed to send audio message:', error);
      this.isTransmitting = false;
      this.emit('transmitting', false);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Send a message in chunks
   */
  private async sendChunkedMessage(message: Message): Promise<boolean> {
    try {
      console.log('Message too large, chunking into smaller pieces...');
      const chunks = MessageProtocol.chunkMessage(message, this.config.chunking.chunkSize);
      
      console.log(`Sending ${chunks.length} chunks for message ${message.id}`);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Sending chunk ${i + 1}/${chunks.length}`);
        
        if (!await this.sendSingleMessage(chunk)) {
          throw new Error(`Failed to send chunk ${i + 1}`);
        }
        
        // Add delay between chunks to avoid overwhelming the receiver
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('All chunks sent successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to send chunked message:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Handle received message (including chunked messages)
   */
  private handleReceivedMessage(message: Message): void {
    if (message.type === MessageType.CHUNK) {
      this.handleChunk(message);
    } else {
      this.emit('message', message);
    }
  }

  /**
   * Handle a chunk message
   */
  private handleChunk(chunk: Message): void {
    const { originalMessageId, chunkIndex, totalChunks } = chunk.payload;
    
    // Get or create chunk storage for this message
    if (!this.chunkStorage.has(originalMessageId)) {
      this.chunkStorage.set(originalMessageId, []);
    }
    
    const chunks = this.chunkStorage.get(originalMessageId)!;
    chunks.push(chunk);
    
    console.log(`Received chunk ${chunkIndex + 1}/${totalChunks} for message ${originalMessageId}`);
    
    // Check if we have all chunks
    if (chunks.length === totalChunks) {
      console.log(`All chunks received for message ${originalMessageId}, reassembling...`);
      
      const originalMessage = MessageProtocol.reassembleChunks(chunks);
      if (originalMessage) {
        console.log('Successfully reassembled chunked message');
        this.chunkStorage.delete(originalMessageId);
        this.emit('message', originalMessage);
      } else {
        console.error('Failed to reassemble chunked message');
        this.chunkStorage.delete(originalMessageId);
      }
    }
  }

  /**
   * Wait for a specific message type
   */
  async waitForMessage(expectedType: string, timeout?: number): Promise<Message | null> {
    const effectiveTimeout = timeout || this.config.timeouts.messageWait;
    return new Promise((resolve) => {
      let timeoutId: NodeJS.Timeout;
      
      const messageHandler = (message: Message) => {
        if (message.type === expectedType) {
          clearTimeout(timeoutId);
          this.off('message', messageHandler);
          resolve(message);
        }
      };

      this.on('message', messageHandler);

      timeoutId = setTimeout(() => {
        this.off('message', messageHandler);
        console.log(`Timeout waiting for ${expectedType} after ${effectiveTimeout}ms`);
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