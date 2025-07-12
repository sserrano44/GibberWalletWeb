declare global {
  interface Window {
    ggwave_factory: () => Promise<GGWaveModule>;
  }
}

export interface GGWaveParameters {
  payloadLength: number;
  sampleRateInp: number;
  sampleRateOut: number;
  sampleRate: number;
  samplesPerFrame: number;
  soundMarkerThreshold: number;
  sampleFormatInp: any;
  sampleFormatOut: any;
  operatingMode: number;
}

export interface GGWaveInstance {
  [key: string]: any;
}

export interface GGWaveProtocolId {
  GGWAVE_PROTOCOL_AUDIBLE_NORMAL: number;
  GGWAVE_PROTOCOL_AUDIBLE_FAST: number;
  GGWAVE_PROTOCOL_AUDIBLE_FASTEST: number;
  GGWAVE_PROTOCOL_ULTRASOUND_NORMAL: number;
  GGWAVE_PROTOCOL_ULTRASOUND_FAST: number;
  GGWAVE_PROTOCOL_ULTRASOUND_FASTEST: number;
  GGWAVE_PROTOCOL_DT_NORMAL: number;
  GGWAVE_PROTOCOL_DT_FAST: number;
  GGWAVE_PROTOCOL_DT_FASTEST: number;
}

export interface GGWaveModule {
  getDefaultParameters(): GGWaveParameters;
  init(params: GGWaveParameters): GGWaveInstance;
  encode(instance: GGWaveInstance, message: string, protocol: number, volume: number): Int8Array;
  decode(instance: GGWaveInstance, samples: Int8Array): Uint8Array | null;
  ProtocolId: GGWaveProtocolId;
}

export {};