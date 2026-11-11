'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WaveformPlayer } from './WaveformPlayer';
import { GraphicEqPanel } from './GraphicEqPanel';
import { VoiceEnhancePanel } from './VoiceEnhancePanel';
import { SpeedPitchPanel } from './SpeedPitchPanel';
import { AudioToolsPanel } from './AudioToolsPanel';
import { AudioEditSettings, DEFAULT_AUDIO_SETTINGS, EqBands } from '@/lib/types/audio';
import { DspAudioGraph } from '@/lib/audio/webaudio-graph';
import { DownloadCloud, Sparkles, Check, Sliders, Music } from 'lucide-react';

interface AudioEditorProps {
  audioId: string;
  audioTitle: string;
  audioUrl: string;
  onOpenExport: (settings: AudioEditSettings) => void;
}

export function AudioEditor({
  audioId,
  audioTitle,
  audioUrl,
  onOpenExport,
}: AudioEditorProps) {
  const [settings, setSettings] = useState<AudioEditSettings>({
    ...DEFAULT_AUDIO_SETTINGS,
    exportFormat: {
      ...DEFAULT_AUDIO_SETTINGS.exportFormat,
      filename: `${audioTitle || 'mastered'}.mp3`,
      tags: {
        title: audioTitle,
      },
    },
  });

  const [isBypassed, setIsBypassed] = useState(false);
  const [duration, setDuration] = useState(0);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const dspGraphRef = useRef<DspAudioGraph | null>(null);

  // Initialize Web Audio DSP graph when audio element is available
  useEffect(() => {
    if (!audioElementRef.current) return;

    try {
      const graph = new DspAudioGraph(audioElementRef.current);
      dspGraphRef.current = graph;

      // Resume context on first user interaction
      const resume = () => {
        graph.resumeContext();
        window.removeEventListener('click', resume);
        window.removeEventListener('keydown', resume);
      };
      window.addEventListener('click', resume);
      window.addEventListener('keydown', resume);
    } catch (e) {
      console.warn('Web Audio DSP graph initialization error:', e);
    }

    return () => {
      dspGraphRef.current?.destroy();
      dspGraphRef.current = null;
    };
  }, [audioUrl]);

  // Update DSP graph on settings or bypass change
  useEffect(() => {
    if (dspGraphRef.current) {
      dspGraphRef.current.updateSettings(settings, isBypassed);
    }
  }, [settings, isBypassed]);

  // Keyboard Shortcuts: Space (play/pause), ArrowLeft/Right (seek), B (bypass)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (audioElementRef.current) {
          if (audioElementRef.current.paused) {
            dspGraphRef.current?.resumeContext();
            audioElementRef.current.play().catch(console.error);
          } else {
            audioElementRef.current.pause();
          }
        }
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        setIsBypassed((prev) => !prev);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (audioElementRef.current) {
          audioElementRef.current.currentTime = Math.max(0, audioElementRef.current.currentTime - 5);
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (audioElementRef.current) {
          audioElementRef.current.currentTime = Math.min(
            duration || audioElementRef.current.duration || 99999,
            audioElementRef.current.currentTime + 5
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration]);

  const handleToggleBypass = () => {
    setIsBypassed((prev) => !prev);
  };

  const handleCurveCalculation = useCallback(
    (freqs: Float32Array) => {
      if (dspGraphRef.current) {
        return dspGraphRef.current.calculateFrequencyResponse(freqs);
      }
      return new Float32Array(freqs.length);
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* Hidden audio element used by Web Audio API and WaveSurfer */}
      <audio
        ref={audioElementRef}
        crossOrigin="anonymous"
        preload="auto"
        className="hidden"
      />

      {/* Editor Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white truncate max-w-md">
                {audioTitle}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-bold border border-slate-700">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Real-time Web Audio DSP preview • Space to play • B to A/B bypass
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Export MP3 Action */}
          <button
            type="button"
            onClick={() => onOpenExport(settings)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/25"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Export Mastered MP3</span>
          </button>
        </div>
      </div>

      {/* 1. Waveform Player & Controls */}
      <WaveformPlayer
        audioUrl={audioUrl}
        audioElementRef={audioElementRef}
        onReady={(dur) => setDuration(dur)}
        onPlayStart={() => {
          dspGraphRef.current?.resumeContext();
        }}
        isBypassed={isBypassed}
        onToggleBypass={handleToggleBypass}
        trimStart={settings.trim.startSeconds}
        trimEnd={settings.trim.endSeconds}
        onTrimChange={(start, end) =>
          setSettings((prev) => ({
            ...prev,
            trim: { ...prev.trim, startSeconds: start, endSeconds: end },
          }))
        }
        trimEnabled={settings.trim.enabled}
        onToggleTrim={() =>
          setSettings((prev) => ({
            ...prev,
            trim: { ...prev.trim, enabled: !prev.trim.enabled },
          }))
        }
        playbackRate={settings.speedPitch.speed}
      />

      {/* 2. Voice Enhance Panel */}
      <VoiceEnhancePanel
        settings={settings.voiceEnhance}
        onChange={(updated) =>
          setSettings((prev) => ({
            ...prev,
            voiceEnhance: { ...prev.voiceEnhance, ...updated },
          }))
        }
      />

      {/* 3. 10-Band Graphic Equalizer */}
      <GraphicEqPanel
        bands={settings.equalizer.bands}
        enabled={settings.equalizer.enabled}
        onToggleEnabled={() =>
          setSettings((prev) => ({
            ...prev,
            equalizer: { ...prev.equalizer, enabled: !prev.equalizer.enabled },
          }))
        }
        onChangeBand={(freq, val) =>
          setSettings((prev) => ({
            ...prev,
            equalizer: {
              ...prev.equalizer,
              bands: { ...prev.equalizer.bands, [freq]: val },
            },
          }))
        }
        onApplyPreset={(newBands, presetName) =>
          setSettings((prev) => ({
            ...prev,
            equalizer: {
              ...prev.equalizer,
              bands: { ...newBands },
              preset: presetName,
            },
          }))
        }
        onReset={() =>
          setSettings((prev) => ({
            ...prev,
            equalizer: {
              ...prev.equalizer,
              bands: { ...DEFAULT_AUDIO_SETTINGS.equalizer.bands },
              preset: 'flat',
            },
          }))
        }
        calculateCurve={handleCurveCalculation}
      />

      {/* 4. Speed & Pitch Controls */}
      <SpeedPitchPanel
        settings={settings.speedPitch}
        onChange={(updated) =>
          setSettings((prev) => ({
            ...prev,
            speedPitch: { ...prev.speedPitch, ...updated },
          }))
        }
      />

      {/* 5. Audio Production Tools */}
      <AudioToolsPanel
        settings={settings}
        onChangeFades={(updated) =>
          setSettings((prev) => ({
            ...prev,
            fades: { ...prev.fades, ...updated },
          }))
        }
        onChangeVolume={(updated) =>
          setSettings((prev) => ({
            ...prev,
            volume: { ...prev.volume, ...updated },
          }))
        }
        onChangeTone={(updated) =>
          setSettings((prev) => ({
            ...prev,
            tone: { ...prev.tone, ...updated },
          }))
        }
        onChangeSilence={(updated) =>
          setSettings((prev) => ({
            ...prev,
            silenceRemoval: { ...prev.silenceRemoval, ...updated },
          }))
        }
        onChangeChannels={(ch) =>
          setSettings((prev) => ({
            ...prev,
            channels: ch,
          }))
        }
      />
    </div>
  );
}
