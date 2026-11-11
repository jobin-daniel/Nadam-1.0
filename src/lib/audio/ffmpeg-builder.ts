import { AudioEditSettings, EqBands } from '../types/audio';
import { EQ_FREQUENCIES } from './webaudio-graph';

export interface FilterGraphResult {
  filterChain: string[];
  filterString: string;
}

/**
 * Decomposes a speed multiplier into a series of atempo filters (each between 0.5 and 2.0)
 */
export function buildAtempoChain(speed: number): string[] {
  if (speed <= 0) return ['atempo=1.0'];

  const filters: string[] = [];
  let remaining = speed;

  // Handle speeds > 2.0
  while (remaining > 2.0) {
    filters.push('atempo=2.0');
    remaining /= 2.0;
  }

  // Handle speeds < 0.5
  while (remaining < 0.5) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }

  // Final fraction (bounded between 0.5 and 2.0)
  if (Math.abs(remaining - 1.0) > 0.001 || filters.length === 0) {
    const formatted = remaining % 1 === 0 ? `${remaining}.0` : `${remaining.toFixed(4).replace(/0+$/, '')}`;
    filters.push(`atempo=${formatted}`);
  }

  return filters;
}

/**
 * Pure TypeScript function that compiles AudioEditSettings into an optimized FFmpeg filter chain
 */
export function buildFfmpegFilterChain(
  settings: AudioEditSettings,
  totalDurationSeconds?: number
): FilterGraphResult {
  const filters: string[] = [];

  // 1. Trimming (atrim)
  if (settings.trim.enabled) {
    const start = Math.max(0, settings.trim.startSeconds);
    const end = settings.trim.endSeconds;
    if (end > start) {
      filters.push(`atrim=start=${start.toFixed(3)}:end=${end.toFixed(3)}`);
      filters.push('asetpts=PTS-STARTPTS');
    }
  }

  // 2. Voice Enhance - Highpass Rumble Filter
  if (settings.voiceEnhance.enabled) {
    const hp = settings.voiceEnhance.highpassFreq || 80;
    filters.push(`highpass=f=${hp}`);

    // Noise Reduction (afftdn) scaled by intensity
    if (settings.voiceEnhance.noiseReductionStrength > 0) {
      const nr = Math.min(30, Math.round(12 * settings.voiceEnhance.noiseReductionStrength * settings.voiceEnhance.intensity));
      if (nr > 0) {
        filters.push(`afftdn=nr=${nr}:nf=-50`);
      }
    }
  }

  // 3. 10-Band Graphic Equalizer
  if (settings.equalizer.enabled) {
    for (const freq of EQ_FREQUENCIES) {
      const gain = settings.equalizer.bands[freq] || 0;
      if (gain !== 0) {
        filters.push(`equalizer=f=${freq}:t=q:w=1.41:g=${gain.toFixed(2)}`);
      }
    }
  }

  // 4. Voice Enhance - Presence Boost & De-Esser Peaking Filters
  if (settings.voiceEnhance.enabled) {
    const intensity = settings.voiceEnhance.intensity;
    const presence = settings.voiceEnhance.presenceBoostDb * intensity;
    if (presence !== 0) {
      filters.push(`equalizer=f=3000:t=q:w=1.5:g=${presence.toFixed(2)}`);
    }

    const deEsser = settings.voiceEnhance.deEsserCutDb * intensity;
    if (deEsser !== 0) {
      filters.push(`equalizer=f=8000:t=q:w=2.0:g=${deEsser.toFixed(2)}`);
    }
  }

  // 5. Quick Tone Controls (Bass & Treble Shelves)
  if (settings.tone.bassBoostDb !== 0) {
    filters.push(`bass=g=${settings.tone.bassBoostDb.toFixed(2)}:f=100`);
  }
  if (settings.tone.trebleBoostDb !== 0) {
    filters.push(`treble=g=${settings.tone.trebleBoostDb.toFixed(2)}:f=10000`);
  }

  // 6. Voice Enhance - Voice Dynamics Compression
  if (settings.voiceEnhance.enabled && settings.voiceEnhance.compressionRatio > 1.0) {
    const ratio = settings.voiceEnhance.compressionRatio;
    filters.push(`acompressor=threshold=-24dB:ratio=${ratio.toFixed(2)}:attack=3:release=250`);
  }

  // 7. Playback Speed & Pitch Shifting
  const { speed, preservePitch, pitchSemitones } = settings.speedPitch;

  if (pitchSemitones !== 0) {
    // Pitch shifting using asetrate + atempo compensation
    const semitoneRatio = Math.pow(2, pitchSemitones / 12);
    const targetSampleRate = 44100;
    const alteredRate = Math.round(targetSampleRate * semitoneRatio);

    filters.push(`asetrate=${alteredRate}`);
    // Compensate time back to original duration
    const atempoComp = 1 / semitoneRatio;
    filters.push(...buildAtempoChain(atempoComp));
    filters.push(`aresample=${targetSampleRate}`);
  }

  if (speed !== 1.0) {
    if (preservePitch) {
      filters.push(...buildAtempoChain(speed));
    } else {
      const targetSampleRate = 44100;
      const alteredRate = Math.round(targetSampleRate * speed);
      filters.push(`asetrate=${alteredRate}`);
      filters.push(`aresample=${targetSampleRate}`);
    }
  }

  // 8. Fades (Fade In & Fade Out)
  if (settings.fades.fadeInSeconds > 0) {
    filters.push(`afade=t=in:ss=0:d=${settings.fades.fadeInSeconds.toFixed(2)}`);
  }

  if (settings.fades.fadeOutSeconds > 0) {
    let effectiveDuration = totalDurationSeconds || 0;
    if (settings.trim.enabled && settings.trim.endSeconds > settings.trim.startSeconds) {
      effectiveDuration = settings.trim.endSeconds - settings.trim.startSeconds;
    }
    // Adjust duration for playback speed if applied
    if (speed > 0) {
      effectiveDuration /= speed;
    }

    if (effectiveDuration > settings.fades.fadeOutSeconds) {
      const fadeStart = Math.max(0, effectiveDuration - settings.fades.fadeOutSeconds);
      filters.push(`afade=t=out:st=${fadeStart.toFixed(2)}:d=${settings.fades.fadeOutSeconds.toFixed(2)}`);
    }
  }

  // 9. Silence Removal
  if (settings.silenceRemoval.enabled) {
    const dur = settings.silenceRemoval.minDurationSeconds;
    const th = settings.silenceRemoval.thresholdDb;
    filters.push(`silenceremove=stop_periods=-1:stop_duration=${dur}:stop_threshold=${th}dB`);
  }

  // 10. Channel Layout (Mono vs Stereo)
  if (settings.channels === 'mono') {
    filters.push('pan=mono|c0=0.5*c0+0.5*c1');
  } else if (settings.channels === 'stereo') {
    filters.push('aformat=channel_layouts=stereo');
  }

  // 11. Volume Gain
  if (settings.volume.gainDb !== 0) {
    filters.push(`volume=${settings.volume.gainDb.toFixed(2)}dB`);
  }

  // 12. Loudness Normalization / Peak Normalization
  if (settings.voiceEnhance.enabled) {
    const lufs = settings.voiceEnhance.normalizeTargetLufs || -16;
    filters.push(`loudnorm=I=${lufs}:TP=-1.5:LRA=11`);
  } else if (settings.volume.peakNormalize) {
    filters.push('loudnorm=I=-16:TP=-0.5:LRA=14');
  }

  return {
    filterChain: filters,
    filterString: filters.join(','),
  };
}
