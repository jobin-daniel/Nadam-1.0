import { EqBands, EqPreset, VoicePreset, AudioEditSettings } from '../types/audio';

export const EQ_PRESETS: Record<string, EqBands> = {
  flat: {
    31: 0, 62: 0, 125: 0, 250: 0, 500: 0,
    1000: 0, 2000: 0, 4000: 0, 8000: 0, 16000: 0,
  },
  bass_boost: {
    31: 6, 62: 5, 125: 4, 250: 2, 500: 0,
    1000: 0, 2000: 0, 4000: 0, 8000: 0, 16000: 0,
  },
  treble_boost: {
    31: 0, 62: 0, 125: 0, 250: 0, 500: 0,
    1000: 1, 2000: 2, 4000: 4, 8000: 6, 16000: 6,
  },
  vocal_boost: {
    31: -3, 62: -2, 125: -1, 250: 0, 500: 2,
    1000: 4, 2000: 4, 4000: 3, 8000: 1, 16000: -1,
  },
  speech_clarity: {
    31: -6, 62: -4, 125: -2, 250: 0, 500: 1,
    1000: 3, 2000: 5, 4000: 4, 8000: 2, 16000: -2,
  },
  loudness: {
    31: 5, 62: 4, 125: 2, 250: -1, 500: -2,
    1000: 0, 2000: 1, 4000: 3, 8000: 5, 16000: 5,
  },
  reduce_muddiness: {
    31: -2, 62: -2, 125: -3, 250: -4, 500: -3,
    1000: 0, 2000: 1, 4000: 1, 8000: 0, 16000: 0,
  },
};

export interface VoicePresetConfig {
  highpassFreq: number;
  noiseReductionStrength: number;
  presenceBoostDb: number;
  deEsserCutDb: number;
  compressionRatio: number;
  normalizeTargetLufs: number;
}

export const VOICE_PRESETS: Record<VoicePreset, VoicePresetConfig> = {
  podcast: {
    highpassFreq: 80,
    noiseReductionStrength: 0.6,
    presenceBoostDb: 3.5,
    deEsserCutDb: -3.0,
    compressionRatio: 3.5,
    normalizeTargetLufs: -16,
  },
  lecture: {
    highpassFreq: 90,
    noiseReductionStrength: 0.8,
    presenceBoostDb: 4.5,
    deEsserCutDb: -3.5,
    compressionRatio: 4.0,
    normalizeTargetLufs: -16,
  },
  noisy: {
    highpassFreq: 100,
    noiseReductionStrength: 0.95,
    presenceBoostDb: 4.0,
    deEsserCutDb: -4.5,
    compressionRatio: 4.5,
    normalizeTargetLufs: -14,
  },
  music: {
    highpassFreq: 40,
    noiseReductionStrength: 0.2,
    presenceBoostDb: 1.5,
    deEsserCutDb: -1.0,
    compressionRatio: 2.0,
    normalizeTargetLufs: -14,
  },
  custom: {
    highpassFreq: 80,
    noiseReductionStrength: 0.5,
    presenceBoostDb: 3.0,
    deEsserCutDb: -3.0,
    compressionRatio: 3.5,
    normalizeTargetLufs: -16,
  },
};
