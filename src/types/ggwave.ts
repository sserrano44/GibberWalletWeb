export interface GGWaveParameters {
  sampleRateInp: number;
  sampleRateOut: number;
  samplesPerFrame: number;
  soundMarkerThreshold: number;
  markerFrames: number;
  encoderFrameSize: number;
  decoderFrameSize: number;
}

export interface GGWaveModule {
  init: (parameters: GGWaveParameters) => GGWaveInstance;
  getDefaultParameters: () => GGWaveParameters;
  encode: (instance: GGWaveInstance, text: string, protocolId: number, volume: number) => Int8Array;
  decode: (instance: GGWaveInstance, data: Int8Array) => Uint8Array | null;
  ProtocolId: {
    GGWAVE_PROTOCOL_AUDIBLE_NORMAL: number;
    GGWAVE_PROTOCOL_AUDIBLE_FAST: number;
    GGWAVE_PROTOCOL_AUDIBLE_FASTEST: number;
    GGWAVE_PROTOCOL_ULTRASOUND_NORMAL: number;
    GGWAVE_PROTOCOL_ULTRASOUND_FAST: number;
    GGWAVE_PROTOCOL_ULTRASOUND_FASTEST: number;
  };
}

export type GGWaveInstance = number;

declare global {
  interface Window {
    ggwave_factory?: () => Promise<GGWaveModule>;
  }
}