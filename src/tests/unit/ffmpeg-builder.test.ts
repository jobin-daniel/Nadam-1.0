import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFfmpegFilterChain,
  buildAtempoChain,
} from '../../lib/audio/ffmpeg-builder.ts';
import {
  DEFAULT_AUDIO_SETTINGS,
  AudioEditSettings,
} from '../../lib/types/audio.ts';

test('Atempo chain: Handles speeds outside 0.5 - 2.0 range correctly', () => {
  // Speed = 1.0 (no extra filters needed)
  const norm1 = buildAtempoChain(1.0);
  assert.equal(norm1.length, 1);
  assert.equal(norm1[0], 'atempo=1.0');

  // Speed = 1.5 (single filter within range)
  const speed15 = buildAtempoChain(1.5);
  assert.equal(speed15.length, 1);
  assert.equal(speed15[0], 'atempo=1.5');

  // Speed = 3.0 (must chain: atempo=2.0 and atempo=1.5)
  const speed3 = buildAtempoChain(3.0);
  assert.equal(speed3.length, 2);
  assert.equal(speed3[0], 'atempo=2.0');
  assert.equal(speed3[1], 'atempo=1.5');

  // Speed = 4.0 (must chain: atempo=2.0, atempo=2.0)
  const speed4 = buildAtempoChain(4.0);
  assert.equal(speed4.length, 2);
  assert.equal(speed4[0], 'atempo=2.0');
  assert.equal(speed4[1], 'atempo=2.0');

  // Speed = 0.25 (must chain: atempo=0.5, atempo=0.5)
  const slow025 = buildAtempoChain(0.25);
  assert.equal(slow025.length, 2);
  assert.equal(slow025[0], 'atempo=0.5');
  assert.equal(slow025[1], 'atempo=0.5');

  // Speed = 0.35 (must chain: atempo=0.5, atempo=0.7)
  const slow035 = buildAtempoChain(0.35);
  assert.equal(slow035.length, 2);
  assert.equal(slow035[0], 'atempo=0.5');
  assert.equal(slow035[1], 'atempo=0.7');
});

test('Filter Graph Builder: Generates Voice Enhance filter chain correctly', () => {
  const settings: AudioEditSettings = {
    ...DEFAULT_AUDIO_SETTINGS,
    voiceEnhance: {
      enabled: true,
      intensity: 0.8,
      highpassFreq: 85,
      noiseReductionStrength: 0.75,
      presenceBoostDb: 3.5,
      deEsserCutDb: -3.0,
      compressionRatio: 3.5,
      normalizeTargetLufs: -16,
      preset: 'podcast',
    },
    equalizer: {
      enabled: false,
      bands: { ...DEFAULT_AUDIO_SETTINGS.equalizer.bands },
      preset: 'flat',
    },
  };

  const { filterChain, filterString } = buildFfmpegFilterChain(settings);

  assert.ok(filterChain.includes('highpass=f=85'), 'Must include highpass filter');
  assert.ok(filterChain.some((f) => f.startsWith('afftdn=')), 'Must include afftdn noise reduction');
  assert.ok(filterChain.some((f) => f.includes('3000') && f.includes('g=2.80')), 'Presence boost must scale with intensity (3.5 * 0.8 = 2.8)');
  assert.ok(filterChain.some((f) => f.includes('8000') && f.includes('g=-2.40')), 'De-Esser cut must scale with intensity (-3.0 * 0.8 = -2.4)');
  assert.ok(filterChain.some((f) => f.startsWith('acompressor=')), 'Must include voice compressor');
  assert.ok(filterChain.includes('loudnorm=I=-16:TP=-1.5:LRA=11'), 'Must include loudnorm at -16 LUFS');
});

test('Filter Graph Builder: Generates 10-Band Graphic Equalizer with selective non-zero bands', () => {
  const settings: AudioEditSettings = {
    ...DEFAULT_AUDIO_SETTINGS,
    equalizer: {
      enabled: true,
      bands: {
        ...DEFAULT_AUDIO_SETTINGS.equalizer.bands,
        62: 4.5,
        1000: -3.0,
        16000: 5.0,
      },
      preset: 'custom',
    },
  };

  const { filterChain } = buildFfmpegFilterChain(settings);

  assert.ok(filterChain.includes('equalizer=f=62:t=q:w=1.41:g=4.50'));
  assert.ok(filterChain.includes('equalizer=f=1000:t=q:w=1.41:g=-3.00'));
  assert.ok(filterChain.includes('equalizer=f=16000:t=q:w=1.41:g=5.00'));
  // Zero gain bands should not clutter the filter chain
  assert.ok(!filterChain.includes('equalizer=f=31:t=q:w=1.41:g=0.00'));
});

test('Filter Graph Builder: Trim, Fades, Silence Removal, and Mono conversion', () => {
  const settings: AudioEditSettings = {
    ...DEFAULT_AUDIO_SETTINGS,
    trim: {
      enabled: true,
      startSeconds: 5.5,
      endSeconds: 45.0,
    },
    fades: {
      fadeInSeconds: 2.0,
      fadeOutSeconds: 3.0,
    },
    silenceRemoval: {
      enabled: true,
      thresholdDb: -50,
      minDurationSeconds: 1.2,
    },
    channels: 'mono',
    volume: {
      gainDb: 3.5,
      peakNormalize: false,
    },
  };

  const { filterChain } = buildFfmpegFilterChain(settings, 60.0);

  // Check Trimming at start of chain
  assert.equal(filterChain[0], 'atrim=start=5.500:end=45.000');
  assert.equal(filterChain[1], 'asetpts=PTS-STARTPTS');

  // Check Fades (effective duration = 45 - 5.5 = 39.5, fade out starts at 39.5 - 3 = 36.5)
  assert.ok(filterChain.includes('afade=t=in:ss=0:d=2.00'));
  assert.ok(filterChain.includes('afade=t=out:st=36.50:d=3.00'));

  // Silence removal
  assert.ok(filterChain.includes('silenceremove=stop_periods=-1:stop_duration=1.2:stop_threshold=-50dB'));

  // Mono downmix
  assert.ok(filterChain.includes('pan=mono|c0=0.5*c0+0.5*c1'));

  // Volume gain
  assert.ok(filterChain.includes('volume=3.50dB'));
});

test('Shared Schema: Preview and Export share single source of truth structure', () => {
  // Confirm default settings object contains all necessary fields for both Web Audio and FFmpeg
  assert.ok('voiceEnhance' in DEFAULT_AUDIO_SETTINGS);
  assert.ok('equalizer' in DEFAULT_AUDIO_SETTINGS);
  assert.ok('speedPitch' in DEFAULT_AUDIO_SETTINGS);
  assert.ok('tone' in DEFAULT_AUDIO_SETTINGS);
  assert.ok('volume' in DEFAULT_AUDIO_SETTINGS);
  assert.ok('trim' in DEFAULT_AUDIO_SETTINGS);
  assert.ok('fades' in DEFAULT_AUDIO_SETTINGS);
  assert.ok('silenceRemoval' in DEFAULT_AUDIO_SETTINGS);
  assert.ok('channels' in DEFAULT_AUDIO_SETTINGS);
  assert.ok('exportFormat' in DEFAULT_AUDIO_SETTINGS);
});
