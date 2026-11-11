import { AudioEditSettings, EqBands } from '../types/audio';

export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export class DspAudioGraph {
  public ctx: AudioContext;
  private sourceNode: MediaElementAudioSourceNode;
  private highpassNode: BiquadFilterNode;
  private eqNodes: BiquadFilterNode[] = [];
  private voicePresenceNode: BiquadFilterNode;
  private voiceDeEsserNode: BiquadFilterNode;
  private bassShelfNode: BiquadFilterNode;
  private trebleShelfNode: BiquadFilterNode;
  private compressorNode: DynamicsCompressorNode;
  private gainNode: GainNode;
  private wetGain: GainNode;
  private dryGain: GainNode;
  private isBypassed = false;

  constructor(audioElement: HTMLAudioElement) {
    // Reuse or create AudioContext to comply with browser state limitations
    let audioCtx: AudioContext = (window as any).__sharedAudioCtx;
    if (!audioCtx || audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioCtxClass();
      (window as any).__sharedAudioCtx = audioCtx;
    }
    this.ctx = audioCtx;

    // Reuse existing source node if audioElement was already connected to this context
    if ((audioElement as any).__mediaElementSource && (audioElement as any).__mediaElementSource.context === this.ctx) {
      this.sourceNode = (audioElement as any).__mediaElementSource;
      try {
        this.sourceNode.disconnect();
      } catch {}
    } else {
      this.sourceNode = this.ctx.createMediaElementSource(audioElement);
      (audioElement as any).__mediaElementSource = this.sourceNode;
    }

    // 1. High-pass (Voice rumble cut)
    this.highpassNode = this.ctx.createBiquadFilter();
    this.highpassNode.type = 'highpass';
    this.highpassNode.frequency.value = 80;

    // 2. 10-Band Graphic Equalizer
    this.eqNodes = EQ_FREQUENCIES.map((freq) => {
      const node = this.ctx.createBiquadFilter();
      node.type = 'peaking';
      node.frequency.value = freq;
      node.Q.value = 1.41;
      node.gain.value = 0;
      return node;
    });

    // 3. Voice Enhance peaking & de-esser
    this.voicePresenceNode = this.ctx.createBiquadFilter();
    this.voicePresenceNode.type = 'peaking';
    this.voicePresenceNode.frequency.value = 3000;
    this.voicePresenceNode.Q.value = 1.5;
    this.voicePresenceNode.gain.value = 0;

    this.voiceDeEsserNode = this.ctx.createBiquadFilter();
    this.voiceDeEsserNode.type = 'peaking';
    this.voiceDeEsserNode.frequency.value = 8000;
    this.voiceDeEsserNode.Q.value = 2.0;
    this.voiceDeEsserNode.gain.value = 0;

    // 4. Quick Tone Shelves
    this.bassShelfNode = this.ctx.createBiquadFilter();
    this.bassShelfNode.type = 'lowshelf';
    this.bassShelfNode.frequency.value = 100;
    this.bassShelfNode.gain.value = 0;

    this.trebleShelfNode = this.ctx.createBiquadFilter();
    this.trebleShelfNode.type = 'highshelf';
    this.trebleShelfNode.frequency.value = 10000;
    this.trebleShelfNode.gain.value = 0;

    // 5. Compressor
    this.compressorNode = this.ctx.createDynamicsCompressor();
    this.compressorNode.threshold.value = -24;
    this.compressorNode.knee.value = 30;
    this.compressorNode.ratio.value = 3.5;
    this.compressorNode.attack.value = 0.003;
    this.compressorNode.release.value = 0.25;

    // 6. Volume Gain
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 1.0;

    // 7. A/B Dry/Wet routing
    this.wetGain = this.ctx.createGain();
    this.dryGain = this.ctx.createGain();
    this.wetGain.gain.value = 1.0;
    this.dryGain.gain.value = 0.0;

    // Wire wet chain:
    let lastNode: AudioNode = this.sourceNode;

    lastNode.connect(this.highpassNode);
    lastNode = this.highpassNode;

    for (const eqNode of this.eqNodes) {
      lastNode.connect(eqNode);
      lastNode = eqNode;
    }

    lastNode.connect(this.voicePresenceNode);
    lastNode = this.voicePresenceNode;

    lastNode.connect(this.voiceDeEsserNode);
    lastNode = this.voiceDeEsserNode;

    lastNode.connect(this.bassShelfNode);
    lastNode = this.bassShelfNode;

    lastNode.connect(this.trebleShelfNode);
    lastNode = this.trebleShelfNode;

    lastNode.connect(this.compressorNode);
    lastNode = this.compressorNode;

    lastNode.connect(this.gainNode);
    this.gainNode.connect(this.wetGain);
    this.wetGain.connect(this.ctx.destination);

    // Wire dry bypass chain:
    this.sourceNode.connect(this.dryGain);
    this.dryGain.connect(this.ctx.destination);
  }

  public async resumeContext(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {}
    }
  }

  public updateSettings(settings: AudioEditSettings, bypass = false): void {
    if (!this.ctx || this.ctx.state === 'closed') return;
    const t = this.ctx.currentTime;
    this.isBypassed = bypass;

    // A/B crossfade
    if (bypass) {
      this.wetGain.gain.setTargetAtTime(0, t, 0.02);
      this.dryGain.gain.setTargetAtTime(1, t, 0.02);
      return;
    } else {
      this.wetGain.gain.setTargetAtTime(1, t, 0.02);
      this.dryGain.gain.setTargetAtTime(0, t, 0.02);
    }

    // 1. Voice Enhance
    if (settings.voiceEnhance.enabled) {
      const intensity = settings.voiceEnhance.intensity;
      this.highpassNode.frequency.setTargetAtTime(settings.voiceEnhance.highpassFreq, t, 0.05);
      this.voicePresenceNode.gain.setTargetAtTime(settings.voiceEnhance.presenceBoostDb * intensity, t, 0.05);
      this.voiceDeEsserNode.gain.setTargetAtTime(settings.voiceEnhance.deEsserCutDb * intensity, t, 0.05);
      this.compressorNode.ratio.setTargetAtTime(settings.voiceEnhance.compressionRatio, t, 0.05);
    } else {
      this.highpassNode.frequency.setTargetAtTime(20, t, 0.05);
      this.voicePresenceNode.gain.setTargetAtTime(0, t, 0.05);
      this.voiceDeEsserNode.gain.setTargetAtTime(0, t, 0.05);
      this.compressorNode.ratio.setTargetAtTime(1.0, t, 0.05);
    }

    // 2. 10-Band Graphic EQ
    if (settings.equalizer.enabled) {
      EQ_FREQUENCIES.forEach((freq, idx) => {
        const gain = settings.equalizer.bands[freq] || 0;
        this.eqNodes[idx].gain.setTargetAtTime(gain, t, 0.05);
      });
    } else {
      this.eqNodes.forEach((node) => node.gain.setTargetAtTime(0, t, 0.05));
    }

    // 3. Quick Tone Shelves
    this.bassShelfNode.gain.setTargetAtTime(settings.tone.bassBoostDb, t, 0.05);
    this.trebleShelfNode.gain.setTargetAtTime(settings.tone.trebleBoostDb, t, 0.05);

    // 4. Volume Gain (dB to linear)
    const linearGain = Math.pow(10, settings.volume.gainDb / 20);
    this.gainNode.gain.setTargetAtTime(linearGain, t, 0.05);
  }

  public calculateFrequencyResponse(freqs: Float32Array): Float32Array {
    const totalMag = new Float32Array(freqs.length).fill(1.0);
    const totalPhase = new Float32Array(freqs.length);

    const magResponse = new Float32Array(freqs.length);
    const phaseResponse = new Float32Array(freqs.length);

    const allFilters = [
      this.highpassNode,
      ...this.eqNodes,
      this.voicePresenceNode,
      this.voiceDeEsserNode,
      this.bassShelfNode,
      this.trebleShelfNode,
    ];

    for (const filter of allFilters) {
      filter.getFrequencyResponse(freqs as any, magResponse as any, phaseResponse as any);
      for (let i = 0; i < freqs.length; i++) {
        totalMag[i] *= magResponse[i];
      }
    }

    const dbResponse = new Float32Array(freqs.length);
    for (let i = 0; i < freqs.length; i++) {
      dbResponse[i] = 20 * Math.log10(Math.max(1e-4, totalMag[i]));
    }

    return dbResponse;
  }

  public destroy(): void {
    try {
      this.sourceNode.disconnect();
      this.wetGain.disconnect();
      this.dryGain.disconnect();
    } catch {}
  }
}
