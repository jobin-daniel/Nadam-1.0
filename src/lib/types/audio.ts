export interface EqBands {
  31: number;
  62: number;
  125: number;
  250: number;
  500: number;
  1000: number;
  2000: number;
  4000: number;
  8000: number;
  16000: number;
}

export type VoicePreset = 'podcast' | 'lecture' | 'noisy' | 'music' | 'custom';
export type EqPreset =
  | 'flat'
  | 'bass_boost'
  | 'treble_boost'
  | 'vocal_boost'
  | 'speech_clarity'
  | 'loudness'
  | 'reduce_muddiness'
  | 'custom';

export interface AudioEditSettings {
  // 1. Voice Enhance
  voiceEnhance: {
    enabled: boolean;
    intensity: number; // 0 to 1.0 (0% - 100%)
    highpassFreq: number; // default: 80 Hz
    noiseReductionStrength: number; // 0 to 1.0
    presenceBoostDb: number; // 0 to +6 dB at ~3 kHz
    deEsserCutDb: number; // 0 to -6 dB at ~8 kHz
    compressionRatio: number; // default: 3.5:1
    normalizeTargetLufs: number; // e.g. -16 LUFS
    preset: VoicePreset;
  };

  // 2. 10-Band Graphic Equalizer (±12 dB)
  equalizer: {
    enabled: boolean;
    bands: EqBands;
    preset: EqPreset | string;
  };

  // 3. Playback Speed & Pitch
  speedPitch: {
    speed: number; // 0.25 to 4.0 (step 0.05)
    preservePitch: boolean;
    pitchSemitones: number; // -12 to +12 semitones
  };

  // 4. Quick Tone Controls
  tone: {
    bassBoostDb: number; // -12 to +12 dB
    trebleBoostDb: number; // -12 to +12 dB
  };

  // 5. Volume & Dynamics
  volume: {
    gainDb: number; // -20 to +20 dB
    peakNormalize: boolean;
  };

  // 6. Trimming & Fades
  trim: {
    enabled: boolean;
    startSeconds: number;
    endSeconds: number;
  };
  fades: {
    fadeInSeconds: number;
    fadeOutSeconds: number;
  };

  // 7. Silence Removal
  silenceRemoval: {
    enabled: boolean;
    thresholdDb: number; // e.g. -50 dB
    minDurationSeconds: number; // e.g. 0.8s
  };

  // 8. Channels
  channels: 'original' | 'mono' | 'stereo';

  // 9. Output Format & ID3 Tags
  exportFormat: {
    bitrate: '128k' | '192k' | '256k' | '320k' | 'V0';
    sampleRate: 44100 | 48000;
    filename: string;
    tags: {
      title?: string;
      artist?: string;
      album?: string;
      year?: string;
      genre?: string;
      coverArtUrl?: string;
    };
  };
}

export const DEFAULT_EQ_BANDS: EqBands = {
  31: 0,
  62: 0,
  125: 0,
  250: 0,
  500: 0,
  1000: 0,
  2000: 0,
  4000: 0,
  8000: 0,
  16000: 0,
};

export const DEFAULT_AUDIO_SETTINGS: AudioEditSettings = {
  voiceEnhance: {
    enabled: false,
    intensity: 0.5,
    highpassFreq: 80,
    noiseReductionStrength: 0.5,
    presenceBoostDb: 3.0,
    deEsserCutDb: -3.0,
    compressionRatio: 3.5,
    normalizeTargetLufs: -16,
    preset: 'podcast',
  },
  equalizer: {
    enabled: true,
    bands: { ...DEFAULT_EQ_BANDS },
    preset: 'flat',
  },
  speedPitch: {
    speed: 1.0,
    preservePitch: true,
    pitchSemitones: 0,
  },
  tone: {
    bassBoostDb: 0,
    trebleBoostDb: 0,
  },
  volume: {
    gainDb: 0,
    peakNormalize: false,
  },
  trim: {
    enabled: false,
    startSeconds: 0,
    endSeconds: 0,
  },
  fades: {
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
  },
  silenceRemoval: {
    enabled: false,
    thresholdDb: -50,
    minDurationSeconds: 0.8,
  },
  channels: 'original',
  exportFormat: {
    bitrate: '320k',
    sampleRate: 44100,
    filename: 'export.mp3',
    tags: {},
  },
};
